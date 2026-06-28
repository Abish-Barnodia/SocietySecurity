import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  registerVehicle,
  checkVehicle
} from './vehicle.controller';
import {
  registerVehicleSchema,
  checkVehicleSchema
} from './vehicle.schema';

const router = Router();
router.use(authenticate);

// Resident registers a vehicle
router.post('/', requireRole('RESIDENT'), validate(registerVehicleSchema), registerVehicle);

// Guard checks a vehicle
router.get('/:registrationNo', requireRole('GUARD'), validate(checkVehicleSchema), checkVehicle);

export { router as vehicleRouter };
