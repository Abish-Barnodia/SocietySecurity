"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeIncident = exports.escalateIncident = exports.assignIncident = exports.createIncident = void 0;
const prisma_1 = require("../../config/prisma");
const response_util_1 = require("../../utils/response.util");
const error_middleware_1 = require("../../middlewares/error.middleware");
const alert_util_1 = require("../../utils/alert.util");
const audit_util_1 = require("../../utils/audit.util");
const server_1 = require("../../server");
const createIncident = async (req, res, next) => {
    try {
        const { type, description, location, photoUrls, vehicleNumber, unitId } = req.body;
        const guardId = req.user.guardId;
        const guard = await prisma_1.prisma.guard.findUnique({ where: { id: guardId } });
        if (!guard)
            return next(new error_middleware_1.AppError('Guard not found', 404));
        const incident = await prisma_1.prisma.incident.create({
            data: {
                propertyId: guard.propertyId,
                guardId,
                unitId,
                type,
                description,
                location,
                photoUrls: photoUrls ?? [],
                vehicleNumber,
                status: 'OPEN',
            },
        });
        // Create first timeline action
        await prisma_1.prisma.incidentAction.create({
            data: {
                incidentId: incident.id,
                actorId: req.user.userId,
                actorRole: 'GUARD',
                action: 'INCIDENT_LOGGED',
                note: description,
            },
        });
        // Alert managers with P2
        await (0, alert_util_1.triggerAlert)({
            priority: 'P2',
            title: `Incident: ${type.replace(/_/g, ' ')}`,
            body: `Logged by guard at ${location}. ${description.slice(0, 80)}`,
            targetRoles: ['MANAGER'],
            incidentId: incident.id,
            propertyId: guard.propertyId,
        });
        server_1.io?.to(`property:${guard.propertyId}`).emit('incident:new', {
            incidentId: incident.id,
            type,
            location,
            guardId,
        });
        (0, response_util_1.sendSuccess)(res, 201, 'Incident logged', incident);
    }
    catch (err) {
        next(err);
    }
};
exports.createIncident = createIncident;
const assignIncident = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { assignedTo, note } = req.body;
        const incident = await prisma_1.prisma.incident.findUnique({ where: { id } });
        // Authorization
        if (!incident)
            return next(new error_middleware_1.AppError('Incident not found', 404));
        const updated = await prisma_1.prisma.incident.update({
            where: { id },
            data: { assignedTo, assignedAt: new Date(), status: 'IN_PROGRESS' },
        });
        await prisma_1.prisma.incidentAction.create({
            data: {
                incidentId: id,
                actorId: req.user.userId,
                actorRole: req.user.role,
                action: 'ASSIGNED',
                note,
            },
        });
        // Notify the assigned guard
        const assignee = await prisma_1.prisma.guard.findUnique({
            where: { id: assignedTo },
            include: { user: { select: { fcmTokens: true } } },
        });
        if (assignee?.user.fcmTokens.length) {
            const { sendPush } = await Promise.resolve().then(() => __importStar(require('../../utils/push.util')));
            await sendPush(assignee.user.fcmTokens, {
                title: 'Incident assigned to you',
                body: `${incident.type.replace(/_/g, ' ')} at ${incident.location}`,
                data: { type: 'INCIDENT_ASSIGNMENT', incidentId: id },
            });
        }
        (0, response_util_1.sendSuccess)(res, 200, 'Incident assigned', updated);
    }
    catch (err) {
        next(err);
    }
};
exports.assignIncident = assignIncident;
const escalateIncident = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { note } = req.body;
        const incident = await prisma_1.prisma.incident.findUnique({ where: { id } });
        if (!incident)
            return next(new error_middleware_1.AppError('Incident not found', 404));
        await prisma_1.prisma.incidentAction.create({
            data: {
                incidentId: id,
                actorId: req.user.userId,
                actorRole: req.user.role,
                action: 'ESCALATED_TO_P1',
                note,
            },
        });
        await (0, alert_util_1.triggerAlert)({
            priority: 'P1',
            title: 'Incident escalated to P1',
            body: `${incident.type.replace(/_/g, ' ')} at ${incident.location}. ${note ?? ''}`,
            targetRoles: ['MANAGER', 'COMMITTEE'],
            incidentId: id,
            propertyId: incident.propertyId,
        });
        (0, response_util_1.sendSuccess)(res, 200, 'Incident escalated to P1');
    }
    catch (err) {
        next(err);
    }
};
exports.escalateIncident = escalateIncident;
const closeIncident = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { resolutionNote } = req.body;
        const incident = await prisma_1.prisma.incident.findUnique({ where: { id } });
        if (!incident)
            return next(new error_middleware_1.AppError('Incident not found', 404));
        if (incident.status === 'CLOSED')
            return next(new error_middleware_1.AppError('Already closed', 400));
        const updated = await prisma_1.prisma.incident.update({
            where: { id },
            data: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user.userId, resolutionNote },
        });
        await prisma_1.prisma.incidentAction.create({
            data: {
                incidentId: id,
                actorId: req.user.userId,
                actorRole: req.user.role,
                action: 'CLOSED',
                note: resolutionNote,
            },
        });
        await (0, audit_util_1.auditLog)(req.user.userId, 'CLOSE_INCIDENT', 'Incident', id);
        (0, response_util_1.sendSuccess)(res, 200, 'Incident closed', updated);
    }
    catch (err) {
        next(err);
    }
};
exports.closeIncident = closeIncident;
//# sourceMappingURL=incident.controller.js.map