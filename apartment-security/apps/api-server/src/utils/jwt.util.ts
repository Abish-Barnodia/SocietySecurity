import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  role: string;
  guardId?: string;
  propertyId?: string;
  residentId?: string;
}

export const signAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

export const signRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
};

// rotateRefreshToken verifies the old token and issues a new signed one.
// The DB revocation of the old token happens in auth.controller.ts inside a transaction.
export const rotateRefreshToken = async (oldToken: string): Promise<string> => {
  const { iat, exp, ...decoded } = verifyRefreshToken(oldToken) as any;
  return signRefreshToken(decoded);
};
