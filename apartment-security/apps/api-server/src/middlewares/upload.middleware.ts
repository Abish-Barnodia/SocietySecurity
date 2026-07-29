import multer from 'multer';

// Shared in-memory multer instance for any module that needs to accept a
// file upload and push it to Firebase Storage via utils/firebaseStorage.util.ts.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});
