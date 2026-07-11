import { Router } from 'express';
import { getMessages, sendMessage, deleteMessage, votePoll, reactMessage, editMessage, pinMessage, uploadMedia } from './community.controller';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { getMessagesSchema, sendMessageSchema, votePollSchema, reactMessageSchema, editMessageSchema, pinMessageSchema } from './community.schema';

const router = Router();

router.use(authenticate);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../../../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/messages', validate(getMessagesSchema), getMessages);
router.post('/messages', validate(sendMessageSchema), sendMessage);
router.post('/messages/media', upload.single('media'), uploadMedia);
router.delete('/messages/:id', deleteMessage);
router.post('/messages/:id/vote', validate(votePollSchema), votePoll);
router.post('/messages/:id/react', validate(reactMessageSchema), reactMessage);
router.patch('/messages/:id', validate(editMessageSchema), editMessage);
router.post('/messages/:id/pin', validate(pinMessageSchema), pinMessage);

export default router;
