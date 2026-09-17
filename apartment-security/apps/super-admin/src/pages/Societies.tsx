import React, { useState, useEffect } from 'react';
import { Society, SocietyStatus } from '../types';
import { superAdminService } from '../services/superAdmin.service';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { Icon } from '@iconify/react';

export const Societies: React.FC = () => {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);

  const [newSociety, setNewSociety] = useState({
    name: '',
    address: '',
    city: '',
    pincode: '',
    email: '',
    phone: '',
    totalUnits: 100,
    totalTowers: 1,
    subscriptionPlan: 'STANDARD',
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    managerPassword: '',
  });

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const fetchSocieties = async () => {
    setIsLoading(true);
    try {
      const data = await superAdminService.getSocieties({
        status: statusFilter,
        search,
        page,
        limit: pageSize,
      });
      setSocieties(data.items || []);
      if (data.pagination) {
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load societies', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  useEffect(() => {
    fetchSocieties();
  }, [statusFilter, search, page, pageSize]);

  const handleStatusToggle = async (society: Society) => {
    const nextStatus: SocietyStatus = society.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to change status of "${society.name}" to ${nextStatus}?`)) return;

    try {
      await superAdminService.updateSocietyStatus(society.id, nextStatus);
      fetchSocieties();
    } catch (err: any) {
      alert(err.message || 'Failed to update society status');
    }
  };

  const [createdResult, setCreatedResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateSociety = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await superAdminService.createSociety(newSociety);
      setIsAddModalOpen(false);
      setCreatedResult(res);
      setCopied(false);
      setNewSociety({
        name: '',
        address: '',
        city: '',
        pincode: '',
        email: '',
        phone: '',
        totalUnits: 100,
        totalTowers: 1,
        subscriptionPlan: 'STANDARD',
        managerName: '',
        managerEmail: '',
        managerPhone: '',
        managerPassword: '',
      });
      fetchSocieties();
    } catch (err: any) {
      alert(err.message || 'Failed to create society');
    }
  };

  const getPortalUrl = (slug?: string) => {
    const s = slug || createdResult?.society?.slug || '';
    return `${window.location.protocol}//${window.location.hostname}:5173/login?slug=${s}`;
  };

  const getFormattedCredentialsText = () => {
    if (!createdResult) return '';
    const portalUrl = getPortalUrl(createdResult.society.slug);
    return `SecureGate Manager Login Credentials\n------------------------------------\nSociety: ${createdResult.society.name}\nPortal URL: ${portalUrl}\nSociety ID: ${createdResult.society.id}\nSlug: ${createdResult.society.slug}\nEmail: ${createdResult.credentials.email}\nTemporary Password: ${createdResult.credentials.temporaryPassword}\n------------------------------------\nPlease change your password upon first login.`;
  };

  const handleCopyCredentials = () => {
    navigator.clipboard.writeText(getFormattedCredentialsText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = () => {
    if (!createdResult) return;
    const recipient = createdResult.credentials.email;
    const portalUrl = getPortalUrl(createdResult.society.slug);
    const subject = `Welcome to SecureGate - Login Credentials for ${createdResult.society.name}`;
    const body = `Hello ${createdResult.manager?.name || 'Manager'},\n\nYour society "${createdResult.society.name}" has been successfully created and provisioned on SecureGate!\n\nHere are your Manager Portal login details:\n• Portal URL: ${portalUrl}\n• Society Slug: ${createdResult.society.slug}\n• Login Email: ${createdResult.credentials.email}\n• Temporary Password: ${createdResult.credentials.temporaryPassword}\n\nPlease sign in to configure your entry gates, assign security guards, and onboard residents.\nFor account security, remember to update your temporary password after logging in.\n\nBest regards,\nSecureGate Platform Administration`;

    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleSendWhatsApp = () => {
    if (!createdResult) return;
    const rawPhone = createdResult.manager?.phone || '';
    const digitsOnly = rawPhone.replace(/\D/g, '');
    const phoneWithCountry = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
    const portalUrl = getPortalUrl(createdResult.society.slug);

    const message = `*Welcome to SecureGate!* 🏢\n\nSociety: *${createdResult.society.name}*\nYour manager portal account is ready.\n\n🔑 *Manager Login Credentials:*\n• *Portal Link:* ${portalUrl}\n• *Email:* ${createdResult.credentials.email}\n• *Password:* ${createdResult.credentials.temporaryPassword}\n• *Society Slug:* ${createdResult.society.slug}\n\n_Please log in and change your temporary password upon your first sign in._`;

    const waUrl = phoneWithCountry
      ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  const statusTabs = [
    { id: 'ALL', label: 'All Societies' },
    { id: 'ACTIVE', label: 'Active' },
    { id: 'SUSPENDED', label: 'Suspended' },
    { id: 'PENDING', label: 'Pending' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header & Controls Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        
        {/* Segmented Control Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '3px',
          gap: '2px',
        }}>
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: statusFilter === tab.id ? 'var(--primary-light)' : 'transparent',
                color: statusFilter === tab.id ? 'var(--primary-dark)' : 'var(--text-muted)',
                transition: 'all 0.12s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Direct Add Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '420px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search by society, slug, city..."
              className="input"
              style={{ paddingLeft: '34px', paddingRight: '12px', fontSize: '0.825rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Icon icon="solar:magnifer-linear" width="16" style={{ position: 'absolute', left: '11px', top: '11px', color: 'var(--text-dim)' }} />
          </div>

          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)} style={{ whiteSpace: 'nowrap' }}>
            <Icon icon="solar:add-circle-bold" width="16" />
            <span>New Society</span>
          </button>
        </div>
      </div>

      {/* Border-Lined Societies Data Grid */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Society / Tenant</th>
              <th>Tenant Slug</th>
              <th>Location</th>
              <th>Capacity & Staff</th>
              <th>Primary Manager</th>
              <th>Plan Tier</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>
                  <Icon icon="solar:restart-bold" className="animate-spin" width="24" color="var(--primary)" />
                </td>
              </tr>
            ) : societies.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                  No societies found matching your criteria.
                </td>
              </tr>
            ) : (
              societies.map((society) => {
                const manager = society.managers?.[0];
                return (
                  <tr key={society.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--emerald-bg)',
                          border: '1px solid var(--emerald-border)',
                          color: 'var(--primary-dark)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          flexShrink: 0,
                        }}>
                          {society.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{society.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            ID: {society.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <code>{society.slug || '—'}</code>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>{society.city}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{society.pincode}</div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {society.totalUnits} Flats
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {society._count?.guards || 0} Guards • {society._count?.entryPoints || 1} Gates
                      </div>
                    </td>

                    <td>
                      {manager ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>{manager.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{manager.user?.email}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Unassigned</span>
                      )}
                    </td>

                    <td>
                      <span style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--indigo-bg)',
                        color: 'var(--indigo)',
                        border: '1px solid var(--indigo-border)',
                      }}>
                        {society.subscriptionPlan}
                      </span>
                    </td>

                    <td>
                      <StatusBadge status={society.status} />
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Inspect Tenant Details"
                          onClick={() => setSelectedSociety(society)}
                        >
                          <Icon icon="solar:eye-linear" width="14" />
                        </button>
                        <button
                          className={`btn btn-sm ${society.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                          title={society.status === 'ACTIVE' ? 'Suspend Society' : 'Activate Society'}
                          onClick={() => handleStatusToggle(society)}
                        >
                          <Icon icon={society.status === 'ACTIVE' ? 'solar:forbidden-circle-bold' : 'solar:check-circle-bold'} width="14" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* Society Details Modal */}
      {selectedSociety && (
        <Modal
          isOpen={!!selectedSociety}
          onClose={() => setSelectedSociety(null)}
          title={`Society: ${selectedSociety.name}`}
          maxWidth="640px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>TENANT ID</div>
                <code style={{ fontSize: '0.825rem' }}>{selectedSociety.id}</code>
              </div>
              <StatusBadge status={selectedSociety.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
              <div><strong>Slug:</strong> <code>{selectedSociety.slug}</code></div>
              <div><strong>City:</strong> {selectedSociety.city}</div>
              <div><strong>Address:</strong> {selectedSociety.address}</div>
              <div><strong>Pincode:</strong> {selectedSociety.pincode}</div>
              <div><strong>Total Units:</strong> {selectedSociety.totalUnits}</div>
              <div><strong>Total Towers:</strong> {selectedSociety.totalTowers}</div>
              <div><strong>Subscription:</strong> {selectedSociety.subscriptionPlan}</div>
              <div><strong>Expires:</strong> {selectedSociety.subscriptionExpiresAt ? new Date(selectedSociety.subscriptionExpiresAt).toLocaleDateString() : 'Lifetime'}</div>
            </div>

            <div style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Primary Manager Account
              </h4>
              {selectedSociety.managers?.[0] ? (
                <div style={{ fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Name:</strong> {selectedSociety.managers[0].name}</div>
                  <div><strong>Email:</strong> {selectedSociety.managers[0].user?.email}</div>
                  <div><strong>Phone:</strong> {selectedSociety.managers[0].user?.phone}</div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No manager assigned.</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedSociety(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Direct Society Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Provision New Society Workspace"
        maxWidth="620px"
      >
        <form onSubmit={handleCreateSociety} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Society Name *
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="e.g. Prestige Green Valley"
                value={newSociety.name}
                onChange={(e) => setNewSociety({ ...newSociety, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                City *
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="e.g. Bengaluru"
                value={newSociety.city}
                onChange={(e) => setNewSociety({ ...newSociety, city: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Address
              </label>
              <input
                type="text"
                className="input"
                placeholder="Street / Sector address"
                value={newSociety.address}
                onChange={(e) => setNewSociety({ ...newSociety, address: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Pincode
              </label>
              <input
                type="text"
                className="input"
                placeholder="560100"
                value={newSociety.pincode}
                onChange={(e) => setNewSociety({ ...newSociety, pincode: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Manager Name *
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Full name"
                value={newSociety.managerName}
                onChange={(e) => setNewSociety({ ...newSociety, managerName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Manager Email (Login) *
              </label>
              <input
                type="email"
                required
                className="input"
                placeholder="manager@society.com"
                value={newSociety.managerEmail}
                onChange={(e) => setNewSociety({ ...newSociety, managerEmail: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Manager Phone *
              </label>
              <input
                type="tel"
                required
                className="input"
                placeholder="10-digit number"
                value={newSociety.managerPhone}
                onChange={(e) => setNewSociety({ ...newSociety, managerPhone: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Password (auto-generated if empty)
              </label>
              <input
                type="text"
                className="input"
                placeholder="Custom password or blank"
                value={newSociety.managerPassword}
                onChange={(e) => setNewSociety({ ...newSociety, managerPassword: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Icon icon="solar:check-circle-bold" width="16" />
              Provision Society
            </button>
          </div>
        </form>
      </Modal>

      {/* Provisioned Credentials Modal */}
      <Modal
        isOpen={Boolean(createdResult)}
        onClose={() => setCreatedResult(null)}
        title="🎉 Society Successfully Provisioned!"
        maxWidth="640px"
      >
        {createdResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--success)',
              fontSize: '0.9rem'
            }}>
              <strong>Success:</strong> Society <strong>{createdResult.society.name}</strong> is live and the Manager account has been activated!
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
                  <strong>{createdResult.society.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Portal Slug:</span>
                  <code>{createdResult.society.slug}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Manager Email:</span>
                  <code>{createdResult.credentials.email}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Temporary Password:</span>
                  <code style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.95rem' }}>{createdResult.credentials.temporaryPassword}</code>
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
              <button className="btn btn-primary" onClick={() => setCreatedResult(null)} style={{ minWidth: '100px' }}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
