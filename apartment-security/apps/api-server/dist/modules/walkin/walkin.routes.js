"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkinRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const walkin_controller_1 = require("./walkin.controller");
const walkin_schema_1 = require("./walkin.schema");
const router = (0, express_1.Router)();
exports.walkinRouter = router;
router.use(auth_middleware_1.authenticate);
// Guard initiates walkin request
router.post('/request', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(walkin_schema_1.requestWalkinSchema), walkin_controller_1.requestWalkin);
// Get pending walkins (for Dashboard/Guard)
router.get('/pending', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE', 'GUARD'), walkin_controller_1.getPendingWalkins);
// Resident responds
router.post('/:id/respond', (0, role_middleware_1.requireRole)('RESIDENT'), (0, validate_middleware_1.validate)(walkin_schema_1.respondWalkinSchema), walkin_controller_1.respondWalkin);
// Guard calls the resident after their approval window timed out
router.post('/:id/call-resident', (0, role_middleware_1.requireRole)('GUARD'), walkin_controller_1.callResident);
// Resident fetches a single entry/walkin by entry id (for notification tap-through)
router.get('/:id', (0, role_middleware_1.requireRole)('RESIDENT'), walkin_controller_1.getWalkin);
//# sourceMappingURL=walkin.routes.js.map