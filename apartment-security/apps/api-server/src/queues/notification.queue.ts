import Queue from 'bull';
import { env } from '../config/env';
import { logger } from '../utils/logger.util';
import { sendPush as sendPushDirect } from '../utils/push.util';
import { sendEmail as sendEmailDirect, sendInvoiceEmail as sendInvoiceEmailDirect } from '../utils/email.service';

const shouldEnableQueue = !!(process.env.REDIS_URL || env.NODE_ENV === 'development');

let queueInstance: Queue.Queue | null = null;

if (shouldEnableQueue) {
  try {
    queueInstance = new Queue('notifications', env.REDIS_URL || 'redis://localhost:6379', {
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

    queueInstance.on('error', (err) => {
      logger.warn('Notification queue error (falling back to direct dispatch):', { err: err?.message || err });
    });

    // Worker: process push notifications
    queueInstance.process('send-push', 5, async (job) => {
      const { tokens, payload } = job.data;
      if (!tokens || !tokens.length) return;
      await sendPushDirect(tokens, payload);
    });

    // Worker: process general emails
    queueInstance.process('send-email', 5, async (job) => {
      const { to, subject, text, html, attachments } = job.data;
      await sendEmailDirect(to, subject, text, html, attachments);
    });

    // Worker: process maintenance invoice emails
    queueInstance.process('send-invoice-email', 3, async (job) => {
      const { opts } = job.data;
      if (opts.pdfBuffer && typeof opts.pdfBuffer === 'string') {
        opts.pdfBuffer = Buffer.from(opts.pdfBuffer, 'base64');
      } else if (opts.pdfBuffer?.data) {
        opts.pdfBuffer = Buffer.from(opts.pdfBuffer.data);
      }
      await sendInvoiceEmailDirect(opts);
    });
  } catch (err: any) {
    logger.warn('Failed to initialize Bull notification queue, using direct dispatch mode:', { err: err?.message || err });
    queueInstance = null;
  }
}

export const notificationQueue = queueInstance;

// Dispatch helpers
export const queuePushNotification = async (tokens: string[], payload: any) => {
  if (!queueInstance) {
    return sendPushDirect(tokens, payload).catch((e) => logger.error('Direct push fallback failed:', { e }));
  }
  try {
    await queueInstance.add('send-push', { tokens, payload });
  } catch (err) {
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
  if (!queueInstance) {
    return sendEmailDirect(to, subject, text, html, attachments).catch((e) => logger.error('Direct email fallback failed:', { e }));
  }
  try {
    await queueInstance.add('send-email', { to, subject, text, html, attachments });
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
  if (!queueInstance) {
    return sendInvoiceEmailDirect(opts).catch((e) => logger.error('Direct invoice email fallback failed:', { e }));
  }
  try {
    // Serialize Buffer for Redis storage
    const serializedOpts = {
      ...opts,
      pdfBuffer: opts.pdfBuffer.toString('base64'),
    };
    await queueInstance.add('send-invoice-email', { opts: serializedOpts });
  } catch (err) {
    logger.warn('Failed to enqueue invoice email, executing directly:', { err });
    sendInvoiceEmailDirect(opts).catch((e) => logger.error('Direct invoice email fallback failed:', { e }));
  }
};
