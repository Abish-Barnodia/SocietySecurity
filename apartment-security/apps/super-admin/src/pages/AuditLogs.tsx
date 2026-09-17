import React, { useState, useEffect } from 'react';
import { PlatformAuditLog } from '../types';
import { superAdminService } from '../services/superAdmin.service';
import { Pagination } from '../components/common/Pagination';
import { Icon } from '@iconify/react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<PlatformAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await superAdminService.getAuditLogs();
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Client-side pagination
  const totalItems = logs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Platform Owner Audit Trail
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Cryptographically immutable record of platform operations & society lifecycle
        </p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Super Admin User</th>
                <th>Action</th>
                <th>Target Entity</th>
                <th>Metadata / Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>
                    <Icon icon="solar:restart-bold" className="animate-spin" width="24" color="var(--primary)" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.775rem' }}>
                        {log.actorEmail || log.actorUserId}
                      </code>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--indigo-bg)',
                        color: 'var(--indigo)',
                        border: '1px solid var(--indigo-border)',
                        fontWeight: 700,
                        fontSize: '0.725rem',
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', fontWeight: 600 }}>{log.targetType}</div>
                      {log.targetId && (
                        <code style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{log.targetId}</code>
                      )}
                    </td>
                    <td>
                      <pre style={{
                        fontSize: '0.725rem',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-xs)',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {JSON.stringify(log.metadata || {})}
                      </pre>
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
