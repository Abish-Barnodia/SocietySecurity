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
// Resident responds
router.post('/:id/respond', (0, role_middleware_1.requireRole)('RESIDENT'), (0, validate_middleware_1.validate)(walkin_schema_1.respondWalkinSchema), walkin_controller_1.respondWalkin);
//# sourceMappingURL=walkin.routes.js.map