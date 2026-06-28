import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  getAmenities,
  bookAmenity,
  cancelBooking
} from './amenity.controller';
import {
  bookAmenitySchema
} from './amenity.schema';

const router = Router();
router.use(authenticate);

// Residents can view amenities
router.get('/', requireRole('RESIDENT'), getAmenities);

// Residents can book
router.post('/book', requireRole('RESIDENT'), validate(bookAmenitySchema), bookAmenity);

// Residents can cancel their own booking
router.post('/:id/cancel', requireRole('RESIDENT'), cancelBooking);

export { router as amenityRouter };
