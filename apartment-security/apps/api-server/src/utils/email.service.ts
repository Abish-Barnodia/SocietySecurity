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

export const sendPasswordResetEmail = async (to: string, otp: string) => {
  const subject = '🔐 Password Reset Code - Society Security';
  const text = `Your password reset verification code is: ${otp}. This code will expire in 10 minutes. If you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #00A67C, #00C896); padding: 20px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 22px;">Reset Your Password</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Society Security Portal</p>
      </div>

      <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; text-align: center;">
        <p style="margin-top: 0; font-size: 15px; color: #334155;">
          You requested to reset your account password. Use the following 6-digit verification code:
        </p>

        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 16px; background-color: #f0fdf4; color: #00A67C; text-align: center; border-radius: 8px; border: 1px dashed #00C896; margin: 20px 0;">
          ${otp}
        </div>

        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
          ⏰ This code will expire in <strong>10 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
  return sendEmail(to, subject, text, html);
};

export interface DemoNotificationData {
  societyName: string;
  contactName: string;
  email: string;
  phone: string;
  city?: string | null;
  numberOfUnits?: number | null;
  selectedPlan?: string | null;
  amountPaid?: string | null;
  paymentId?: string | null;
  message?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
}

// ponytail: direct SMTP email alert to super admin when society registers for demo
export const sendDemoRequestNotificationToSuperAdmin = async (data: DemoNotificationData) => {
  const superAdminEmail =
    process.env.SUPER_ADMIN_EMAIL ||
    process.env.SMTP_USER ||
    'abishbarnodia2018@gmail.com';

  const portalUrl = process.env.CLIENT_MANAGER_URL
    ? `${process.env.CLIENT_MANAGER_URL}/super-admin/demo-requests`
    : 'http://localhost:3002/super-admin/demo-requests';

  const subject = `🔔 New Demo Registration: ${data.societyName} - Action Required: Approve Request`;

  const text = `
New Society Demo / Trial Registration:
- Society Name: ${data.societyName}
- Contact Person: ${data.contactName}
- Email: ${data.email}
- Phone: ${data.phone}
- City: ${data.city || 'Not provided'}
- Units: ${data.numberOfUnits || 'Not provided'}
- Plan: ${data.selectedPlan || 'Starter Tier'} ${data.paymentId ? `(Paid ₹1.00 - ID: ${data.paymentId})` : ''}
${data.documentUrl ? `- Verification Document: ${data.documentUrl}` : ''}
${data.message ? `- Note: ${data.message}` : ''}

Please log in to Super Admin portal and approve this society request within 24 hours:
${portalUrl}
  `.trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #00A67C, #00C896); padding: 20px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 22px;">New Society Registration</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Action Required: Go and Approve Request</p>
      </div>

      <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin-top: 0; font-size: 15px; color: #334155;">
          <strong>${data.contactName}</strong> has registered <strong>${data.societyName}</strong> for a demo trial.
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 15px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Society Name:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${data.societyName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Contact Person:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${data.contactName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Contact Email:</td>
            <td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${data.email}" style="color: #00A67C;">${data.email}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Phone Number:</td>
            <td style="padding: 8px 0; color: #0f172a;"><a href="tel:${data.phone}" style="color: #00A67C;">${data.phone}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">City:</td>
            <td style="padding: 8px 0; color: #0f172a;">${data.city || 'N/A'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Total Units:</td>
            <td style="padding: 8px 0; color: #0f172a;">${data.numberOfUnits || 'N/A'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Plan Selected:</td>
            <td style="padding: 8px 0; color: #0f172a;"><strong>${data.selectedPlan || 'Starter Tier'}</strong></td>
          </tr>
          ${data.documentUrl ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Verification Doc:</td>
            <td style="padding: 8px 0; font-weight: 600;">
              <a href="${data.documentUrl}" target="_blank" style="color: #00A67C; text-decoration: underline;">
                📄 View ${data.documentName || 'Aadhaar / Verification Document'}
              </a>
            </td>
          </tr>
          ` : ''}
          ${data.paymentId ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Payment Status:</td>
            <td style="padding: 8px 0; color: #16a34a; font-weight: 600;">✓ ₹1.00 Paid (ID: ${data.paymentId})</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 14px; color: #1e40af;">
        ⏰ The customer was informed that their credentials will be prepared <strong>within 24 hours</strong>. Please review and approve this request.
      </div>

      <div style="text-align: center;">
        <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #00C896, #00A67C); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 166, 124, 0.3);">
          Go and Approve Request →
        </a>
      </div>
    </div>
  `;

  try {
    return await sendEmail(superAdminEmail, subject, text, html);
  } catch (err) {
    console.error('Failed to send Super Admin notification email:', err);
  }
};

