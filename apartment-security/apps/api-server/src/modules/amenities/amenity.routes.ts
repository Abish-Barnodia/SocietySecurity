import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  getAmenities,
  createAmenity,
  updateAmenity,
  bookAmenity,
  cancelBooking
} from './amenity.controller';
import {
  createAmenitySchema,
  updateAmenitySchema,
  bookAmenitySchema
} from './amenity.schema';

const router = Router();
router.use(authenticate);

// Residents view bookable amenities; managers view/manage the full list
router.get('/', requireRole('RESIDENT', 'MANAGER', 'COMMITTEE'), getAmenities);
router.post('/', requireRole('MANAGER', 'COMMITTEE'), validate(createAmenitySchema), createAmenity);
router.put('/:id', requireRole('MANAGER', 'COMMITTEE'), validate(updateAmenitySchema), updateAmenity);

// Residents can book
router.post('/book', requireRole('RESIDENT'), validate(bookAmenitySchema), bookAmenity);

// Residents can cancel their own booking
router.post('/:id/cancel', requireRole('RESIDENT'), cancelBooking);

export { router as amenityRouter };
