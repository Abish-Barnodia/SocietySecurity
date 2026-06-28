"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const guard_controller_1 = require("./guard.controller");
const guard_schema_1 = require("./guard.schema");
const router = (0, express_1.Router)();
exports.guardRouter = router;
router.use(auth_middleware_1.authenticate);
router.post('/shift/start', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(guard_schema_1.startShiftSchema), guard_controller_1.startShift);
router.post('/shift/end', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(guard_schema_1.endShiftSchema), guard_controller_1.endShift);
router.post('/post/checkin', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(guard_schema_1.checkInPostSchema), guard_controller_1.checkInPost);
//# sourceMappingURL=guard.routes.js.map