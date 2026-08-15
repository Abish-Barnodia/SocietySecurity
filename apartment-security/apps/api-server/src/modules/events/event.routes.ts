import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireManagerPermission } from '../../middlewares/managerPermission.middleware';
import { getEvents, rsvpEvent, createEvent, updateEvent } from './event.controller';

const router = Router();
router.use(authenticate);
router.use(requireManagerPermission('events'));

// Resident routes
router.get('/', requireRole('RESIDENT', 'MANAGER', 'COMMITTEE'), getEvents);
router.post('/:id/rsvp', requireRole('RESIDENT'), rsvpEvent);

// Manager routes
router.post('/', requireRole('MANAGER', 'COMMITTEE'), createEvent);
router.put('/:id', requireRole('MANAGER', 'COMMITTEE'), updateEvent);

export { router as eventRouter };
