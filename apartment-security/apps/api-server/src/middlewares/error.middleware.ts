import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.util';
import { sendError } from '../utils/response.util';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    logger.error(err.stack);
  } else {
    logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  if (err.name === 'ZodError' || err.issues || err.errors) {
    return sendError(res, 400, 'Validation Error', err.errors || err.issues);
  }
  
  if (err.name === 'PrismaClientKnownRequestError') {
     // Handle specific Prisma errors like unique constraint violations
     if (err.code === 'P2002') {
         const target = (err.meta as any)?.target;
         let message = 'Duplicate record found';
         if (target && Array.isArray(target)) {
             message = `A record with this ${target.join(', ')} already exists.`;
         }
         return sendError(res, 409, message);
     }
  }

  if (err.isOperational) {
    return sendError(res, err.statusCode, err.message);
  }

  // Programming or other unknown error: don't leak error details in prod, but we're debugging
  return sendError(res, 500, `Internal Server Error: ${err.message}`, { stack: err.stack, name: err.name });
};
