"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehicleRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const vehicle_controller_1 = require("./vehicle.controller");
const vehicle_schema_1 = require("./vehicle.schema");
const router = (0, express_1.Router)();
exports.vehicleRouter = router;
router.use(auth_middleware_1.authenticate);
// Resident registers a vehicle
router.post('/', (0, role_middleware_1.requireRole)('RESIDENT'), (0, validate_middleware_1.validate)(vehicle_schema_1.registerVehicleSchema), vehicle_controller_1.registerVehicle);
// Guard checks a vehicle
router.get('/:registrationNo', (0, role_middleware_1.requireRole)('GUARD'), (0, validate_middleware_1.validate)(vehicle_schema_1.checkVehicleSchema), vehicle_controller_1.checkVehicle);
//# sourceMappingURL=vehicle.routes.js.map