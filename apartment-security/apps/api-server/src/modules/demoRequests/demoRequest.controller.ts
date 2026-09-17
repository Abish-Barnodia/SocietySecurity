import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { Role, SocietyStatus, DemoRequestStatus } from '@prisma/client';
import { razorpay } from '../../config/razorpay';
import { env } from '../../config/env';

// Create ₹1.00 Razorpay order for 1-month demo trial
export const createDemoPaymentOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!razorpay) {
      return next(new AppError('Razorpay payment gateway is not configured on the server', 500));
    }

    const order = await razorpay.orders.create({
      amount: 100, // 100 paise = ₹1.00 for 1-month trial
      currency: 'INR',
      receipt: `demo_${Date.now()}`,
      notes: {
        type: '1_MONTH_DEMO_TRIAL',
        amount: '₹1.00',
      },
    });

    return sendSuccess(res, 200, 'Demo payment order created', {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
};

// Verify payment signature and record demo request with 1-month trial details
export const verifyDemoPaymentAndSubmit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, ...demoData } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(new AppError('Missing required Razorpay payment verification fields', 400));
    }

    if (env.RAZORPAY_KEY_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return next(new AppError('Payment signature verification failed. Untrusted transaction.', 400));
      }
    }

    const { contactName, email, phone, societyName, city, numberOfUnits, message, selectedPlan } = demoData;

    const paymentNote = `[PAID TRIAL] ₹1.00 Paid (Payment ID: ${razorpay_payment_id}, Order: ${razorpay_order_id}). 1-Month Demo Trial Active. Selected Plan: ${selectedPlan || 'STANDARD'}`;
    const combinedMessage = message ? `${message} | ${paymentNote}` : paymentNote;

    const demoRequest = await prisma.demoRequest.create({
      data: {
        contactName,
        email,
        phone,
        societyName,
        city: city || null,
        numberOfUnits: numberOfUnits ? Number(numberOfUnits) : null,
        message: combinedMessage,
        notes: `Paid ₹1 Demo Trial. Payment: ${razorpay_payment_id}. Selected Plan: ${selectedPlan || 'STANDARD'}`,
        status: DemoRequestStatus.PENDING,
      },
    });

    return sendSuccess(res, 201, 'Payment verified and demo trial activated successfully!', {
      demoRequest,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      trialDuration: '1 Month',
      amountPaid: '₹1.00',
    });
  } catch (error) {
    next(error);
  }
};

export const createDemoRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactName, email, phone, societyName, city, numberOfUnits, message } = req.body;

    const demoRequest = await prisma.demoRequest.create({
      data: {
        contactName,
        email,
        phone,
        societyName,
        city: city || null,
        numberOfUnits: numberOfUnits ? Number(numberOfUnits) : null,
        message: message || null,
        status: DemoRequestStatus.PENDING,
      },
    });

    return sendSuccess(res, 201, 'Demo request submitted successfully. Our team will contact you soon.', demoRequest);
  } catch (error) {
    next(error);
  }
};

export const getDemoRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status as DemoRequestStatus;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { societyName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const requests = await prisma.demoRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdProperty: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    return sendSuccess(res, 200, 'Demo requests retrieved successfully', requests);
  } catch (error) {
    next(error);
  }
};

export const updateDemoRequestStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status, notes } = req.body;

    const existing = await prisma.demoRequest.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Demo request not found', 404));
    }

    const updated = await prisma.demoRequest.update({
      where: { id },
      data: {
        status: status as DemoRequestStatus,
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    if (req.user) {
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: req.user.userId,
          action: 'UPDATE_DEMO_REQUEST_STATUS',
          targetType: 'DemoRequest',
          targetId: id,
          metadata: { status, notes },
        },
      });
    }

    return sendSuccess(res, 200, 'Demo request status updated', updated);
  } catch (error) {
    next(error);
  }
};

