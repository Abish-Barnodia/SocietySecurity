import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { razorpay } from '../../config/razorpay';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';

// Manager: all invoices raised for the property
export const getAllInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = await prisma.manager.findUnique({
      where: { userId: req.user!.userId },
      select: { propertyId: true },
    });
    if (!manager) return next(new AppError('Manager not found', 404));

    const invoices = await prisma.invoice.findMany({
      where: { propertyId: manager.propertyId },
      include: {
        payments: true,
        unit: { select: { unitNumber: true, tower: true } },
        resident: { select: { name: true } },
      },
      orderBy: { dueDate: 'desc' },
    });

    return sendSuccess(res, 200, 'Invoices fetched', invoices);
  } catch (err) { next(err); }
};

// Get all invoices (maintenance bills) for the resident
export const getMyInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resident = await prisma.resident.findUnique({
      where: { userId: req.user!.userId },
      include: { unit: { select: { id: true } } },
    });
    if (!resident) return next(new AppError('Resident not found', 404));

    const invoices = await prisma.invoice.findMany({
      where: { unitId: resident.unit.id },
      include: { payments: true },
      orderBy: { dueDate: 'desc' },
    });

    return sendSuccess(res, 200, 'Invoices fetched', invoices);
  } catch (err) { next(err); }
};

// Resolves the calling resident + confirms they may act on this invoice.
// Payment is scoped to a unit (mirrors getMyInvoices' read scoping), not a
// single named resident, since a unit's invoices are visible to everyone in
// that family — so anyone in the unit can pay it. Any other unit is refused,
// which is what stops a tampered invoice id from letting a resident pay
// (or read the payability of) someone else's bill.
const authorizeResidentForInvoice = async (userId: string, invoiceId: string) => {
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: { id: true, unitId: true },
  });
  if (!resident) throw new AppError('Resident not found', 404);

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.unitId !== resident.unitId) throw new AppError('Not authorized to pay this invoice', 403);

  return { resident, invoice };
};

// Resident: create a Razorpay order for an invoice (TEST MODE credentials).
// Amount is always read from the invoice row in the DB — never trusted from the client.
export const createPaymentOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!razorpay) return next(new AppError('Payment gateway is not configured', 500));

    const { invoice } = await authorizeResidentForInvoice(req.user!.userId, req.params.id as string);

    if (invoice.status === 'PAID') return next(new AppError('Invoice already paid', 400));
    if (invoice.status === 'CANCELLED') return next(new AppError('Invoice is cancelled', 400));

    const amountPaise = Math.round(invoice.amount * 100);
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: invoice.id,
      notes: { invoiceId: invoice.id },
    });

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: invoice.amount,
        method: 'RAZORPAY',
        razorpayOrderId: order.id,
        status: 'PENDING',
      },
    });

    return sendSuccess(res, 201, 'Order created', {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID, // public key only — secret never leaves the server
      paymentId: payment.id,
      invoiceId: invoice.id,
    });
  } catch (err) { next(err); }
};

// Resident: verify the Razorpay signature server-side and only then mark the
// invoice paid. The checkout callback succeeding client-side proves nothing
// by itself — this HMAC check is what actually proves the payment happened.
export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!razorpay || !env.RAZORPAY_KEY_SECRET) return next(new AppError('Payment gateway is not configured', 500));

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(new AppError('Missing Razorpay payment fields', 400));
    }

    const { invoice } = await authorizeResidentForInvoice(req.user!.userId, req.params.id as string);

    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
    if (!payment || payment.invoiceId !== invoice.id) {
      return next(new AppError('Order does not match this invoice', 400));
    }

    // Already verified by an earlier/concurrent request — idempotent success.
    if (payment.status === 'SUCCESS') {
      return sendSuccess(res, 200, 'Payment already verified', { invoice, paymentId: payment.id });
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      return next(new AppError('Payment signature verification failed', 400));
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Guard against a second concurrent verify call flipping the invoice twice.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'SUCCESS' } },
        data: { transactionId: razorpay_payment_id, status: 'SUCCESS', paidAt: new Date() },
      });
      if (claimed.count === 0) return null;
      return tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date() } });
    });

    const finalInvoice = updatedInvoice ?? (await prisma.invoice.findUnique({ where: { id: invoice.id } }));

    const io = req.app.get('io');
    io?.to(`property:${invoice.propertyId}`).emit('invoice:update', finalInvoice);

    return sendSuccess(res, 200, 'Payment verified', { invoice: finalInvoice, paymentId: payment.id });
  } catch (err) { next(err); }
};

// Resident: mark an abandoned/cancelled checkout so it doesn't linger as PENDING.
export const cancelPaymentOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { razorpay_order_id } = req.body;
    if (!razorpay_order_id) return next(new AppError('razorpay_order_id is required', 400));

    const { invoice } = await authorizeResidentForInvoice(req.user!.userId, req.params.id as string);

    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
    if (!payment || payment.invoiceId !== invoice.id) {
      return next(new AppError('Order does not match this invoice', 400));
    }
    if (payment.status === 'SUCCESS') return next(new AppError('Cannot cancel a completed payment', 400));

    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
    return sendSuccess(res, 200, 'Payment order cancelled', { paymentId: payment.id });
  } catch (err) { next(err); }
};

// Manager: bulk-create maintenance invoices across one or more units in their property.
export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, amount, dueDate, unitIds } = req.body;

    const amt = parseFloat(amount);
    if (!description?.trim() || !dueDate || !Number.isFinite(amt) || amt <= 0) {
      return next(new AppError('description, amount, and dueDate are required', 400));
    }
    if (!Array.isArray(unitIds) || unitIds.length === 0) {
      return next(new AppError('At least one unit must be selected', 400));
    }

    const manager = await prisma.manager.findUnique({
      where: { userId: req.user!.userId },
      select: { propertyId: true },
    });
    if (!manager) return next(new AppError('Manager not found', 404));

    // Only units that actually belong to this manager's property — a
    // tampered unitId can't be used to raise a bill on another property.
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds }, propertyId: manager.propertyId },
      select: { id: true, residents: { where: { isPrimary: true }, select: { id: true }, take: 1 } },
    });
    if (units.length === 0) return next(new AppError('No valid units found for this property', 400));

    const due = new Date(dueDate);
    const created = await prisma.$transaction(
      units.map((u) =>
        prisma.invoice.create({
          data: {
            propertyId: manager.propertyId,
            unitId: u.id,
            residentId: u.residents[0]?.id ?? null,
            amount: amt,
            description,
            dueDate: due,
          },
        })
      )
    );

    const io = req.app.get('io');
    created.forEach((invoice) => io?.to(`property:${manager.propertyId}`).emit('invoice:new', invoice));

    return sendSuccess(res, 201, `${created.length} invoice(s) created`, created);
  } catch (err) { next(err); }
};
