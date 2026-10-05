import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';

// Force Node.js to prioritize IPv4 over IPv6 (fixes ENETUNREACH in cloud environments without IPv6 routes like Render)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Ensure .env is loaded in all runtime contexts
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api-server/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function getValidSmtpConfig() {
  let user = (process.env.SMTP_USER || '').trim();
  let pass = (process.env.SMTP_PASS || '').replace(/[\r\n\t"]/g, '').replace(/\s+/g, '').trim();

  // If user provided custom credentials in environment, respect them
  if (!user && !pass) {
    user = 'abishbarnodia2018@gmail.com';
    pass = 'nvuoftmfzoadjydf';
  } else if (!user) {
    user = 'abishbarnodia2018@gmail.com';
  } else if (!pass) {
    pass = 'nvuoftmfzoadjydf';
  }
  return { smtpUser: user, smtpPass: pass };
}

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string,
  attachments?: Array<{ filename: string; content?: any; path?: string; contentType?: string }>
) => {
  // Option 1: HTTP API via Brevo (over HTTPS Port 443 - works everywhere including Render Free tier, sends to ANY recipient)
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (brevoApiKey) {
    try {
      const senderEmail = process.env.BREVO_FROM || 'abishbarnodia2018@gmail.com';
      const payload: any = {
        sender: { name: 'Society Security', email: senderEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html || text,
      };
      if (attachments?.length) {
        payload.attachment = attachments.map((a) => ({
          name: a.filename,
          content: a.content ? (Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content) : undefined,
          url: a.path,
        }));
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (res.ok && data?.messageId) {
        console.log('[BREVO SUCCESS] Email sent via HTTPS port 443 to %s: messageId=%s', to, data.messageId);
        return { messageId: data.messageId };
      }
      console.warn('[BREVO WARNING] Brevo HTTP API response not ok:', data);
    } catch (brevoErr: any) {
      console.warn('[BREVO ERROR] Failed to send via Brevo API, falling back:', brevoErr?.message || brevoErr);
    }
  }

  // Option 2: HTTP API via Resend (over HTTPS Port 443)
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const fromEmail = process.env.RESEND_FROM || 'Society Security <onboarding@resend.dev>';
      const payload: any = {
        from: fromEmail,
        to: [to],
        subject,
        text,
        html: html || text,
      };
      if (attachments?.length) {
        payload.attachments = attachments.map((a) => ({
          filename: a.filename,
          content: a.content ? (Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content) : undefined,
          path: a.path,
        }));
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (res.ok && data?.id) {
        console.log('[RESEND SUCCESS] Email sent via HTTPS port 443 to %s: id=%s', to, data.id);
        return { messageId: data.id };
      }
      console.warn('[RESEND WARNING] Resend HTTP API response not ok:', JSON.stringify(data));
      if (data?.statusCode === 403 || data?.name === 'validation_error') {
        console.error('[RESEND SANDBOX RESTRICTION]:', data.message);
      }
    } catch (resendErr: any) {
      console.warn('[RESEND ERROR] Failed to send via Resend API, falling back to SMTP:', resendErr?.message || resendErr);
    }
  }

  // Option 3: Direct SMTP Transport with strict IPv4 resolution
  const { smtpUser, smtpPass } = getValidSmtpConfig();
  const hasAuth = !!(smtpUser && smtpPass);

  if (!hasAuth) {
    console.warn('\n=== EMAIL NOT SENT (Missing SMTP credentials) ===');
    console.warn(`To: ${to}`);
    console.warn(`Subject: ${subject}`);
    console.warn(`Text: ${text}`);
    if (attachments?.length) console.warn(`Attachments: ${attachments.map((a) => a.filename).join(', ')}`);
    console.warn('=================================================\n');
    return { messageId: 'mock-id' };
  }

  const mailOptions = {
    from: `"Society Security" <${smtpUser}>`,
    to,
    subject,
    text,
    html: html || text,
    attachments,
  };

  // Explicit IPv4 DNS lookup helper to prevent ENETUNREACH on IPv6-disabled cloud containers
  const ipv4Lookup = (hostname: string, _options: any, callback: any) => {
    dns.lookup(hostname, { family: 4 }, (err, address, family) => {
      callback(err, address, family);
    });
  };

  // Primary transport: Gmail direct SSL on port 465 with strict IPv4 lookup
  const primaryTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    lookup: ipv4Lookup,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
    },
  } as any);

  try {
    const info = await primaryTransporter.sendMail(mailOptions);
    console.log('[SMTP SUCCESS] Message sent via port 465: %s to %s', info.messageId, to);
    return info;
  } catch (err: any) {
    console.warn('[SMTP WARNING] Port 465 failed, attempting port 587 STARTTLS fallback...', err?.message || err);
    try {
      const fallbackTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        lookup: ipv4Lookup,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        tls: {
          rejectUnauthorized: false,
        },
      } as any);
      const fallbackInfo = await fallbackTransporter.sendMail(mailOptions);
      console.log('[SMTP SUCCESS] Message sent via port 587 fallback: %s to %s', fallbackInfo.messageId, to);
      return fallbackInfo;
    } catch (fallbackErr: any) {
      console.error('[SMTP ERROR] Both port 465 and 587 failed to send to %s:', to, fallbackErr?.message || fallbackErr);
      throw fallbackErr;
    }
  }
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

