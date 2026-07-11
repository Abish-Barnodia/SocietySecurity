"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const pass_controller_1 = require("./pass.controller");
const pass_schema_1 = require("./pass.schema");
const router = (0, express_1.Router)();
exports.passRouter = router;
router.use(auth_middleware_1.authenticate);
router.post('/', (0, role_middleware_1.requireRole)('RESIDENT'), (0, validate_middleware_1.validate)(pass_schema_1.createPassSchema), pass_controller_1.createPass);
router.get('/', (0, role_middleware_1.requireRole)('RESIDENT'), pass_controller_1.getMyPasses);
router.put('/:id/suspend', (0, role_middleware_1.requireRole)('RESIDENT'), pass_controller_1.suspendPass);
router.put('/:id/revoke', (0, role_middleware_1.requireRole)('RESIDENT', 'MANAGER'), pass_controller_1.revokePass);
router.delete('/:id', (0, role_middleware_1.requireRole)('RESIDENT'), pass_controller_1.deletePass);
// Manager / Committee
router.get('/all', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE'), pass_controller_1.getAllPasses);
// Guard
router.get('/verify/:id', (0, role_middleware_1.requireRole)('GUARD', 'MANAGER'), pass_controller_1.verifyPass);
//# sourceMappingURL=pass.routes.js.map