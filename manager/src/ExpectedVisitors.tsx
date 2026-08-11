import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const ExpectedVisitors = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  
  const [passes, setPasses] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [typeFilter, setTypeFilter] = useState('All Types');

  // Modals
  const [selectedPass, setSelectedPass] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Form State
  const [addForm, setAddForm] = useState({
    visitorName: '',
    visitorPhone: '',
    type: 'ONE_TIME',
    purpose: '',
    validFrom: '',
    validUntil: '',
    unitId: ''
  });

  const fetchData = async () => {
    try {
      // Fetch Passes
      const resPasses = await fetch(`${API_BASE}/passes/all`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (resPasses.ok) {
        const data = await resPasses.json();
        setPasses(data.data?.passes || []);
      }

      // Fetch Residents (for Unit selection in Add Pass)
      const resResidents = await fetch(`${API_BASE}/residents`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (resResidents.ok) {
        const data = await resResidents.json();
        setResidents(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/passes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...addForm,
          validFrom: new Date(addForm.validFrom).toISOString(),
          validUntil: new Date(addForm.validUntil).toISOString()
        })
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setAddForm({ visitorName: '', visitorPhone: '', type: 'ONE_TIME', purpose: '', validFrom: '', validUntil: '', unitId: '' });
        fetchData(); // Refresh list immediately
      } else {
        const error = await res.json();
        alert(`Failed to add pass: ${error.message}`);
      }
    } catch (err) {
      alert('An error occurred while creating the pass.');
      console.error(err);
    }
  };

  const getStatusDisplay = (status: string, validFrom: string, validUntil: string) => {
    const now = new Date();
    const start = new Date(validFrom);
    const end = new Date(validUntil);
    
    if (status === 'ACTIVE') {
      if (now > end) return { label: 'expired', bg: '#FEE2E2', text: '#DC2626' };
      if (now < start) return { label: 'pending', bg: '#F3F4F6', text: '#4B5563' };
      return { label: 'approved', bg: '#D1FAE5', text: '#059669' };
    }
    
    if (status === 'SUSPENDED') return { label: 'suspended', bg: '#FEF3C7', text: '#D97706' };
    if (status === 'REVOKED') return { label: 'revoked', bg: '#FEE2E2', text: '#DC2626' };
    
    return { label: status.toLowerCase(), bg: '#F3F4F6', text: '#4B5563' };
  };

  const filteredPasses = passes.filter(pass => {
    const statusInfo = getStatusDisplay(pass.status, pass.validFrom, pass.validUntil);
    
    // Status Filter
    if (statusFilter !== 'All Status' && statusInfo.label.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    
    // Type Filter mappings
    if (typeFilter !== 'All Types') {
      const typeMap: Record<string, string> = {
        'One Time': 'ONE_TIME',
        'Recurring': 'RECURRING',
        'Delivery': 'DELIVERY',
        'Contractor': 'CONTRACTOR'
      };
      
      const expectedType = typeMap[typeFilter] || typeFilter;
      if (pass.type !== expectedType) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto', backgroundColor: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Expected Visitors</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Full categorized view of expected visitors — pending approvals, active check-ins, delivery tracking, and service personnel</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', 
            borderRadius: 6, backgroundColor: 'var(--primary)', color: 'white', border: 'none', 
            fontWeight: 600, fontSize: 14, cursor: 'pointer' 
          }}
        >
          + Add Visitor
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontSize: 14 }}
        >
          <option>All Status</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Expired</option>
          <option>Suspended</option>
          <option>Revoked</option>
        </select>
        <select 
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontSize: 14 }}
        >
          <option>All Types</option>
          <option>One Time</option>
          <option>Recurring</option>
          <option>Delivery</option>
          <option>Contractor</option>
        </select>
        <div style={{ padding: '8px 12px', color: '#6B7280', fontSize: 14, display: 'flex', alignItems: 'center' }}>
          {filteredPasses.length} visitors
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: 16 
      }}>
        {filteredPasses.length === 0 && !loading && (
          <div style={{ gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: '#9CA3AF', border: '1px dashed #E5E7EB', borderRadius: 8 }}>
            No expected visitors match your filters.
          </div>
        )}
        {filteredPasses.map(pass => {
          const status = getStatusDisplay(pass.status, pass.validFrom, pass.validUntil);
          const initial = pass.visitorName ? pass.visitorName.charAt(0).toUpperCase() : 'V';
          
          return (
            <div key={pass.id} style={{ 
              border: '1px solid #E5E7EB', borderRadius: 8, padding: 16, backgroundColor: 'white',
              display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ 
                    width: 40, height: 40, borderRadius: '50%', backgroundColor: '#F3F4F6', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: '#4B5563', fontWeight: 600, fontSize: 16 
                  }}>
                    {initial}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {pass.visitorName}
                    </h3>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                      {pass.type?.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
                <span style={{ 
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                  backgroundColor: status.bg, color: status.text
                }}>
                  {status.label}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9CA3AF' }}>Host</span>
                  <span style={{ color: '#374151', fontWeight: 500, textAlign: 'right' }}>
                    {pass.resident?.name || 'Unknown'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9CA3AF' }}>Unit</span>
                  <span style={{ color: '#374151', fontWeight: 500 }}>
                    {pass.unit?.tower ? `${pass.unit.tower}-${pass.unit.unitNumber}` : pass.unit?.unitNumber || 'Unknown'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9CA3AF' }}>Expected</span>
                  <span style={{ color: '#374151', fontWeight: 500 }}>
                    {new Date(pass.validFrom).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {pass.purpose && (
                  <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: 6, color: '#6B7280', fontSize: 12 }}>
                    {pass.purpose}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setSelectedPass(pass)}
                  style={{ color: 'var(--primary)', background: 'none', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Details
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Details Modal */}
      {selectedPass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pass Details</h2>
              <button onClick={() => setSelectedPass(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><Icon name="x" size={20}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Visitor Name</span>
                <span style={{ fontWeight: 600, color: '#111827' }}>{selectedPass.visitorName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Visitor Phone</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>{selectedPass.visitorPhone || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Pass Type</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>{selectedPass.type}</span>
              </div>
              <div style={{ height: 1, backgroundColor: '#E5E7EB', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Host Resident</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>{selectedPass.resident?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Unit</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>
                  {selectedPass.unit?.tower ? `${selectedPass.unit.tower}-${selectedPass.unit.unitNumber}` : selectedPass.unit?.unitNumber}
                </span>
              </div>
              <div style={{ height: 1, backgroundColor: '#E5E7EB', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Valid From</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>{new Date(selectedPass.validFrom).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Valid Until</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>{new Date(selectedPass.validUntil).toLocaleString()}</span>
              </div>
              {selectedPass.purpose && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: '#6B7280', display: 'block', marginBottom: 4 }}>Purpose / Notes</span>
                  <div style={{ padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: 6, color: '#374151' }}>
                    {selectedPass.purpose}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button 
                onClick={() => setSelectedPass(null)}
                style={{ width: '100%', padding: '10px', borderRadius: 6, backgroundColor: 'white', border: '1px solid #E5E7EB', color: '#4B5563', fontWeight: 500, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Visitor Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 32, width: 500, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Add Visitor</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><Icon name="x" size={24}/></button>
            </div>
            
            <form onSubmit={handleAddPass} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Visitor Name</label>
                <input 
                  type="text" required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                  value={addForm.visitorName} onChange={e => setAddForm({...addForm, visitorName: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Phone (Optional)</label>
                  <input 
                    type="text"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                    value={addForm.visitorPhone} onChange={e => setAddForm({...addForm, visitorPhone: e.target.value})}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Pass Type</label>
                  <select 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box', backgroundColor: 'white' }}
                    value={addForm.type} onChange={e => setAddForm({...addForm, type: e.target.value})}
                  >
                    <option value="ONE_TIME">One Time</option>
                    <option value="RECURRING">Recurring</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="CONTRACTOR">Contractor</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Host Unit</label>
                <select 
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box', backgroundColor: 'white' }}
                  value={addForm.unitId} onChange={e => setAddForm({...addForm, unitId: e.target.value})}
                >
                  <option value="">Select a unit...</option>
                  {residents.map(r => r.unit).filter((v,i,a) => a.findIndex(t => t?.id === v?.id) === i).filter(Boolean).map(u => (
                    <option key={u.id} value={u.id}>{u.tower} - {u.unitNumber}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Valid From</label>
                  <input 
                    type="datetime-local" required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                    value={addForm.validFrom} onChange={e => setAddForm({...addForm, validFrom: e.target.value})}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Valid Until</label>
                  <input 
                    type="datetime-local" required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                    value={addForm.validUntil} onChange={e => setAddForm({...addForm, validUntil: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Purpose / Notes</label>
                <input 
                  type="text"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                  value={addForm.purpose} onChange={e => setAddForm({...addForm, purpose: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 6, backgroundColor: 'white', border: '1px solid #E5E7EB', color: '#4B5563', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ flex: 1, padding: '12px', borderRadius: 6, backgroundColor: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExpectedVisitors;
