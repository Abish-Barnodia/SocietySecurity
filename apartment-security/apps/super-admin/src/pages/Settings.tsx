import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { superAdminService } from '../services/superAdmin.service';
import { PlatformSettingsMap } from '../types';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSettingsMap>({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smsGateway: 'FAST2SMS',
    waApiKey: '',
    platformMaintenance: false,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await superAdminService.getPlatformSettings();
      if (data) {
        setSettings({
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort || '587',
          smtpUser: data.smtpUser || '',
          smsGateway: data.smsGateway || 'FAST2SMS',
          waApiKey: data.waApiKey || '',
          platformMaintenance: !!data.platformMaintenance,
        });
      }
    } catch (err: any) {
      console.error('Failed to load settings', err);
      setErrorMessage(err.message || 'Failed to load platform settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await superAdminService.updatePlatformSettings(settings);
      setSuccessMessage('Platform settings successfully saved & synchronized with cluster database.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to save settings', err);
      setErrorMessage(err.message || 'Failed to persist platform settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Global Platform Settings
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Configure live infrastructure, notification gateways, and system parameters
        </p>
      </div>

      {successMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--emerald-bg)',
          color: 'var(--emerald)',
          border: '1px solid var(--emerald-border)',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Icon icon="solar:check-circle-bold" width="18" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: '1px solid var(--rose-border)',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Icon icon="solar:danger-circle-bold" width="18" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
          <Icon icon="solar:restart-bold" className="animate-spin" width="32" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Email & SMTP Gateway */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon icon="solar:letter-bold" width="18" style={{ color: 'var(--primary-dark)' }} />
              Email Relay & SMTP Configuration
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  SMTP Host
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="smtp.sendgrid.net"
                  value={settings.smtpHost}
                  onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Port
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="587"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                SMTP Username / API Key
              </label>
              <input
                type="text"
                className="input"
                placeholder="apikey"
                value={settings.smtpUser || ''}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
              />
            </div>
          </div>

          {/* SMS & WhatsApp Dispatch Gateway */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon icon="solar:chat-round-line-bold" width="18" style={{ color: 'var(--emerald)' }} />
              SMS & WhatsApp Gateways (Global)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  SMS Provider
                </label>
                <select
                  className="select"
                  value={settings.smsGateway}
                  onChange={(e) => setSettings({ ...settings, smsGateway: e.target.value })}
                >
                  <option value="FAST2SMS">Fast2SMS (India)</option>
                  <option value="TWILIO">Twilio Global</option>
                  <option value="MSG91">MSG91 Enterprise</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  WhatsApp Business Cloud API Key
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="wa_live_sec_..."
                  value={settings.waApiKey}
                  onChange={(e) => setSettings({ ...settings, waApiKey: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchSettings}
              disabled={isSaving}
            >
              Reset Changes
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Icon icon="solar:restart-bold" className="animate-spin" width="16" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:diskette-bold" width="16" />
                  Save Platform Settings
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
