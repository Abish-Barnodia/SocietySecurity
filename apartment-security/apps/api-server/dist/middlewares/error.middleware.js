"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const logger_util_1 = require("../utils/logger.util");
const response_util_1 = require("../utils/response.util");
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    if (process.env.NODE_ENV === 'development') {
        logger_util_1.logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        logger_util_1.logger.error(err.stack);
    }
    else {
        logger_util_1.logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    }
    if (err.name === 'ZodError') {
        return (0, response_util_1.sendError)(res, 400, 'Validation Error', err.errors);
    }
    if (err.name === 'PrismaClientKnownRequestError') {
        // Handle specific Prisma errors like unique constraint violations
        if (err.code === 'P2002') {
            return (0, response_util_1.sendError)(res, 409, 'Duplicate record found');
        }
    }
    if (err.isOperational) {
        return (0, response_util_1.sendError)(res, err.statusCode, err.message);
    }
    // Programming or other unknown error: don't leak error details
    return (0, response_util_1.sendError)(res, 500, 'Something went very wrong!');
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.middleware.js.map