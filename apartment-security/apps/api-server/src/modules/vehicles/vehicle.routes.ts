import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  registerVehicle,
  checkVehicle,
  getParkingSummary,
  getVehicleLog,
  updateParkingCapacity,
  getParkingSlots
} from './vehicle.controller';
import {
  registerVehicleSchema,
  checkVehicleSchema,
  updateParkingCapacitySchema
} from './vehicle.schema';

const router = Router();
router.use(authenticate);

// Manager: parking occupancy dashboard + full vehicle entry/exit log
router.get('/parking/summary', requireRole('MANAGER', 'COMMITTEE'), getParkingSummary);
router.get('/parking/log', requireRole('MANAGER', 'COMMITTEE'), getVehicleLog);
router.get('/parking/slots', requireRole('MANAGER', 'COMMITTEE'), getParkingSlots);
router.put('/parking/capacity', requireRole('MANAGER'), validate(updateParkingCapacitySchema), updateParkingCapacity);

// Resident registers a vehicle
router.post('/', requireRole('RESIDENT'), validate(registerVehicleSchema), registerVehicle);

// Guard checks a vehicle
router.get('/:registrationNo', requireRole('GUARD'), validate(checkVehicleSchema), checkVehicle);

export { router as vehicleRouter };
