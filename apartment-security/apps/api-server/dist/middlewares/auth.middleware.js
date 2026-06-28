"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_util_1 = require("../utils/jwt.util");
const error_middleware_1 = require("./error.middleware");
const authenticate = (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return next(new error_middleware_1.AppError('You are not logged in. Please log in to get access.', 401));
        }
        const decoded = (0, jwt_util_1.verifyAccessToken)(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        return next(new error_middleware_1.AppError('Invalid or expired token', 401));
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.middleware.js.map