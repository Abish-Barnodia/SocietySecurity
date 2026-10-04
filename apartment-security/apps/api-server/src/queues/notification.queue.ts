import Queue from 'bull';
import { env } from '../config/env';
import { logger } from '../utils/logger.util';
import { sendPush as sendPushDirect } from '../utils/push.util';
import { sendEmail as sendEmailDirect, sendInvoiceEmail as sendInvoiceEmailDirect } from '../utils/email.service';

// ponytail: single resilient Bull queue for background notification & email workers
export const notificationQueue = new Queue('notifications', env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

notificationQueue.on('error', (err) => {
  logger.warn('Notification queue error (falling back if needed):', { err: err?.message || err });
});

// Worker: process push notifications
notificationQueue.process('send-push', 5, async (job) => {
  const { tokens, payload } = job.data;
  if (!tokens || !tokens.length) return;
  await sendPushDirect(tokens, payload);
});

// Worker: process general emails
notificationQueue.process('send-email', 5, async (job) => {
  const { to, subject, text, html, attachments } = job.data;
  await sendEmailDirect(to, subject, text, html, attachments);
});

// Worker: process maintenance invoice emails
notificationQueue.process('send-invoice-email', 3, async (job) => {
  const { opts } = job.data;
  // Convert base64 buffer back to Buffer if serialized
  if (opts.pdfBuffer && typeof opts.pdfBuffer === 'string') {
    opts.pdfBuffer = Buffer.from(opts.pdfBuffer, 'base64');
  } else if (opts.pdfBuffer?.data) {
    opts.pdfBuffer = Buffer.from(opts.pdfBuffer.data);
  }
  await sendInvoiceEmailDirect(opts);
});

// Dispatch helpers
export const queuePushNotification = async (tokens: string[], payload: any) => {
  try {
    await notificationQueue.add('send-push', { tokens, payload });
  } catch (err) {
    // If Redis is unavailable, fallback to direct execution without blocking callers
    logger.warn('Failed to enqueue push notification, executing directly:', { err });
    sendPushDirect(tokens, payload).catch((e) => logger.error('Direct push fallback failed:', { e }));
  }
};

export const queueEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string,
  attachments?: Array<{ filename: string; content?: any; path?: string; contentType?: string }>
) => {
  try {
    await notificationQueue.add('send-email', { to, subject, text, html, attachments });
  } catch (err) {
    logger.warn('Failed to enqueue email, executing directly:', { err });
    sendEmailDirect(to, subject, text, html, attachments).catch((e) => logger.error('Direct email fallback failed:', { e }));
  }
};

export const queueInvoiceEmail = async (opts: {
  to: string;
  residentName: string;
  societyName: string;
  unitNumber: string;
  tower?: string | null;
  amount: number;
  description: string;
  dueDate: Date | string;
  pdfBuffer: Buffer;
  invoiceId: string;
}) => {
  try {
    // Serialize Buffer for Redis storage
    const serializedOpts = {
      ...opts,
      pdfBuffer: opts.pdfBuffer.toString('base64'),
    };
    await notificationQueue.add('send-invoice-email', { opts: serializedOpts });
  } catch (err) {
    logger.warn('Failed to enqueue invoice email, executing directly:', { err });
    sendInvoiceEmailDirect(opts).catch((e) => logger.error('Direct invoice email fallback failed:', { e }));
  }
};
