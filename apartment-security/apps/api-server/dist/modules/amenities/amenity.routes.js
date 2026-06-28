"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.amenityRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const amenity_controller_1 = require("./amenity.controller");
const amenity_schema_1 = require("./amenity.schema");
const router = (0, express_1.Router)();
exports.amenityRouter = router;
router.use(auth_middleware_1.authenticate);
// Residents can view amenities
router.get('/', (0, role_middleware_1.requireRole)('RESIDENT'), amenity_controller_1.getAmenities);
// Residents can book
router.post('/book', (0, role_middleware_1.requireRole)('RESIDENT'), (0, validate_middleware_1.validate)(amenity_schema_1.bookAmenitySchema), amenity_controller_1.bookAmenity);
// Residents can cancel their own booking
router.post('/:id/cancel', (0, role_middleware_1.requireRole)('RESIDENT'), amenity_controller_1.cancelBooking);
//# sourceMappingURL=amenity.routes.js.map