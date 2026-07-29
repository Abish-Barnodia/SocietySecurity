"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_util_1 = require("../utils/jwt.util");
const error_middleware_1 = require("./error.middleware");
const prisma_1 = require("../config/prisma");
const authenticate = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return next(new error_middleware_1.AppError('You are not logged in. Please log in to get access.', 401));
        }
        const decoded = (0, jwt_util_1.verifyAccessToken)(token);
        // Validate user still exists and is active
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                resident: { include: { unit: true } },
                guard: true,
                manager: true,
                committee: true,
            }
        });
        if (!user || !user.isActive) {
            return next(new error_middleware_1.AppError('The user belonging to this token no longer exists or is deactivated.', 401));
        }
        let propertyId;
        if (user.resident)
            propertyId = user.resident.unit.propertyId;
        else if (user.guard)
            propertyId = user.guard.propertyId;
        else if (user.manager)
            propertyId = user.manager.propertyId;
        else if (user.committee)
            propertyId = user.committee.propertyId;
        // Also include residentId if resident
        let residentId;
        if (user.resident)
            residentId = user.resident.id;
        req.user = {
            ...decoded,
            propertyId,
            residentId,
        };
        next();
    }
    catch (error) {
        return next(new error_middleware_1.AppError('Invalid or expired token', 401));
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.middleware.js.map