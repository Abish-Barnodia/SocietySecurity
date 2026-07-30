import multer from 'multer';

// Shared in-memory multer instance for any module that needs to accept a
// file upload and push it to storage via utils/objectStorage.util.ts.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});
