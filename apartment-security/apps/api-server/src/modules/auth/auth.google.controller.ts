import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../config/prisma';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.util';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { Role } from '@prisma/client';

// Use an environment variable for the Google Client ID
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return next(new AppError('Invalid Google token', 401));
    }

    const { email, name } = payload;

    // Check if user exists by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create a new user if they don't exist
      user = await prisma.user.create({
        data: {
          email,
          role: Role.RESIDENT,
          isEmailVerified: true, // Google verifies emails
        },
      });
      await auditLog(user.id, 'USER_REGISTERED_GOOGLE', 'User', user.id);
    } else {
      // If user exists but is deactivated
      if (!user.isActive) {
        return next(new AppError('Your account has been deactivated', 403));
      }
      // Ensure email is marked verified since they signed in with Google
      if (!user.isEmailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isEmailVerified: true },
        });
      }
    }

    // Generate tokens
    const jwtPayload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

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

    await auditLog(user.id, 'LOGIN_SUCCESS_GOOGLE', 'User', user.id);

    return sendSuccess(res, 200, 'Login successful', {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
