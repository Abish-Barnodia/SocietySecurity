import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger.util';
import { prisma } from '../config/prisma';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const sendSMS = async (to: string, body: string) => {
  try {
    if (env.NODE_ENV === 'test') return;

    if (env.SMTP_USER && env.SMTP_PASS) {
      // Find the user by phone number to get their email address
      const user = await prisma.user.findUnique({ where: { phone: to } });
      
      // If user has no email, fallback to sending the email to the SMTP_USER itself for testing
      const targetEmail = user?.email || env.SMTP_USER;

      await transporter.sendMail({
        from: `"Apartment Security" <${env.SMTP_USER}>`,
        to: targetEmail,
        subject: 'Security Alert / OTP',
        text: `(This message was originally an SMS intended for ${to})\n\n${body}`,
      });
      
      logger.info(`📧 Email successfully sent to ${targetEmail} in place of SMS.`);
    } else {
      // MOCK MODE: Print to terminal instead of sending anything
      logger.info(`\n📱 [MOCK SMS to ${to}]:\n${body}\n`);
    }
  } catch (err) {
    logger.error('Message send failed', { to, err });
    // Do not throw — failure should never crash the main flow
  }
};
