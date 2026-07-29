import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  logEntry,
  logExit,
  getUnitEntries,
  getAllEntries,
  getEntryPoints
} from './entry.controller';
import {
  logEntrySchema,
  logExitSchema
} from './entry.schema';

const router = Router();
router.use(authenticate);

// Gate list — used by guards to log entries and residents/guards to display gate names
router.get('/entry-points', requireRole('GUARD', 'RESIDENT'), getEntryPoints);

// Guard logging
router.post('/',           requireRole('GUARD'), validate(logEntrySchema), logEntry);
router.put('/:id/exit',    requireRole('GUARD'), validate(logExitSchema), logExit);

// Resident viewing
router.get('/',            requireRole('RESIDENT'), getUnitEntries);

// Manager / Committee viewing
router.get('/all',         requireRole('MANAGER', 'COMMITTEE'), getAllEntries);

export { router as entryRouter };
