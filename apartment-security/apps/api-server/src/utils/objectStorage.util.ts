import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';
import fs from 'fs';
import path from 'path';
import os from 'os';

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const isVirtual = /virtual|vbox|vmware|wsl|hyper-v|loopback|pseudo/i.test(name);
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual && !iface.address.startsWith('192.168.56.')) {
          return iface.address;
        }
        candidates.push(iface.address);
      }
    }
  }
  return candidates[0] || 'localhost';
};

// Uses Supabase's Storage REST API directly (already have axios + a Supabase
// project for the DB) rather than pulling in @supabase/supabase-js for one call.
export const uploadBuffer = async (buffer: Buffer, filePath: string, mimeType: string): Promise<string> => {
  const getHostUrl = () => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
      return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
    }
    if (env.API_URL && !env.API_URL.includes('localhost') && !env.API_URL.includes('127.0.0.1')) {
      return env.API_URL.replace(/\/api\/v1\/?$/, '');
    }
    // ponytail: only use local IP in dev — any other env (prod, staging) uses
    // the hardcoded Render URL so we never leak an internal IP to clients.
    if (env.NODE_ENV === 'development') {
      return `http://${getLocalIp()}:${env.PORT}`;
    }
    return 'https://societysecurity.onrender.com';
  };

  // Sanitize path against directory traversal
  const sanitizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '').replace(/\\/g, '/');

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fullPath = path.join(uploadsDir, sanitizedPath);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
    return `${getHostUrl()}/uploads/${sanitizedPath}`;
  }

  try {
    await axios.post(
      `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${sanitizedPath}`,
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

    return `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${sanitizedPath}`;
  } catch (err) {
    console.warn('Supabase storage upload failed, falling back to local file storage:', err);
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fullPath = path.join(uploadsDir, sanitizedPath);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
    return `${getHostUrl()}/uploads/${sanitizedPath}`;
  }
};
