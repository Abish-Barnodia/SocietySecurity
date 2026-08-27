import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger.util';
import { AppError } from '../middlewares/error.middleware';

// Supabase is used here purely as an OTP-email delivery mechanism for
// password reset — Ethereal (the SMTP provider previously in .env) never
// delivers to real inboxes, and Supabase's own mailer (backed by the
// account's own custom SMTP, configured in the Supabase dashboard, not this
// repo's .env) does. Login itself is untouched: this never issues a
// Supabase session for signing in, only for proving the resident owns the
// email, after which we update our own User.passwordHash.
const authUrl = (path: string) => `${env.SUPABASE_URL}/auth/v1${path}`;

const isConfigured = () => !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);

// Supabase can only email a recovery code to a user that already exists in
// its own auth.users table — our residents/managers only exist in our own
// Postgres User table, so this lazily mirrors one over the first time a
// password reset is requested. The password set here is never used for
// anything; only the recovery-email + OTP-verify capability matters.
async function ensureSupabaseUser(email: string) {
  try {
    await axios.post(
      authUrl('/admin/users'),
      { email, email_confirm: true, password: `${Math.random().toString(36)}Aa1!` },
      { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
    );
  } catch (err: any) {
    // 422/"already been registered" just means it's already there — fine.
    const msg = err?.response?.data?.msg || err?.response?.data?.message || '';
    if (!/already/i.test(msg)) {
      logger.warn('supabaseAuth: ensureSupabaseUser failed', { email, msg });
    }
  }
}

export const sendSupabaseRecoveryEmail = async (email: string): Promise<boolean> => {
  if (!isConfigured()) return false;
  await ensureSupabaseUser(email);
  try {
    await axios.post(
      authUrl('/recover'),
      { email },
      { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` } }
    );
  } catch (err: any) {
    // Supabase itself failing to relay through the configured custom SMTP
    // (bad host/port/credentials in the Supabase dashboard) surfaces as a
    // 500 "Error sending recovery email" here — log the real detail
    // server-side and give the client something more actionable than a
    // bare "Internal Server Error".
    logger.error('supabaseAuth: /recover failed', { email, status: err?.response?.status, data: err?.response?.data });
    throw new AppError('Could not send the reset email right now. Please try again shortly.', 502);
  }
  return true;
};

// Verifies the 6-digit code Supabase emailed (its "Reset Password" template
// must include {{ .Token }} for this to be a plain code rather than only a
// link). On success returns the Supabase user id so the caller can also
// keep the shadow Supabase account's password in sync, purely for tidiness.
export const verifySupabaseRecoveryCode = async (email: string, token: string): Promise<{ userId: string } | null> => {
  if (!isConfigured()) return null;
  try {
    const { data } = await axios.post(
      authUrl('/verify'),
      { type: 'recovery', email, token },
      { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` } }
    );
    return data?.user?.id ? { userId: data.user.id } : null;
  } catch {
    return null;
  }
};

export const setSupabaseUserPassword = async (supabaseUserId: string, password: string) => {
  try {
    await axios.put(
      authUrl(`/admin/users/${supabaseUserId}`),
      { password },
      { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
    );
  } catch (err) {
    // Purely cosmetic sync — our own User.passwordHash is the real source of truth.
    logger.warn('supabaseAuth: setSupabaseUserPassword failed', { supabaseUserId });
  }
};
