import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  const hasAuth = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  // Without credentials, connecting to smtp.ethereal.email is guaranteed to
  // fail (or hang until the client times out) — that's what was surfacing as
  // a generic "please try again" on password reset with no real cause shown.
  // Log-and-skip in every environment instead of only outside production.
  if (!hasAuth) {
    console.warn('\n=== EMAIL NOT SENT (Missing SMTP credentials) ===');
    console.warn(`To: ${to}`);
    console.warn(`Subject: ${subject}`);
    console.warn(`Text: ${text}`);
    console.warn('=================================================\n');
    return { messageId: 'mock-id' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    ...(hasAuth ? {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    } : {})
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Apartment Security" <noreply@example.com>',
    to,
    subject,
    text,
    html: html || text,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Message sent: %s', info.messageId);
  return info;
};

export const sendVerificationEmail = async (to: string, otp: string) => {
  const subject = 'Verify your email address';
  const text = `Your email verification code is: ${otp}. This code will expire in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Email Verification</h2>
      <p>Thank you for signing up. Please use the following OTP to verify your email address:</p>
      <div style="font-size: 24px; font-weight: bold; padding: 10px; background-color: #f4f4f4; text-align: center; border-radius: 5px;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
    </div>
  `;
  return sendEmail(to, subject, text, html);
};
