import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { DemoRequest } from '../../types';
import { superAdminService } from '../../services/superAdmin.service';
import { Icon } from '@iconify/react';

interface ProvisionSocietyModalProps {
  isOpen: boolean;
  onClose: () => void;
  demoRequest: DemoRequest | null;
  onSuccess: () => void;
}

export const ProvisionSocietyModal: React.FC<ProvisionSocietyModalProps> = ({
  isOpen,
  onClose,
  demoRequest,
  onSuccess,
}) => {
  const [managerName, setManagerName] = useState(demoRequest?.contactName || '');
  const [managerEmail, setManagerEmail] = useState(demoRequest?.email || '');
  const [managerPhone, setManagerPhone] = useState(demoRequest?.phone || '');
  const [managerPassword, setManagerPassword] = useState('');
  const [address, setAddress] = useState(demoRequest?.city || '');
  const [city, setCity] = useState(demoRequest?.city || '');
  const [pincode, setPincode] = useState('');
  const [totalUnits, setTotalUnits] = useState(demoRequest?.numberOfUnits || 100);
  const [subscriptionPlan, setSubscriptionPlan] = useState('STANDARD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provisionedData, setProvisionedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  // Sync state when demoRequest changes
  React.useEffect(() => {
    if (demoRequest) {
      setManagerName(demoRequest.contactName);
      setManagerEmail(demoRequest.email);
      setManagerPhone(demoRequest.phone);
      setTotalUnits(demoRequest.numberOfUnits || 100);
      setProvisionedData(null);
      setError(null);
      setCopied(false);

      // Extract address, pin, and plan if encoded in message
      const msg = demoRequest.message || '';
      const notes = demoRequest.notes || '';
      const combined = `${msg} ${notes}`.toUpperCase();

      if (combined.includes('STARTER')) {
        setSubscriptionPlan('STARTER');
      } else if (combined.includes('ENTERPRISE')) {
        setSubscriptionPlan('ENTERPRISE');
      } else {
        setSubscriptionPlan('STANDARD');
      }

      // Parse Address: ... if present
      const addrMatch = msg.match(/Address:\s*([^|]+)/i);
      if (addrMatch && addrMatch[1]) {
        setAddress(addrMatch[1].trim());
      } else {
        setAddress(demoRequest.city || '');
      }

      // Parse PIN: ... if present
      const pinMatch = msg.match(/PIN:\s*([^|]+)/i);
      if (pinMatch && pinMatch[1]) {
        setPincode(pinMatch[1].trim());
      }

      setCity(demoRequest.city || '');
    }
  }, [demoRequest]);

  const getPortalUrl = (slug?: string) => {
    const s = slug || provisionedData?.society?.slug || '';
    return `${window.location.protocol}//${window.location.hostname}:5173/login?slug=${s}`;
  };

  const getFormattedCredentialsText = () => {
    if (!provisionedData) return '';
    const portalUrl = getPortalUrl(provisionedData.society.slug);
    return `SecureGate Manager Login Credentials\n------------------------------------\nSociety: ${provisionedData.society.name}\nPortal URL: ${portalUrl}\nSociety ID: ${provisionedData.society.id}\nSlug: ${provisionedData.society.slug}\nEmail: ${provisionedData.credentials.email}\nTemporary Password: ${provisionedData.credentials.temporaryPassword}\n------------------------------------\nPlease change your password upon first login.`;
  };

  const handleCopyCredentials = () => {
    navigator.clipboard.writeText(getFormattedCredentialsText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = () => {
    if (!provisionedData) return;
    const recipient = provisionedData.credentials.email || managerEmail;
    const portalUrl = getPortalUrl(provisionedData.society.slug);
    const subject = `Welcome to SecureGate - Login Credentials for ${provisionedData.society.name}`;
    const body = `Hello ${provisionedData.manager?.name || managerName || 'Manager'},\n\nYour society "${provisionedData.society.name}" has been successfully approved and provisioned on SecureGate!\n\nHere are your Manager Portal login details:\n• Portal URL: ${portalUrl}\n• Society Slug: ${provisionedData.society.slug}\n• Login Email: ${provisionedData.credentials.email}\n• Temporary Password: ${provisionedData.credentials.temporaryPassword}\n\nPlease sign in to configure your entry gates, assign security guards, and onboard residents.\nFor account security, remember to update your temporary password after logging in.\n\nBest regards,\nSecureGate Platform Administration`;

    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleSendWhatsApp = () => {
    if (!provisionedData) return;
    const rawPhone = provisionedData.manager?.phone || managerPhone || demoRequest?.phone || '';
    const digitsOnly = rawPhone.replace(/\D/g, '');
    const phoneWithCountry = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
    const portalUrl = getPortalUrl(provisionedData.society.slug);

    const message = `*Welcome to SecureGate!* 🏢\n\nSociety: *${provisionedData.society.name}*\nYour manager portal account is ready.\n\n🔑 *Manager Login Credentials:*\n• *Portal Link:* ${portalUrl}\n• *Email:* ${provisionedData.credentials.email}\n• *Password:* ${provisionedData.credentials.temporaryPassword}\n• *Society Slug:* ${provisionedData.society.slug}\n\n_Please log in and change your temporary password upon your first sign in._`;

    const waUrl = phoneWithCountry
      ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoRequest) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await superAdminService.approveAndProvisionDemo(demoRequest.id, {
        managerName,
        managerEmail,
        managerPhone,
        managerPassword: managerPassword || undefined,
        address,
        city,
        pincode,
        totalUnits: Number(totalUnits),
        subscriptionPlan,
      });

      setProvisionedData(result);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to provision society');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!demoRequest) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={provisionedData ? '🎉 Society Successfully Provisioned!' : `Approve & Provision: ${demoRequest.societyName}`}
      maxWidth="640px"
    >
      {provisionedData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--success-bg)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--success)',
            fontSize: '0.9rem'
          }}>
            <strong>Success:</strong> Society <strong>{provisionedData.society.name}</strong> is live and the Manager account has been activated!
          </div>

          <div className="card" style={{ background: 'var(--bg-primary)', padding: '18px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Manager Login Credentials
              </h3>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 200, 150, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                Active
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Society Name:</span>
                <strong>{provisionedData.society.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Portal Slug:</span>
                <code>{provisionedData.society.slug}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Manager Email:</span>
                <code>{provisionedData.credentials.email}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-dim)' }}>Temporary Password:</span>
                <code style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.95rem' }}>{provisionedData.credentials.temporaryPassword}</code>
              </div>
            </div>
          </div>

          {/* Direct Share Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Send Credentials to Manager
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={handleSendWhatsApp}
                style={{
                  background: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)',
                }}
              >
                <Icon icon="ic:baseline-whatsapp" width="18" />
                Send via WhatsApp
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSendEmail}
                style={{
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                }}
              >
                <Icon icon="solar:letter-bold" width="18" />
                Send via Email
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyCredentials}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon icon={copied ? "solar:check-circle-bold" : "solar:copy-bold"} width="16" color={copied ? "var(--success)" : undefined} />
              {copied ? 'Copied to Clipboard!' : 'Copy Credentials'}
            </button>
            <button className="btn btn-primary" onClick={onClose} style={{ minWidth: '100px' }}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Manager Full Name *
              </label>
              <input
                type="text"
                className="input"
                required
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Manager Email (Login) *
              </label>
              <input
                type="email"
                className="input"
                required
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Manager Phone *
              </label>
              <input
                type="tel"
                className="input"
                required
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Custom Password (or auto-generate)
              </label>
              <input
                type="text"
                className="input"
                placeholder="Leave blank to auto-generate"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Society Address
              </label>
              <input
                type="text"
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                City
              </label>
              <input
                type="text"
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Pincode
              </label>
              <input
                type="text"
                className="input"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Total Units (Flats)
              </label>
              <input
                type="number"
                className="input"
                value={totalUnits}
                onChange={(e) => setTotalUnits(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Subscription Tier
              </label>
              <select
                className="select"
                value={subscriptionPlan}
                onChange={(e) => setSubscriptionPlan(e.target.value)}
              >
                <option value="STARTER">Starter Plan (Up to 100 units)</option>
                <option value="STANDARD">Standard Pro (Up to 300 units)</option>
                <option value="ENTERPRISE">Enterprise (Unlimited + ANPR)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Icon icon="solar:restart-bold" className="animate-spin" width="16" />
                  Provisioning...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" width="16" />
                  Approve & Provision Society
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