export const approveAndProvision = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const {
      managerName,
      managerEmail,
      managerPhone,
      managerPassword,
      address,
      city,
      pincode,
      totalUnits,
      totalTowers,
      subscriptionPlan,
    } = req.body;

    const demoRequest = await prisma.demoRequest.findUnique({ where: { id } });
    if (!demoRequest) {
      return next(new AppError('Demo request not found', 404));
    }

    if (demoRequest.status === DemoRequestStatus.CONVERTED && demoRequest.createdPropertyId) {
      return next(new AppError('This demo request has already been converted to a society.', 400));
    }

    // Check if manager email or phone is already taken
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: managerEmail },
          { phone: managerPhone },
        ],
      },
    });

    if (existingUser) {
      return next(new AppError(`A user with email ${managerEmail} or phone ${managerPhone} already exists.`, 400));
    }

    // Generate unique slug for society
    let baseSlug = (demoRequest.societyName || 'society')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!baseSlug) baseSlug = 'society';

    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await prisma.property.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Plaintext password to return to Super Admin (for sharing with manager)
    const rawPassword = managerPassword || `Gate@${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // One-year subscription by default
    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setFullYear(subscriptionExpiresAt.getFullYear() + 1);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Society / Property
      const property = await tx.property.create({
        data: {
          name: demoRequest.societyName,
          slug: uniqueSlug,
          address: address || demoRequest.city || 'Address to be updated',
          city: city || demoRequest.city || 'City',
          pincode: pincode || '000000',
          email: managerEmail,
          phone: managerPhone,
          status: SocietyStatus.ACTIVE,
          subscriptionPlan: subscriptionPlan || 'STANDARD',
          subscriptionExpiresAt,
          totalUnits: totalUnits ? Number(totalUnits) : (demoRequest.numberOfUnits || 100),
          totalTowers: totalTowers ? Number(totalTowers) : 1,
        },
      });

      // 2. Create Default Entry Point
      await tx.entryPoint.create({
        data: {
          propertyId: property.id,
          name: 'Main Gate',
          type: 'MAIN',
          isActive: true,
        },
      });

      // 3. Create Manager User
      const user = await tx.user.create({
        data: {
          email: managerEmail,
          phone: managerPhone,
          passwordHash,
          role: Role.MANAGER,
          isEmailVerified: true,
          isActive: true,
        },
      });

      // 4. Create Manager Profile
      const manager = await tx.manager.create({
        data: {
          userId: user.id,
          propertyId: property.id,
          name: managerName || demoRequest.contactName,
          permissions: [], // Full access by default
        },
      });

      // 5. Update Demo Request
      const updatedDemo = await tx.demoRequest.update({
        where: { id },
        data: {
          status: DemoRequestStatus.CONVERTED,
          createdPropertyId: property.id,
          notes: `Converted to society ${property.name} (ID: ${property.id}) by Super Admin.`,
        },
      });

      return { property, user, manager, updatedDemo };
    });

    if (req.user) {
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: req.user.userId,
          action: 'PROVISION_SOCIETY_FROM_DEMO',
          targetType: 'Property',
          targetId: result.property.id,
          metadata: {
            demoRequestId: id,
            societyName: result.property.name,
            managerEmail,
            managerName,
          },
        },
      });
    }

    return sendSuccess(res, 201, 'Society and Manager account provisioned successfully!', {
      society: {
        id: result.property.id,
        name: result.property.name,
        slug: result.property.slug,
        status: result.property.status,
        subscriptionPlan: result.property.subscriptionPlan,
        subscriptionExpiresAt: result.property.subscriptionExpiresAt,
      },
      manager: {
        id: result.manager.id,
        userId: result.user.id,
        name: result.manager.name,
        email: result.user.email,
        phone: result.user.phone,
      },
      credentials: {
        email: managerEmail,
        temporaryPassword: rawPassword,
        portalUrl: `/login?slug=${result.property.slug}`,
      },
    });
  } catch (error) {
    next(error);
  }
};
