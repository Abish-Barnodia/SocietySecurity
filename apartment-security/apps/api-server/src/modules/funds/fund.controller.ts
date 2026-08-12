import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { getCallerPropertyId } from '../../utils/residentContext.util';

// Get all fund transactions + computed balance for the property
export const getFundSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = await getCallerPropertyId(req.user!.userId);

    const transactions = await prisma.fundTransaction.findMany({
      where: { propertyId },
      orderBy: { date: 'desc' },
    });

    // Compute running balance
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    return sendSuccess(res, 200, 'Fund summary fetched', {
      balance,
      totalIncome,
      totalExpenses,
      transactions,
    });
  } catch (err) { next(err); }
};

// Manager: Add a fund transaction (income or expense)
export const addFundTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, type, category, description, date } = req.body;

    const manager = await prisma.manager.findUnique({
      where: { userId: req.user!.userId },
      select: { propertyId: true },
    });
    if (!manager) return next(new AppError('Manager not found', 404));

    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return next(new AppError('Type must be INCOME or EXPENSE', 400));
    }

    const transaction = await prisma.fundTransaction.create({
      data: {
        propertyId: manager.propertyId,
        amount: parseFloat(amount),
        type,
        category,
        description,
        date: date ? new Date(date) : new Date(),
        recordedById: req.user!.userId,
      },
    });

    const io = req.app.get('io');
    io?.to(`property:${manager.propertyId}`).emit('fund:new', transaction);

    return sendSuccess(res, 201, 'Transaction recorded', transaction);
  } catch (err) { next(err); }
};
