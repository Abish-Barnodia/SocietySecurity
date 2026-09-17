import React, { useState, useEffect } from 'react';
import { DemoRequest } from '../types';
import { superAdminService } from '../services/superAdmin.service';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProvisionSocietyModal } from '../components/societies/ProvisionSocietyModal';
import { Pagination } from '../components/common/Pagination';
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
                <th>Date Received</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                    <Icon icon="solar:restart-bold" className="animate-spin" width="24" color="var(--primary)" />
                  </td>
                </tr>
              ) : demos.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
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
                    <td>
                      <div style={{ fontSize: '0.825rem' }}>{demo.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{demo.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{demo.city || '—'}</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                        {demo.numberOfUnits ? `${demo.numberOfUnits} Units` : 'Size unspecified'}
                      </div>
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
                        {demo.status === 'PENDING' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Mark as Contacted"
                            onClick={() => handleUpdateStatus(demo.id, 'CONTACTED')}
                          >
                            <Icon icon="solar:phone-calling-bold" width="14" />
                            Contacted
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
    </div>
  );
};
