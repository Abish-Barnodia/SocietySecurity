import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createIncident,
  assignIncident,
  escalateIncident,
  closeIncident
} from './incident.controller';
import {
  createIncidentSchema,
  assignIncidentSchema,
  escalateIncidentSchema,
  closeIncidentSchema
} from './incident.schema';

const router = Router();
router.use(authenticate);

// Guard creates an incident
router.post('/', requireRole('GUARD'), validate(createIncidentSchema), createIncident);

// Manager / Committee assigns incident
router.post('/:id/assign', requireRole('MANAGER', 'COMMITTEE'), validate(assignIncidentSchema), assignIncident);

// Manager / Committee / Guard escalates incident
router.post('/:id/escalate', requireRole('MANAGER', 'COMMITTEE', 'GUARD'), validate(escalateIncidentSchema), escalateIncident);

// Manager / Committee closes incident
router.post('/:id/close', requireRole('MANAGER', 'COMMITTEE'), validate(closeIncidentSchema), closeIncident);

export { router as incidentRouter };
