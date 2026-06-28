"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entryRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const entry_controller_1 = require("./entry.controller");
const entry_schema_1 = require("./entry.schema");
const router = (0, express_1.Router)();
exports.entryRouter = router;
router.use(auth_middleware_1.authenticate);
// Guard logging
router.post('/', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(entry_schema_1.logEntrySchema), entry_controller_1.logEntry);
router.put('/:id/exit', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(entry_schema_1.logExitSchema), entry_controller_1.logExit);
// Resident viewing
router.get('/', (0, role_middleware_1.requireRole)('RESIDENT'), entry_controller_1.getUnitEntries);
// Manager / Committee viewing
router.get('/all', (0, role_middleware_1.requireRole)('MANAGER', 'COMMITTEE'), entry_controller_1.getAllEntries);
//# sourceMappingURL=entry.routes.js.map