// ponytail: direct confirmation email to the person who booked the demo on their registered email
export const sendDemoBookingConfirmationToUser = async (data: DemoNotificationData) => {
  if (!data.email) return;

  const subject = `🎉 Demo & Trial Booked: Welcome to Society Security (${data.societyName})`;
  const text = `Hello ${data.contactName},\n\nThank you for booking a demo trial of Society Security for ${data.societyName}!\n\nDetails of your registration:\n- Society Name: ${data.societyName}\n- Contact Person: ${data.contactName}\n- Email: ${data.email}\n- Phone: ${data.phone}\n- Selected Plan: ${data.selectedPlan || '1-Month Demo Trial'}\n${data.paymentId ? `- Payment Status: ₹1.00 Paid (ID: ${data.paymentId})\n` : ''}\nNext Steps:\nOur onboarding team is reviewing your registration and setting up your dedicated Society Manager Portal. You will receive an email with your manager login credentials and activation details within 24 hours.\n\nNeed help? Reply directly to this email or reach us at support.\n\nBest regards,\nSociety Security Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #00A67C, #00C896); padding: 24px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Demo Booked Successfully! 🎉</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Welcome to Society Security</p>
      </div>

      <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin-top: 0; font-size: 16px; color: #0f172a;">
          Hello <strong>${data.contactName}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 22px;">
          Thank you for choosing <strong>Society Security</strong>! We have received your demo request and 1-month trial registration for <strong>${data.societyName}</strong>.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 12px; color: #166534; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            📋 Your Registration Summary
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #dcfce7;">
              <td style="padding: 8px 0; color: #64748b; width: 140px;">Society:</td>
              <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${data.societyName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dcfce7;">
              <td style="padding: 8px 0; color: #64748b;">Contact Name:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${data.contactName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dcfce7;">
              <td style="padding: 8px 0; color: #64748b;">Registered Email:</td>
              <td style="padding: 8px 0; color: #0f172a;">${data.email}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dcfce7;">
              <td style="padding: 8px 0; color: #64748b;">Phone:</td>
              <td style="padding: 8px 0; color: #0f172a;">${data.phone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dcfce7;">
              <td style="padding: 8px 0; color: #64748b;">Plan / Trial:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #00A67C;">${data.selectedPlan || '1-Month Full Access Demo Trial'}</td>
            </tr>
            ${data.paymentId ? `
            <tr style="border-bottom: 1px solid #dcfce7;">
              <td style="padding: 8px 0; color: #64748b;">Payment Status:</td>
              <td style="padding: 8px 0; color: #16a34a; font-weight: 700;">✓ ₹1.00 Paid (ID: ${data.paymentId})</td>
            </tr>
            ` : ''}
            ${data.documentName ? `
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Document:</td>
              <td style="padding: 8px 0; color: #0f172a;">✓ ${data.documentName} Attached</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; color: #1e40af; line-height: 22px;">
          ⏱️ <strong>What happens next?</strong><br />
          Our administrative team is reviewing your verification and setting up your dedicated <strong>Society Manager Portal</strong>. Your manager portal login credentials will be emailed to <strong>${data.email}</strong> within <strong>24 hours</strong>.
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 20px; margin-bottom: 0;">
          If you have any questions or require an urgent onboarding, please feel free to reply directly to this email.
        </p>
      </div>

      <div style="text-align: center; font-size: 12px; color: #94a3b8;">
        © Society Security System • Transforming Residential Security & Management
      </div>
    </div>
  `;

  try {
    return await sendEmail(data.email, subject, text, html);
  } catch (err) {
    console.error(`Failed to send demo confirmation email to user ${data.email}:`, err);
  }
};

function cleanManagerPortalBase(): string {
  let base = (process.env.CLIENT_MANAGER_URL || 'https://society-security-phi.vercel.app').trim();
  if (base.includes('.vercel.app') || base.startsWith('https://')) {
    base = base.replace(/:5173\b/, '').replace(/:3002\b/, '');
  }
  return base.replace(/\/+$/, '');
}

// ponytail: direct SMTP email alert to super admin when society registers for demo
export const sendDemoRequestNotificationToSuperAdmin = async (data: DemoNotificationData) => {
  const superAdminEmail =
    process.env.SUPER_ADMIN_EMAIL ||
    'abishbarnodia2018@gmail.com';

  const managerBase = cleanManagerPortalBase();
  const portalUrl = `${managerBase}/login?redirect=${encodeURIComponent('/super-admin?tab=demos')}&role=superadmin`;

  const subject = `🔔 New Demo Registration: ${data.societyName} - Action Required: Go and Approve Request`;

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

Someone has requested a demo. Please log in to Super Admin portal and approve this request:
${portalUrl}
  `.trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #00A67C, #00C896); padding: 20px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 22px;">New Demo Request Registered 🔔</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Action Required: Go and Approve Request</p>
      </div>

      <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin-top: 0; font-size: 15px; color: #334155;">
          <strong>${data.contactName}</strong> has submitted a demo request for <strong>${data.societyName}</strong>. Please review and approve access.
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


export interface ResidentRegistrationEmailData {
  managerEmail?: string | null;
  societyName: string;
  residentName: string;
  residentEmail?: string | null;
  residentPhone?: string | null;
  unitNumber: string;
  tower?: string | null;
  residentType: string;
  tenantSubtype?: string | null;
  occupancyStatus?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
}

// ponytail: direct SMTP email alert to manager when a resident registers/requests entry for the first time
export const sendResidentRegistrationEmailToManager = async (data: ResidentRegistrationEmailData) => {
  const managerTargetEmail =
    data.managerEmail ||
    process.env.MANAGER_EMAIL ||
    process.env.SUPER_ADMIN_EMAIL ||
    process.env.SMTP_USER ||
    'abishbarnodia2018@gmail.com';

  const portalUrl = process.env.CLIENT_MANAGER_URL
    ? `${process.env.CLIENT_MANAGER_URL}/residents`
    : 'http://localhost:3000/residents';

  const subject = `🔔 New Resident Registration Request: Flat ${data.unitNumber} (${data.tower || 'Main Block'}) - ${data.societyName}`;

  const text = `
New Resident Registration Request:
- Society: ${data.societyName}
- Unit / Flat: ${data.tower ? `${data.tower} - ` : ''}${data.unitNumber}
- Resident Name: ${data.residentName}
- Email: ${data.residentEmail || 'Not provided'}
- Phone: ${data.residentPhone || 'Not provided'}
- Resident Type: ${data.residentType} ${data.tenantSubtype ? `(${data.tenantSubtype})` : ''}
- Occupancy Status: ${data.occupancyStatus || 'Currently residing'}
${data.documentUrl ? `- Agreement / Document: ${data.documentUrl}` : ''}

Please log in to the Manager Portal to verify and approve this resident request:
${portalUrl}
  `.trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #0284c7, #0ea5e9); padding: 20px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 22px;">New Resident Registration Request</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Action Required: Review and Approve Resident Access</p>
      </div>

      <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin-top: 0; font-size: 15px; color: #334155;">
          A new resident has submitted their profile and is awaiting verification for <strong>${data.societyName}</strong>.
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 15px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Society:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${data.societyName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Flat / Unit:</td>
            <td style="padding: 8px 0; font-weight: 700; color: #0284c7;">${data.tower ? `${data.tower} - ` : ''}Flat ${data.unitNumber}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Resident Name:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${data.residentName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Contact Email:</td>
            <td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${data.residentEmail || ''}" style="color: #0284c7;">${data.residentEmail || 'N/A'}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Contact Phone:</td>
            <td style="padding: 8px 0; color: #0f172a;"><a href="tel:${data.residentPhone || ''}" style="color: #0284c7;">${data.residentPhone || 'N/A'}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Resident Role:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${data.residentType} ${data.tenantSubtype ? `<span style="font-weight: 400; color: #64748b;">(${data.tenantSubtype})</span>` : ''}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Occupancy:</td>
            <td style="padding: 8px 0; color: #0f172a;">${data.occupancyStatus || 'Currently residing'}</td>
          </tr>
          ${data.documentUrl ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Rental Agreement / ID:</td>
            <td style="padding: 8px 0; font-weight: 600;">
              <a href="${data.documentUrl}" target="_blank" style="color: #0284c7; text-decoration: underline;">
                📄 View ${data.documentName || 'Uploaded Document'}
              </a>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 14px; color: #1e40af;">
        ⏰ Verification timeline: Residents expect approval within 24–72 hours. Please log in to approve or reject this request.
      </div>

      <div style="text-align: center;">
        <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
          Review & Approve Resident →
        </a>
      </div>
    </div>
  `;

  try {
    return await sendEmail(managerTargetEmail, subject, text, html);
  } catch (err) {
    console.error('Failed to send Manager resident notification email:', err);
  }
};

export const sendResidentApprovalNotificationToResident = async (
  residentEmail: string,
  residentName: string,
  societyName: string,
  flatNumber: string,
  tower: string
) => {
  const subject = `🎉 Your Residency Request has been Approved! - ${societyName}`;
  const text = `
Hello ${residentName},

Great news! Your registration request for Flat ${tower ? `${tower} - ` : ''}${flatNumber} in ${societyName} has been approved by the Society Office.

You now have full access to create visitor passes, approve deliveries, join the community, and manage your home security in the Society Security app.

Best regards,
${societyName} Management Committee
  `.trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #16a34a, #22c55e); padding: 20px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 22px;">Account Approved! 🎉</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Welcome to ${societyName}</p>
      </div>

      <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin-top: 0; font-size: 15px; color: #334155;">
          Hello <strong>${residentName}</strong>,
        </p>
        <p style="font-size: 14px; color: #334155; line-height: 22px;">
          Your residency verification for <strong>${tower ? `${tower} - ` : ''}Flat ${flatNumber}</strong> has been successfully approved by the Management Committee.
        </p>
        <p style="font-size: 14px; color: #334155; line-height: 22px;">
          You can now open the <strong>Society Security</strong> app to generate visitor QR passes, approve guests, book amenities, and receive real-time security alerts.
        </p>
      </div>
    </div>
  `;

  try {
    return await sendEmail(residentEmail, subject, text, html);
  } catch (err) {
    console.error('Failed to send resident approval confirmation email:', err);
  }
};

// ponytail: send maintenance invoice PDF email to primary resident when a charge is created
export const sendInvoiceEmail = async (opts: {
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
  const formattedDue = new Date(opts.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedAmount = `₹${Number(opts.amount).toLocaleString('en-IN')}`;
  const unitLabel = opts.tower ? `Tower ${opts.tower} - Flat ${opts.unitNumber}` : `Flat ${opts.unitNumber}`;

  const subject = `📄 New Maintenance Invoice: ${opts.societyName} - ${opts.description}`;
  const text = `Hello ${opts.residentName},\n\nA new maintenance charge of ${formattedAmount} has been issued for your unit (${unitLabel}).\n\nDescription: ${opts.description}\nDue Date: ${formattedDue}\n\nPlease find your official invoice PDF attached to this email. You can pay this securely from the Resident Mobile App.\n\nThank you,\n${opts.societyName}`.trim();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 22px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 700;">${opts.societyName}</h2>
        <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">New Maintenance Charge Issued</p>
      </div>

      <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin-top: 0; font-size: 15px; color: #334155;">
          Dear <strong>${opts.residentName}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 22px;">
          A new maintenance invoice has been generated for your residence (<strong>${unitLabel}</strong>).
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Description:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0f172a; text-align: right;">${opts.description}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Amount Due:</td>
              <td style="padding: 8px 0; font-weight: 700; color: #0f172a; text-align: right; font-size: 16px;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Due Date:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #ea580c; text-align: right;">${formattedDue}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #15803d; margin-bottom: 16px;">
          📎 <strong>Invoice PDF Attached:</strong> Your official invoice is attached to this email for your accounting and records.
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 20px; margin-bottom: 0;">
          You can pay this bill instantly using UPI, NetBanking, Debit, or Credit cards in the <strong>Resident App</strong> under <em>Maintenance & Bills</em>.
        </p>
      </div>

      <div style="text-align: center; font-size: 12px; color: #94a3b8;">
        This is an automated notification from ${opts.societyName} Security & Billing Portal.
      </div>
    </div>
  `;

  try {
    return await sendEmail(opts.to, subject, text, html, [
      {
        filename: `Invoice_${opts.invoiceId.slice(-8).toUpperCase()}.pdf`,
        content: opts.pdfBuffer,
        contentType: 'application/pdf',
      },
    ]);
  } catch (err) {
    console.error('Failed to send maintenance invoice email:', err);
  }
};

// ponytail: directly email manager login credentials upon approval or manual dispatch
export const sendManagerCredentialsEmail = async (opts: {
  to: string;
  managerName?: string;
  societyName: string;
  slug: string;
  temporaryPassword?: string;
  portalUrl?: string;
}) => {
  const managerName = opts.managerName || 'Manager';
  const defaultManagerBase = cleanManagerPortalBase();
  let portalUrl = opts.portalUrl;
  if (portalUrl) {
    if (portalUrl.includes('.vercel.app') || portalUrl.startsWith('https://')) {
      portalUrl = portalUrl.replace(/:5173\b/, '').replace(/:3002\b/, '');
    }
  } else {
    portalUrl = opts.slug
      ? `${defaultManagerBase}/login?slug=${encodeURIComponent(opts.slug)}&email=${encodeURIComponent(opts.to)}`
      : `${defaultManagerBase}/login?email=${encodeURIComponent(opts.to)}`;
  }
  const subject = `🎉 Your Demo Request is Approved! Manager Credentials for ${opts.societyName}`;
  const text = `Hello ${managerName},\n\nGreat news! Your demo request and 1-month trial for ${opts.societyName} has been approved by the Super Admin!\n\nYour manager account is now active.\n\nPortal Link: ${portalUrl}\nSociety Slug: ${opts.slug}\nEmail: ${opts.to}\nTemporary Password: ${opts.temporaryPassword || 'Configured during setup'}\n\nPlease sign in to configure your security staff, gates, and resident directory.\n\nBest regards,\nSociety Security Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #00A67C, #00C896); padding: 22px; border-radius: 8px; text-align: center; color: white; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Demo Request Approved! 🎉</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Manager Portal Account Provisioned</p>
      </div>

      <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <p style="margin-top: 0; font-size: 15px; color: #334155;">
          Hello <strong>${managerName}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 22px;">
          Great news! Your demo request for <strong>${opts.societyName}</strong> has been approved by the Super Admin, and your society account is now active and ready.
        </p>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h4 style="margin: 0 0 12px; color: #0369a1; font-size: 15px; font-weight: 700;">🔑 Your Manager Portal Credentials</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #e0f2fe;">
              <td style="padding: 8px 0; color: #64748b; width: 140px;">Portal Link:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0284c7;">
                <a href="${portalUrl}" style="color: #0284c7; text-decoration: underline;">${portalUrl}</a>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #e0f2fe;">
              <td style="padding: 8px 0; color: #64748b;">Society Slug:</td>
              <td style="padding: 8px 0; font-weight: 700; color: #0f172a; font-family: monospace;">${opts.slug}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0f2fe;">
              <td style="padding: 8px 0; color: #64748b;">Login Email:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${opts.to}</td>
            </tr>
            ${opts.temporaryPassword ? `
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Temporary Password:</td>
              <td style="padding: 8px 0; font-weight: 700; color: #0284c7; font-family: monospace; font-size: 16px;">${opts.temporaryPassword}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284C7, #0369A1); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
            Sign in to Manager Dashboard →
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 20px; margin-bottom: 0;">
          💡 <em>Tip: For account security, we recommend changing your temporary password after your initial sign in.</em>
        </p>
      </div>
    </div>
  `;

  return sendEmail(opts.to, subject, text, html);
};




