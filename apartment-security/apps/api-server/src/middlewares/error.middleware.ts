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

  if (err.name === 'ZodError') {
    return sendError(res, 400, 'Validation Error', err.errors);
  }
  
  if (err.name === 'PrismaClientKnownRequestError') {
     // Handle specific Prisma errors like unique constraint violations
     if (err.code === 'P2002') {
         return sendError(res, 409, 'Duplicate record found');
     }
  }

  if (err.isOperational) {
    return sendError(res, err.statusCode, err.message);
  }

  // Programming or other unknown error: don't leak error details
  return sendError(res, 500, 'Something went very wrong!');
};
