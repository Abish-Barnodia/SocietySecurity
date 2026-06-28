"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const alert_controller_1 = require("./alert.controller");
const alert_schema_1 = require("./alert.schema");
const router = (0, express_1.Router)();
exports.alertRouter = router;
router.use(auth_middleware_1.authenticate);
// Manager / Committee / Guard broadcasts an alert
router.post('/broadcast', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE', 'GUARD'), (0, validate_middleware_1.validate)(alert_schema_1.createAlertSchema), alert_controller_1.broadcastAlert);
// Anyone can trigger a silent duress alert
router.post('/duress', (0, validate_middleware_1.validate)(alert_schema_1.triggerDuressSchema), alert_controller_1.triggerDuress);
// Anyone can fetch their relevant alerts
router.get('/', alert_controller_1.getAlerts);
//# sourceMappingURL=alert.routes.js.map