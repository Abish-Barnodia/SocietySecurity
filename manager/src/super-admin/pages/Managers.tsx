import React, { useState, useEffect } from 'react';
import type { Manager } from '../types';
import { superAdminService } from '../services/superAdmin.service';
import { StatusBadge } from '../components/common/StatusBadge';
import { Pagination } from '../components/common/Pagination';
import { Icon } from '@iconify/react';

export const Managers: React.FC = () => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const fetchManagers = async () => {
    setIsLoading(true);
    try {
      const data = await superAdminService.getAllManagers(search || undefined);
      setManagers(data || []);
    } catch (err) {
      console.error('Failed to load managers', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchManagers();
  }, [search]);

  // Client-side pagination
  const totalItems = managers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedManagers = managers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '440px' }}>
          <input
            type="text"
            placeholder="Search managers by name, email, society..."
            className="input"
            style={{ paddingLeft: '36px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Icon icon="solar:magnifer-bold" width="16" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Manager Name</th>
                <th>Society / Tenant</th>
                <th>Email & Phone</th>
                <th>Account Status</th>
                <th>Last Active</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                    <Icon icon="solar:restart-bold" className="animate-spin" width="24" color="var(--primary)" />
                  </td>
                </tr>
              ) : managers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No manager accounts found.
                  </td>
                </tr>
              ) : (
                paginatedManagers.map((manager) => (
                  <tr key={manager.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{manager.name}</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>ID: {manager.id.substring(0, 8)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{manager.property?.name || 'Unassigned'}</div>
                      <div style={{ fontSize: '0.725rem', color: '#818cf8' }}>
                        <code>{manager.property?.slug}</code>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.825rem' }}>{manager.user?.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{manager.user?.phone}</div>
                    </td>
                    <td>
                      <StatusBadge status={manager.user?.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>
                        {manager.user?.lastLoginAt ? new Date(manager.user.lastLoginAt).toLocaleString() : 'Never logged in'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>{new Date(manager.createdAt).toLocaleDateString()}</div>
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
    </div>
  );
};
