import React, { useState, useEffect } from 'react';
import type { DemoRequest } from '../types';
import { superAdminService } from '../services/superAdmin.service';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProvisionSocietyModal } from '../components/societies/ProvisionSocietyModal';
import { Pagination } from '../components/common/Pagination';
import { TableSkeleton } from '../components/common/Skeleton';
import { Modal } from '../components/common/Modal';
import { Icon } from '@iconify/react';

interface DemoRequestsProps {
  onDemosUpdated?: () => void;
}

export const DemoRequests: React.FC<DemoRequestsProps> = ({ onDemosUpdated }) => {
  const [demos, setDemos] = useState<DemoRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [provisioningDemo, setProvisioningDemo] = useState<DemoRequest | null>(null);
  const [zoomedDoc, setZoomedDoc] = useState<{ url: string; name: string; society: string; contact: string } | null>(null);
  const [contactDemo, setContactDemo] = useState<DemoRequest | null>(null);
  const [copiedField, setCopiedField] = useState<'phone' | 'email' | null>(null);

  // ponytail: quick copy helper with visual confirmation
  const handleCopy = (text: string, field: 'phone' | 'email') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const fetchDemos = async () => {
    setIsLoading(true);
    try {
      const data = await superAdminService.getDemoRequests(
        statusFilter === 'ALL' ? undefined : statusFilter,
        search || undefined
      );
      setDemos(data || []);
    } catch (err) {
      console.error('Failed to fetch demo requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchDemos();
  }, [statusFilter, search]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await superAdminService.updateDemoStatus(id, status);
      fetchDemos();
      onDemosUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Client-side page slice
  const totalItems = demos.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedDemos = demos.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '500px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search by contact name, society, email, phone..."
              className="input"
              style={{ paddingLeft: '36px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Icon icon="solar:magnifer-bold" width="16" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
          </div>

          <select
            className="select"
            style={{ width: '160px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONTACTED">Contacted</option>
            <option value="CONVERTED">Converted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Demo Requests Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Society / Inquiry</th>
                <th>Contact Person</th>
                <th>Contact Info</th>
                <th>City & Units</th>
                <th>Verification Doc</th>
                <th>Date Received</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={8} />
              ) : demos.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No demo requests found.
                  </td>
                </tr>
              ) : (
                paginatedDemos.map((demo) => (
                  <tr key={demo.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{demo.societyName}</div>
                      {demo.message && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{demo.message}"
                        </div>
                      )}
                      {demo.createdProperty && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--emerald)' }}>
                          Tenant: <code>{demo.createdProperty.slug}</code>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{demo.contactName}</div>
                    </td>
                    <td
                      style={{ cursor: 'pointer' }}
                      onClick={() => setContactDemo(demo)}
                      title="Click to view contact options"
                    >
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>{demo.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{demo.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{demo.city || '—'}</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                        {demo.numberOfUnits ? `${demo.numberOfUnits} Units` : 'Size unspecified'}
                      </div>
                    </td>
                    <td>
                      {demo.documentUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isImageFile(demo.documentUrl, demo.documentName) ? (
                            <button
                              type="button"
                              onClick={() => setZoomedDoc({
                                url: demo.documentUrl!,
                                name: demo.documentName || 'Uploaded Verification Photo',
                                society: demo.societyName,
                                contact: demo.contactName,
                              })}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                padding: 0,
                                border: '1px solid rgba(0, 200, 150, 0.3)',
                                background: '#0f172a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                              title="Click to zoom photo"
                            >
                              <img
                                src={demo.documentUrl}
                                alt="Verification thumbnail"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </button>
                          ) : (
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '6px',
                              background: 'rgba(0, 200, 150, 0.1)',
                              border: '1px solid rgba(0, 200, 150, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#00A67C',
                              flexShrink: 0,
                            }}>
                              <Icon icon="solar:document-text-bold" width="18" />
                            </div>
                          )}

                          <a
                            href={demo.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.725rem',
                              padding: '3px 7px',
                              color: '#00A67C',
                              background: 'rgba(0, 200, 150, 0.08)',
                              border: '1px solid rgba(0, 200, 150, 0.25)',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                            title={demo.documentName || 'Open Document in New Tab'}
                          >
                            <Icon icon="solar:link-bold" width="13" />
                            <span>{isImageFile(demo.documentUrl, demo.documentName) ? 'Photo' : 'Doc'}</span>
                          </a>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>{new Date(demo.createdAt).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {new Date(demo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={demo.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {demo.status === 'PENDING' ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="View Contact Phone & Email"
                            onClick={() => setContactDemo(demo)}
                          >
                            <Icon icon="solar:phone-calling-bold" width="14" />
                            Contacted
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="View Contact Phone & Email"
                            onClick={() => setContactDemo(demo)}
                            style={{ opacity: 0.85 }}
                          >
                            <Icon icon="solar:phone-calling-bold" width="14" />
                            Contact
                          </button>
                        )}

                        {demo.status !== 'CONVERTED' ? (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              title="Approve & Provision Society"
                              onClick={() => setProvisioningDemo(demo)}
                            >
                              <Icon icon="solar:check-circle-bold" width="14" />
                              Provision
                            </button>
                            {demo.status !== 'REJECTED' && (
                              <button
                                className="btn btn-danger btn-sm"
                                title="Reject Lead"
                                onClick={() => handleUpdateStatus(demo.id, 'REJECTED')}
                              >
                                <Icon icon="solar:close-circle-bold" width="14" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Icon icon="solar:verified-check-bold" width="16" />
                            Provisioned
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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

      {/* Provisioning Modal */}
      {provisioningDemo && (
        <ProvisionSocietyModal
          isOpen={!!provisioningDemo}
          onClose={() => setProvisioningDemo(null)}
          demoRequest={provisioningDemo}
          onSuccess={() => {
            fetchDemos();
            onDemosUpdated?.();
          }}
        />
      )}

      {/* Lightbox Zoom Modal for Demo Request Verification Docs & Photos */}
      <Modal
        isOpen={Boolean(zoomedDoc)}
        onClose={() => setZoomedDoc(null)}
        title={zoomedDoc?.name || 'Verification Photo Preview'}
        maxWidth="800px"
      >
        {zoomedDoc && (
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
                src={zoomedDoc.url}
                alt="Verification full preview"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                {zoomedDoc.society} • Submitted by {zoomedDoc.contact}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={zoomedDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  <Icon icon="solar:arrow-right-up-bold" width="14" />
                  Open in New Tab
                </a>
                <button className="btn btn-primary btn-sm" onClick={() => setZoomedDoc(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Contact Requested Person Modal */}
      <Modal
        isOpen={Boolean(contactDemo)}
        onClose={() => setContactDemo(null)}
        title="Contact Requested Person"
        maxWidth="500px"
      >
        {contactDemo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Person & Society Info Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {contactDemo.contactName}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {contactDemo.societyName} {contactDemo.city ? `• ${contactDemo.city}` : ''}
                </div>
              </div>
              <StatusBadge status={contactDemo.status} />
            </div>

            {/* Phone Number Box */}
            <div style={{
              padding: '14px 16px',
              borderRadius: '8px',
              background: 'rgba(0, 200, 150, 0.05)',
              border: '1px solid rgba(0, 200, 150, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00A67C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Phone Number
                </span>
                {copiedField === 'phone' && (
                  <span style={{ fontSize: '0.725rem', color: '#00A67C', fontWeight: 700 }}>Copied!</span>
                )}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                {contactDemo.phone || 'No phone provided'}
              </div>
              {contactDemo.phone && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <a
                    href={`tel:${contactDemo.phone}`}
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Icon icon="solar:phone-calling-bold" width="14" />
                    Call
                  </a>
                  <a
                    href={`https://wa.me/${contactDemo.phone.replace(/\D/g, '').length === 10 ? `91${contactDemo.phone.replace(/\D/g, '')}` : contactDemo.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Icon icon="logos:whatsapp-icon" width="14" />
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(contactDemo.phone, 'phone')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Icon icon="solar:copy-bold" width="14" />
                    Copy
                  </button>
                </div>
              )}
            </div>

            {/* Email Address Box */}
            <div style={{
              padding: '14px 16px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Email Address
                </span>
                {copiedField === 'email' && (
                  <span style={{ fontSize: '0.725rem', color: '#3B82F6', fontWeight: 700 }}>Copied!</span>
                )}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {contactDemo.email || 'No email provided'}
              </div>
              {contactDemo.email && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <a
                    href={`mailto:${contactDemo.email}?subject=${encodeURIComponent(`SecureGate Demo Inquiry - ${contactDemo.societyName}`)}`}
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Icon icon="solar:letter-bold" width="14" />
                    Send Email
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(contactDemo.email, 'email')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Icon icon="solar:copy-bold" width="14" />
                    Copy
                  </button>
                </div>
              )}
            </div>

            {/* Inquiry Details if any */}
            {(contactDemo.message || contactDemo.numberOfUnits) && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.775rem',
                color: 'var(--text-dim)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                {contactDemo.numberOfUnits && (
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Estimated Units: </strong>
                    {contactDemo.numberOfUnits} Units
                  </div>
                )}
                {contactDemo.message && (
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Message: </strong>
                    <span style={{ fontStyle: 'italic' }}>"{contactDemo.message}"</span>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setContactDemo(null)}
              >
                Close
              </button>

              {contactDemo.status === 'PENDING' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    await handleUpdateStatus(contactDemo.id, 'CONTACTED');
                    setContactDemo(null);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon icon="solar:check-circle-bold" width="16" />
                  Mark as Contacted
                </button>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--emerald)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Icon icon="solar:verified-check-bold" width="16" />
                  Status: {contactDemo.status}
                </span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
