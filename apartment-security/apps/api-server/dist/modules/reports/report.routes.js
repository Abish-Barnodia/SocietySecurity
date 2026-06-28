"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const report_controller_1 = require("./report.controller");
const router = (0, express_1.Router)();
exports.reportRouter = router;
router.use(auth_middleware_1.authenticate);
// Managers and Committee can view operations overview
router.get('/overview', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE'), report_controller_1.getOperationsOverview);
// Managers can generate monthly reports
router.get('/monthly', (0, role_middleware_1.requireRole)('MANAGER'), report_controller_1.generateMonthlyReport);
//# sourceMappingURL=report.routes.js.map