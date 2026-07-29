import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { createOTP, verifyOTP } from '../../utils/otp.util';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.util';
import { sendVerificationEmail } from '../../utils/email.service';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { Role } from '@prisma/client';

export const emailSignup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, phone } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError('An account with this email already exists', 400));
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return next(new AppError('An account with this phone already exists', 400));
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and resident profile
    // Note: Assuming resident profile creation requires a unit, but for signup we might assign a dummy one or null
    // Here we just create the User, and Resident can be created later or with a placeholder
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: Role.RESIDENT,
        isEmailVerified: false,
      },
    });

    // Generate and store OTP
    const code = await createOTP(user.id, 'EMAIL_VERIFICATION');

    // Send OTP via Email
    await sendVerificationEmail(email, code);

    await auditLog(user.id, 'USER_REGISTERED', 'User', user.id);

    return sendSuccess(res, 201, 'Registration successful. Please check your email for the verification OTP.', {
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmailOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return next(new AppError('No account found', 404));
    }

    const isValid = await verifyOTP(user.id, code, 'EMAIL_VERIFICATION');
    if (!isValid) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });

    // Generate tokens
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: expiryDate,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await auditLog(user.id, 'EMAIL_VERIFIED', 'User', user.id);

    return sendSuccess(res, 200, 'Email verified and logged in successfully', {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
