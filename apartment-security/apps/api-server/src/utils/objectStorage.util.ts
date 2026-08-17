import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';
import fs from 'fs';
import path from 'path';
import os from 'os';

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

// Uses Supabase's Storage REST API directly (already have axios + a Supabase
// project for the DB) rather than pulling in @supabase/supabase-js for one call.
export const uploadBuffer = async (buffer: Buffer, filePath: string, mimeType: string): Promise<string> => {
  const getHostUrl = () => {
    const rawUrl = env.API_URL || `http://${getLocalIp()}:${env.PORT}`;
    return rawUrl.replace(/\/api\/v1\/?$/, '');
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fullPath = path.join(uploadsDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    return `${getHostUrl()}/uploads/${filePath}`;
  }

  try {
    await axios.post(
      `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${filePath}`,
      buffer,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
      }
    );

    return `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${filePath}`;
  } catch (err) {
    console.warn('Supabase storage upload failed, falling back to local file storage:', err);
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fullPath = path.join(uploadsDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    return `${getHostUrl()}/uploads/${filePath}`;
  }
};
