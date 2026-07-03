import { Router } from 'express';

const router = Router();

// Mock endpoints for announcements / broadcasts
router.get('/announcements', (req, res) => {
  res.json({ message: "List of announcements" });
});

router.post('/announcements', (req, res) => {
  res.json({ message: "Announcement created" });
});

export default router;
