import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { DemoRequest } from '../../types';
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
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);

  const isImageFile = (url?: string | null, name?: string | null) => {
    if (!url) return false;
    const lower = (url + ' ' + (name || '')).toLowerCase();
    return (
      lower.includes('.jpg') ||
      lower.includes('.jpeg') ||
      lower.includes('.png') ||
      lower.includes('.webp') ||
      lower.includes('.gif') ||
      lower.includes('image/') ||
      lower.startsWith('data:image/') ||
      !lower.includes('.pdf')
    );
  };

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
      setZoomedPhotoUrl(null);

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
    const base = window.location.origin;
    return `${base}/login?slug=${s}`;
  };

  const getFormattedCredentialsText = () => {
    if (!provisionedData) return '';
    const portalUrl = getPortalUrl(provisionedData.society.slug);
    return `SecureGate Manager Login Credentials\n------------------------------------\nSociety: ${provisionedData.society.name}\nPortal URL: ${portalUrl}\nSociety ID: ${provisionedData.society.id}\nSlug: ${provisionedData.society.slug}\nEmail: ${provisionedData.credentials.email}\nTemporary Password: ${provisionedData.credentials.temporaryPassword}\n------------------------------------\nPlease change your password upon first login.`;
  };

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  const handleCopyCredentials = () => {
    navigator.clipboard.writeText(getFormattedCredentialsText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = async () => {
    if (!provisionedData || isSendingEmail) return;
    const recipient = provisionedData.credentials.email || managerEmail;
    const portalUrl = getPortalUrl(provisionedData.society.slug);

    setIsSendingEmail(true);
    try {
      await superAdminService.sendManagerCredentialsEmail({
        societyId: provisionedData.society.id,
        societyName: provisionedData.society.name,
        slug: provisionedData.society.slug,
        managerName: provisionedData.manager?.name || managerName || 'Manager',
        managerEmail: recipient,
        temporaryPassword: provisionedData.credentials.temporaryPassword,
        portalUrl,
      });
      setEmailSentSuccess(true);
      setTimeout(() => setEmailSentSuccess(false), 5000);
    } catch (err: any) {
      alert(`Failed to send email: ${err.message || 'SMTP server error'}`);
    } finally {
      setIsSendingEmail(false);
    }
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
                disabled={isSendingEmail}
                style={{
                  background: emailSentSuccess ? '#059669' : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: emailSentSuccess ? '0 2px 8px rgba(5, 150, 105, 0.25)' : '0 2px 8px rgba(2, 132, 199, 0.25)',
                  cursor: isSendingEmail ? 'not-allowed' : 'pointer',
                  opacity: isSendingEmail ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon icon={isSendingEmail ? "solar:restart-bold" : emailSentSuccess ? "solar:check-circle-bold" : "solar:letter-bold"} className={isSendingEmail ? "animate-spin" : ""} width="18" />
                {isSendingEmail ? 'Sending Email...' : emailSentSuccess ? 'Email Sent Directly!' : 'Send via Email'}
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

          {demoRequest.documentUrl && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(0, 200, 150, 0.06)',
              border: '1px solid rgba(0, 200, 150, 0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon
                    icon={isImageFile(demoRequest.documentUrl, demoRequest.documentName) ? "solar:gallery-bold" : "solar:document-text-bold"}
                    width="22"
                    color="#00A67C"
                  />
                  <div>
                    <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {demoRequest.documentName || 'Verification Photo / Document'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      Uploaded during demo request submission for identity & society verification
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isImageFile(demoRequest.documentUrl, demoRequest.documentName) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setZoomedPhotoUrl(demoRequest.documentUrl!)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    >
                      <Icon icon="solar:magnifer-zoom-in-bold" width="14" />
                      Zoom Photo
                    </button>
                  )}
                  <a
                    href={demoRequest.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Icon icon="solar:link-bold" width="14" />
                    Open Full Size
                  </a>
                </div>
              </div>

              {/* Inline Photo / Image Preview */}
              {isImageFile(demoRequest.documentUrl, demoRequest.documentName) && (
                <div
                  onClick={() => setZoomedPhotoUrl(demoRequest.documentUrl!)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    maxHeight: '180px',
                    background: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(0, 200, 150, 0.2)',
                  }}
                  title="Click to view full screen"
                >
                  <img
                    src={demoRequest.documentUrl}
                    alt={demoRequest.documentName || 'Uploaded verification photo'}
                    style={{
                      width: '100%',
                      maxHeight: '180px',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <Icon icon="solar:magnifer-zoom-in-bold" width="12" />
                    Click to Zoom
                  </div>
                </div>
              )}
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

      {/* Full Photo Zoom Modal */}
      <Modal
        isOpen={Boolean(zoomedPhotoUrl)}
        onClose={() => setZoomedPhotoUrl(null)}
        title={demoRequest?.documentName || 'Verification Photo Preview'}
        maxWidth="800px"
      >
        {zoomedPhotoUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
            <div style={{
              width: '100%',
              maxHeight: '75vh',
              overflow: 'auto',
              borderRadius: '8px',
              background: '#090d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
            }}>
              <img
                src={zoomedPhotoUrl}
                alt="Verification Full View"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                {demoRequest?.societyName} • Submitted by {demoRequest?.contactName}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={zoomedPhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  <Icon icon="solar:arrow-right-up-bold" width="14" />
                  Open in New Tab
                </a>
                <button className="btn btn-primary btn-sm" onClick={() => setZoomedPhotoUrl(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
};
