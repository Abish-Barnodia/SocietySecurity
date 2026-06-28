"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const error_middleware_1 = require("./error.middleware");
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new error_middleware_1.AppError('You are not logged in.', 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new error_middleware_1.AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=role.middleware.js.map