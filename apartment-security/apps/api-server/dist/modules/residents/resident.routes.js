"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const resident_controller_1 = require("./resident.controller");
const resident_schema_1 = require("./resident.schema");
const router = (0, express_1.Router)();
exports.residentRouter = router;
router.use(auth_middleware_1.authenticate);
// Resident self-service
router.get('/me', (0, role_middleware_1.requireRole)('RESIDENT'), resident_controller_1.getMyProfile);
router.put('/me', (0, role_middleware_1.requireRole)('RESIDENT'), (0, validate_middleware_1.validate)(resident_schema_1.updateProfileSchema), resident_controller_1.updateMyProfile);
router.put('/me/alerts', (0, role_middleware_1.requireRole)('RESIDENT'), (0, validate_middleware_1.validate)(resident_schema_1.alertPreferencesSchema), resident_controller_1.updateAlertPreferences);
router.get('/unit', (0, role_middleware_1.requireRole)('RESIDENT'), resident_controller_1.getUnitResidents);
router.post('/unit/members', (0, role_middleware_1.requireRole)('RESIDENT'), resident_controller_1.addHouseholdMember);
router.delete('/unit/members/:memberId', (0, role_middleware_1.requireRole)('RESIDENT'), resident_controller_1.removeHouseholdMember);
// Manager operations
router.get('/', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE'), resident_controller_1.getAllResidents);
router.post('/', (0, role_middleware_1.requireRole)('MANAGER'), (0, validate_middleware_1.validate)(resident_schema_1.onboardResidentSchema), resident_controller_1.onboardResident);
router.delete('/:id', (0, role_middleware_1.requireRole)('MANAGER'), resident_controller_1.deactivateResident);
router.get('/:id/summary', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE'), resident_controller_1.getUnitSummary);
//# sourceMappingURL=resident.routes.js.map