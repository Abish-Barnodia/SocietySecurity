"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
const prisma_1 = require("../config/prisma");
const logger_util_1 = require("./logger.util");
const auditLog = async (userId, action, entity, entityId, before, after, ipAddress, userAgent) => {
    try {
        await prisma_1.prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                before: before ? before : undefined,
                after: after ? after : undefined,
                ipAddress,
                userAgent,
            },
        });
    }
    catch (error) {
        // We don't want audit log failures to crash the main request, just log it.
        logger_util_1.logger.error('Failed to create audit log:', error);
    }
};
exports.auditLog = auditLog;
//# sourceMappingURL=audit.util.js.map