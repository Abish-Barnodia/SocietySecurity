"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offlineRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const offline_controller_1 = require("./offline.controller");
const offline_schema_1 = require("./offline.schema");
const router = (0, express_1.Router)();
exports.offlineRouter = router;
router.use(auth_middleware_1.authenticate);
// Guards can sync offline entries
router.post('/sync', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(offline_schema_1.syncOfflineEntriesSchema), offline_controller_1.syncOfflineEntries);
// Guards can pull down offline passes cache
router.get('/cache', (0, role_middleware_1.requireRole)('GUARD'), offline_controller_1.getPassCache);
//# sourceMappingURL=offline.routes.js.map