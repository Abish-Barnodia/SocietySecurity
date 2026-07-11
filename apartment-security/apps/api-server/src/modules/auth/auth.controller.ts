import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { createOTP, verifyOTP } from '../../utils/otp.util';
import { signAccessToken, signRefreshToken, rotateRefreshToken } from '../../utils/jwt.util';
import { sendSMS } from '../../utils/sms.util';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { logger } from '../../utils/logger.util';

export const requestOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return next(new AppError('No account found with this phone number', 404));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 403));
    }

    // Generate and store OTP
    const code = await createOTP(user.id, 'LOGIN');

    // Send OTP via SMS
    await sendSMS(phone, `Your Apartment Security login OTP is: ${code}`);

    // Audit log
    await auditLog(user.id, 'OTP_REQUESTED', 'User', user.id);

    return sendSuccess(res, 200, 'OTP sent successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Email + Password login.
 * POST /auth/login  { email, password }
 */
export const emailLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        resident: {
          select: {
            id: true,
            name: true,
            unit: { select: { unitNumber: true, tower: true } },
          },
        },
      },
    });

    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 403));
    }

    if (!user.passwordHash) {
      return next(new AppError('Password login is not configured for this account. Please use OTP.', 400));
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Generate tokens
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store refresh token
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: expiryDate,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await auditLog(user.id, 'LOGIN_SUCCESS', 'User', user.id);

    return sendSuccess(res, 200, 'Login successful', {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        role: user.role,
        resident: user.resident,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = req.body;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return next(new AppError('No account found', 404));
    }

    const isValid = await verifyOTP(user.id, code, 'LOGIN');
    if (!isValid) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    // Generate tokens
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store refresh token
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: expiryDate,
      }
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await auditLog(user.id, 'LOGIN_SUCCESS', 'User', user.id);

    return sendSuccess(res, 200, 'Login successful', {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    // Check if token exists in DB and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    // Fetch user to get real role and check if active
    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
      select: { role: true, isActive: true }
    });
    if (!user || !user.isActive) return next(new AppError('User no longer exists or is deactivated', 401));

    const newAccessToken = signAccessToken({ userId: storedToken.userId, role: user.role });
    const newRefreshToken = await rotateRefreshToken(refreshToken);

    // Update DB
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() }
      }),
      prisma.refreshToken.create({
        data: {
          userId: storedToken.userId,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      })
    ]);

    return sendSuccess(res, 200, 'Token refreshed successfully', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { revokedAt: new Date() }
      }).catch((err: any) => logger.warn('Logout token update failed', err));
    }

    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const registerFcmToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    const userId = req.user?.userId;

    if (!userId) return next(new AppError('Unauthorized', 401));

    // Append token if not exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.fcmTokens.includes(token)) {
      const updatedTokens = [...user.fcmTokens, token].slice(-5); // Keep only the latest 5
      await prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: updatedTokens }
      });
    }

    return sendSuccess(res, 200, 'FCM token registered');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        resident: {
          select: {
            id: true,
            name: true,
            unit: { select: { unitNumber: true, tower: true } }
          }
        }
      }
    });

    if (!user) return next(new AppError('User not found', 404));
    if (!user.isActive) return next(new AppError('Account deactivated', 403));

    return sendSuccess(res, 200, 'Authenticated', user);
  } catch (error) {
    next(error);
  }
};
