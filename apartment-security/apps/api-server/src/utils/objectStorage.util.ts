import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';

// Uses Supabase's Storage REST API directly (already have axios + a Supabase
// project for the DB) rather than pulling in @supabase/supabase-js for one call.
export const uploadBuffer = async (buffer: Buffer, path: string, mimeType: string): Promise<string> => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // ponytail: Mock storage so dev continues smoothly without setting up Supabase buckets
    console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Returning mock image URL.');
    return 'https://placehold.co/600x400/png?text=Storage+Not+Configured';
  }

  try {
    await axios.post(
      `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${path}`,
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

    return `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
  } catch (err) {
    // A raw HTTP/SDK error (e.g. the bucket doesn't exist or isn't public)
    // would otherwise surface to the client as an opaque 500 — every caller
    // here is a photo upload a human is waiting on, so give them something actionable.
    throw new AppError('Photo upload failed — storage is not set up correctly on the server', 503);
  }
};
