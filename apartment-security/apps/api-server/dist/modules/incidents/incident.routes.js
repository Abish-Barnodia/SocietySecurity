"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incidentRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const incident_controller_1 = require("./incident.controller");
const incident_schema_1 = require("./incident.schema");
const router = (0, express_1.Router)();
exports.incidentRouter = router;
router.use(auth_middleware_1.authenticate);
// Guard creates an incident
router.post('/', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(incident_schema_1.createIncidentSchema), incident_controller_1.createIncident);
// Manager / Committee assigns incident
router.post('/:id/assign', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE'), (0, validate_middleware_1.validate)(incident_schema_1.assignIncidentSchema), incident_controller_1.assignIncident);
// Manager / Committee / Guard escalates incident
router.post('/:id/escalate', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE', 'GUARD'), (0, validate_middleware_1.validate)(incident_schema_1.escalateIncidentSchema), incident_controller_1.escalateIncident);
// Manager / Committee closes incident
router.post('/:id/close', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE'), (0, validate_middleware_1.validate)(incident_schema_1.closeIncidentSchema), incident_controller_1.closeIncident);
//# sourceMappingURL=incident.routes.js.map