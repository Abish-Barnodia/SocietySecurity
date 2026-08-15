import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { createOTP, verifyOTP } from '../../utils/otp.util';
import { signAccessToken, signRefreshToken, rotateRefreshToken, verifyRefreshToken } from '../../utils/jwt.util';
import { sendSMS } from '../../utils/sms.util';
import { sendEmail } from '../../utils/email.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { logger } from '../../utils/logger.util';
import { claimManagerPortalLock, releaseManagerPortalLock, MANAGER_SESSION_IDLE_MS } from '../../utils/managerPortalLock.util';

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

    // Fetch user to get real role (never trust stored token payload for role)
    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: { manager: true },
    });
    if (!user) return next(new AppError('User no longer exists', 401));
    if (!user.isActive) return next(new AppError('This account has been deactivated', 401));

    // A manager silently refreshing shouldn't be able to keep their session
    // alive after a force-logout or expiry — re-check the lock, not just the
    // refresh token's own validity.
    let managerSessionToken: string | undefined;
    if (user.role === 'MANAGER' && user.manager) {
      const decoded = verifyRefreshToken(refreshToken);
      const lock = await prisma.managerPortalLock.findUnique({ where: { propertyId: user.manager.propertyId } });
      const now = new Date();
      const holdsLock = lock
        && lock.activeManagerId === user.manager.id
        && lock.sessionToken === decoded.managerSessionToken
        && lock.expiresAt && lock.expiresAt > now;

      if (!holdsLock) {
        return next(new AppError('Your Manager Portal session has ended. Please log in again.', 401));
      }
      managerSessionToken = lock.sessionToken!;
      await prisma.managerPortalLock.update({
        where: { propertyId: user.manager.propertyId },
        data: { lastActivityAt: now, expiresAt: new Date(now.getTime() + MANAGER_SESSION_IDLE_MS) },
      });
    }

    const newAccessToken = signAccessToken({ userId: storedToken.userId, role: user.role, ...(managerSessionToken ? { managerSessionToken } : {}) });
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

    if (req.user?.role === 'MANAGER' && req.user.managerId && req.user.propertyId) {
      await releaseManagerPortalLock(req.user.propertyId, req.user.managerId, req.user.managerSessionToken);
    }

    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const logoutAllDevices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (req.user?.role === 'MANAGER' && req.user.managerId && req.user.propertyId) {
      await releaseManagerPortalLock(req.user.propertyId, req.user.managerId, req.user.managerSessionToken);
    }

    await auditLog(userId, 'LOGOUT_ALL_DEVICES', 'User', userId);

    return sendSuccess(res, 200, 'Logged out of all devices');
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
      await prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: { push: token } }
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
            residentType: true,
            isPrimary: true,
            relationship: true,
            unit: { select: { unitNumber: true, tower: true, property: { select: { name: true } } } }
          }
        },
        guard: {
          select: {
            id: true,
            name: true,
            badgeNumber: true,
            isOnDuty: true,
            property: { select: { name: true } }
          }
        },
        manager: {
          select: {
            id: true,
            name: true,
            alertPreferences: true,
            property: { select: { name: true } }
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

export const updateMyManagerProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone } = req.body;

    if (name !== undefined) {
      await prisma.manager.update({ where: { userId: req.user!.userId }, data: { name } });
    }
    if (phone !== undefined) {
      try {
        await prisma.user.update({ where: { id: req.user!.userId }, data: { phone: phone || null } });
      } catch (err: any) {
        if (err.code === 'P2002') return next(new AppError('That phone number is already in use', 400));
        throw err;
      }
    }

    return sendSuccess(res, 200, 'Profile updated');
  } catch (err) { next(err); }
};

export const updateManagerAlertPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferences } = req.body;
    const manager = await prisma.manager.update({
      where: { userId: req.user!.userId },
      data: { alertPreferences: preferences },
    });
    return sendSuccess(res, 200, 'Alert preferences updated', manager.alertPreferences);
  } catch (err) { next(err); }
};

export const signupEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return next(new AppError('Email already in use', 400));
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedRole = role === 'MANAGER' ? 'MANAGER' : 'RESIDENT';

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: resolvedRole,
      }
    });

    if (resolvedRole === 'MANAGER') {
      const property = await prisma.property.findFirst();
      if (property) {
        await prisma.manager.create({
          data: {
            userId: user.id,
            propertyId: property.id,
            name: name || 'Admin',
          }
        });
      }
    }

    return sendSuccess(res, 201, 'Signup successful', { id: user.id, email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
};

export const loginEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { manager: true } });
    if (!user || !user.passwordHash) {
      return next(new AppError('Invalid email or password', 401));
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return next(new AppError('Invalid email or password', 401));
    }
    if (!user.isActive) {
      return next(new AppError('This account has been deactivated', 403));
    }

    // Managers get exactly one active Manager Portal session per property —
    // claim it atomically before issuing any tokens. If another manager
    // already holds it, the login is rejected outright (no tokens minted),
    // not just blocked on the next request.
    let managerSessionToken: string | undefined;
    if (user.role === 'MANAGER' && user.manager) {
      const token = await claimManagerPortalLock(user.manager.propertyId, user.manager.id);
      if (!token) {
        return next(new AppError('The Manager Portal is currently being used by another manager. Please try again later.', 409));
      }
      managerSessionToken = token;
    }

    // ponytail: Leave restriction enforced at backend auth layer, not frontend
    if (user.role === 'GUARD') {
      const guard = await prisma.guard.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (guard) {
        const now = new Date();
        const activeLeave = await prisma.guardLeave.findFirst({
          where: {
            guardId: guard.id,
            status: 'APPROVED',
            startDate: { lte: now },
            endDate: { gte: now },
          },
        });
        if (activeLeave) {
          const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          return next(new AppError(
            `You are currently on leave from ${fmt(activeLeave.startDate)} to ${fmt(activeLeave.endDate)}. You cannot access the Guard App during your leave period.`,
            403
          ));
        }
      }
    }

    const payload = { userId: user.id, role: user.role, ...(managerSessionToken ? { managerSessionToken } : {}) };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt: expiryDate }
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    
    return sendSuccess(res, 200, 'Login successful', {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};


export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Don't leak whether the email exists or not
      return sendSuccess(res, 200, 'If your email is registered, you will receive a reset code.');
    }
    
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 403));
    }
    
    const code = await createOTP(user.id, 'PASSWORD_RESET');
    
    const subject = 'Password Reset Code';
    const text = `Your password reset code is: ${code}. This code will expire in 10 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Use the following code:</p>
        <div style="font-size: 24px; font-weight: bold; padding: 10px; background-color: #f4f4f4; text-align: center; border-radius: 5px;">
          ${code}
        </div>
        <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `;
    
    await sendEmail(email, subject, text, html);
    await auditLog(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);
    
    return sendSuccess(res, 200, 'If your email is registered, you will receive a reset code.');
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return next(new AppError('Invalid email or code', 400));
    }
    
    const isValid = await verifyOTP(user.id, code, 'PASSWORD_RESET');
    if (!isValid) {
      return next(new AppError('Invalid or expired OTP', 400));
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    
    await auditLog(user.id, 'PASSWORD_RESET_SUCCESS', 'User', user.id);
    
    return sendSuccess(res, 200, 'Password has been successfully reset');
  } catch (error) {
    next(error);
  }
};
