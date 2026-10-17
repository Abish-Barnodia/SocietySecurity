import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import Icon from './Icon';
import ClockTimePicker from './ClockTimePicker';
import { API_BASE } from './config';

const WEEK_DAYS: { label: string; value: string }[] = [
  { label: 'Mon', value: 'MONDAY' },
  { label: 'Tue', value: 'TUESDAY' },
  { label: 'Wed', value: 'WEDNESDAY' },
  { label: 'Thu', value: 'THURSDAY' },
  { label: 'Fri', value: 'FRIDAY' },
  { label: 'Sat', value: 'SATURDAY' },
  { label: 'Sun', value: 'SUNDAY' },
];

// hour is 1-12 + AM/PM here, but the backend/Date constructor both need 24h.
const to24Hour = (hour: string, minute: string, period: string) => {
  let h = parseInt(hour, 10) % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
};

const blankAddForm = () => ({
  visitorName: '', visitorPhone: '', type: 'ONE_TIME', purpose: '', unitId: '',
  validFromDate: '', validFromHour: '9', validFromMinute: '00', validFromPeriod: 'AM',
  validUntilDate: '', validUntilHour: '6', validUntilMinute: '00', validUntilPeriod: 'PM',
  entryStartHour: '8', entryStartMinute: '00', entryStartPeriod: 'AM',
  entryEndHour: '6', entryEndMinute: '00', entryEndPeriod: 'PM',
  expiresOnDate: '',
  recurringDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as string[],
});

const ExpectedVisitors = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  
  const [passes, setPasses] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Modals
  const [selectedPass, setSelectedPass] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Form State
  const [addForm, setAddForm] = useState(blankAddForm());

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

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setAddForm(blankAddForm());
  };

  const getPassCode = (pass: any) => `PASS-${pass.id.slice(-8).toUpperCase()}`;
  const passUnitLabel = (pass: any) => pass.unit?.tower ? `${pass.unit.tower}-${pass.unit.unitNumber}` : pass.unit?.unitNumber || 'the property';
  const getPassVerificationUrl = (pass: any) => {
    if (!pass?.qrPayload) return '';
    return `${window.location.origin}/verify-pass?token=${encodeURIComponent(pass.qrPayload)}`;
  };

  // Draws the same visitor-pass card the resident app generates (name, QR,
  // validity) onto a canvas so the actual scannable QR travels as an image -
  // sharing plain text meant the guard had nothing to point a scanner at.
  const buildPassImageBlob = async (pass: any): Promise<Blob | null> => {
    const passUrl = getPassVerificationUrl(pass);
    if (!passUrl) return null;
    const qrDataUrl = await QRCode.toDataURL(passUrl, { width: 300, margin: 1 });
    const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = qrDataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 560;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(pass.visitorName, canvas.width / 2, 50);
    ctx.fillStyle = '#64748B';
    ctx.font = '16px sans-serif';
    ctx.fillText(pass.purpose || pass.type, canvas.width / 2, 78);

    ctx.drawImage(qrImg, 50, 110, 300, 300);

    ctx.fillStyle = '#16A34A';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(getPassCode(pass), canvas.width / 2, 445);
    ctx.fillStyle = '#374151';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Unit: ${passUnitLabel(pass)}`, canvas.width / 2, 470);
    ctx.fillText(`Valid: ${new Date(pass.validFrom).toLocaleString()} - ${new Date(pass.validUntil).toLocaleString()}`, canvas.width / 2, 492);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px sans-serif';
    ctx.fillText('SecureGate Visitor Pass', canvas.width / 2, 530);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sharePassAsImage = async (pass: any, target: 'whatsapp' | 'email') => {
    const blob = await buildPassImageBlob(pass);
    if (!blob) { alert('This pass has no scannable QR code to share.'); return; }
    const file = new File([blob], `${getPassCode(pass)}.png`, { type: 'image/png' });
    const passUrl = getPassVerificationUrl(pass);
    const shareText = `Hello ${pass.visitorName}, your visitor pass for ${passUnitLabel(pass)} is: ${getPassCode(pass)}. Verify & view details: ${passUrl}. Valid ${new Date(pass.validFrom).toLocaleString()} - ${new Date(pass.validUntil).toLocaleString()}.`;

    // Web Share API with a file lets the OS's native share sheet hand the
    // actual image to WhatsApp/Mail/etc - supported on most mobile browsers,
    // not on desktop Chrome/Edge/Firefox (no browser API can attach a file
    // to a wa.me link or a mailto: link - both are text-only by spec).
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Visitor Pass', text: shareText });
        return;
      } catch {
        return; // user cancelled the native share sheet
      }
    }

    downloadBlob(blob, file.name);
    if (target === 'whatsapp') {
      const phone = (pass.visitorPhone || '').replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(shareText)}`, '_blank');
      alert('Pass image downloaded. Attach it in the WhatsApp chat that just opened - browsers on desktop can\'t attach files to a link automatically.');
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(`Visitor Pass - ${pass.visitorName}`)}&body=${encodeURIComponent(shareText)}`;
      alert('Pass image downloaded. Attach it to the email draft that just opened - mailto links can\'t carry attachments.');
    }
  };

  const sharePassViaWhatsApp = (pass: any) => sharePassAsImage(pass, 'whatsapp');
  const sharePassViaEmail = (pass: any) => sharePassAsImage(pass, 'email');

  const toggleRecurringDay = (day: string) => {
    setAddForm(prev => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...prev.recurringDays, day],
    }));
  };

  const handleAddPass = async (e: React.FormEvent) => {
    e.preventDefault();

    const isRecurring = addForm.type === 'RECURRING';
    if (isRecurring && addForm.recurringDays.length === 0) {
      alert('Select at least one day of the week for a recurring pass.');
      return;
    }
    if (!isRecurring && (!addForm.validFromDate || !addForm.validUntilDate)) {
      alert('Valid From and Valid Until dates are required.');
      return;
    }
    if (isRecurring && !addForm.expiresOnDate) {
      alert('Pass expiry date is required for a recurring pass.');
      return;
    }

    // Recurring passes reuse the same top-level validFrom/validUntil window
    // as everything else (now → the day the recurring rule expires) - the
    // actual daily access window/days live in recurringRule instead.
    const validFrom = isRecurring ? new Date() : new Date(`${addForm.validFromDate}T${to24Hour(addForm.validFromHour, addForm.validFromMinute, addForm.validFromPeriod)}:00`);
    const validUntil = isRecurring
      ? new Date(`${addForm.expiresOnDate}T23:59:59`)
      : new Date(`${addForm.validUntilDate}T${to24Hour(addForm.validUntilHour, addForm.validUntilMinute, addForm.validUntilPeriod)}:00`);

    const payload: Record<string, unknown> = {
      visitorName: addForm.visitorName,
      visitorPhone: addForm.visitorPhone,
      type: addForm.type,
      purpose: addForm.purpose,
      unitId: addForm.unitId,
      validFrom: validFrom.toISOString(),
      validUntil: validUntil.toISOString(),
    };
    if (isRecurring) {
      payload.recurringRule = {
        allowedDays: addForm.recurringDays,
        windowStartTime: to24Hour(addForm.entryStartHour, addForm.entryStartMinute, addForm.entryStartPeriod),
        windowEndTime: to24Hour(addForm.entryEndHour, addForm.entryEndMinute, addForm.entryEndPeriod),
      };
    }

    try {
      const res = await fetch(`${API_BASE}/passes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setAddForm(blankAddForm());
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

    // Search query (visitor name, phone, host, unit, purpose)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const visitor = (pass.visitorName || '').toLowerCase();
      const phone = (pass.visitorPhone || '').toLowerCase();
      const host = (pass.resident?.name || '').toLowerCase();
      const unit = passUnitLabel(pass).toLowerCase();
      const purpose = (pass.purpose || '').toLowerCase();
      if (!visitor.includes(q) && !phone.includes(q) && !host.includes(q) && !unit.includes(q) && !purpose.includes(q)) {
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}>
            <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search visitor, host, unit..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 36, backgroundColor: 'white', width: '100%' }}
            />
          </div>
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

        {/* ponytail: view mode toggle for card vs dense list view when visitors scale to hundreds */}
        <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden', backgroundColor: '#F9FAFB', padding: 2 }}>
          <button
            type="button"
            onClick={() => setViewMode('card')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              backgroundColor: viewMode === 'card' ? 'white' : 'transparent',
              color: viewMode === 'card' ? '#111827' : '#6B7280',
              boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Icon name="layout-grid" size={15} /> Card
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              backgroundColor: viewMode === 'list' ? 'white' : 'transparent',
              color: viewMode === 'list' ? '#111827' : '#6B7280',
              boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Icon name="list" size={15} /> List
          </button>
        </div>
      </div>

      {filteredPasses.length === 0 && !loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', border: '1px dashed #E5E7EB', borderRadius: 8 }}>
          No expected visitors match your search or filters.
        </div>
      ) : viewMode === 'list' ? (
        /* Dense Table List View */
        <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr className="table-header-row">
                <th style={{ padding: '12px 18px' }}>Visitor</th>
                <th style={{ padding: '12px 18px' }}>Pass Type</th>
                <th style={{ padding: '12px 18px' }}>Unit</th>
                <th style={{ padding: '12px 18px' }}>Host Resident</th>
                <th style={{ padding: '12px 18px' }}>Created By</th>
                <th style={{ padding: '12px 18px' }}>Expected Date / Time</th>
                <th style={{ padding: '12px 18px' }}>Purpose / Notes</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPasses.map(pass => {
                const status = getStatusDisplay(pass.status, pass.validFrom, pass.validUntil);
                const initial = pass.visitorName ? pass.visitorName.charAt(0).toUpperCase() : 'V';
                const isManager = pass.createdByRole === 'MANAGER';
                const isGuard = pass.createdByRole === 'GUARD';
                const createdByLabel = isManager
                  ? (pass.createdByName || 'Manager')
                  : isGuard
                  ? (pass.createdByName || 'Guard')
                  : (pass.resident?.name ? `${pass.resident.name} (Resident)` : 'Resident');
                const unitStr = pass.unit?.tower ? `${pass.unit.tower}-${pass.unit.unitNumber}` : pass.unit?.unitNumber || 'Unknown';
                const expectedStr = new Date(pass.validFrom).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                return (
                  <tr key={pass.id} className="table-row" style={{ borderBottom: '1px solid #E5E7EB', cursor: 'pointer' }}
                    onClick={() => setSelectedPass(pass)}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', backgroundColor: '#F3F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#4B5563', fontWeight: 600, fontSize: 14, flexShrink: 0
                        }}>
                          {initial}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{pass.visitorName}</div>
                          {pass.visitorPhone && (
                            <div style={{ fontSize: 12, color: '#6B7280' }}>{pass.visitorPhone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 12 }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontWeight: 600, fontSize: 11,
                        backgroundColor: '#F3F4F6', color: '#374151', textTransform: 'capitalize'
                      }}>
                        {pass.type?.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {unitStr}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 13, color: '#374151' }}>
                      {pass.resident?.name || 'Unknown'}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 12 }}>
                      <span style={{
                        color: isManager ? '#0284c7' : isGuard ? '#d97706' : '#059669',
                        fontWeight: 600,
                        fontSize: 11,
                        backgroundColor: isManager ? '#F0F9FF' : isGuard ? '#FFFBEB' : '#ECFDF5',
                        padding: '2px 8px',
                        borderRadius: 6
                      }}>
                        {createdByLabel}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>
                      {expectedStr}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 12, color: '#6B7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pass.purpose || '—'}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: 12 }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        backgroundColor: status.bg, color: status.text
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedPass(pass)}
                        style={{
                          color: 'var(--primary)', backgroundColor: 'transparent',
                          border: '1px solid var(--border-color)', borderRadius: 6,
                          padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card Grid View */
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: 16 
        }}>
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
                  {/* ponytail: show whether pass was created by manager, guard, or resident */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#9CA3AF' }}>Created By</span>
                    <span style={{ 
                      color: pass.createdByRole === 'MANAGER' ? '#0284c7' : pass.createdByRole === 'GUARD' ? '#d97706' : '#059669', 
                      fontWeight: 600,
                      fontSize: 12,
                      backgroundColor: pass.createdByRole === 'MANAGER' ? '#F0F9FF' : pass.createdByRole === 'GUARD' ? '#FFFBEB' : '#ECFDF5',
                      padding: '2px 8px',
                      borderRadius: 6
                    }}>
                      {pass.createdByRole === 'MANAGER' 
                        ? (pass.createdByName || 'Manager') 
                        : pass.createdByRole === 'GUARD'
                        ? (pass.createdByName || 'Guard')
                        : (pass.resident?.name ? `${pass.resident.name} (Resident)` : 'Resident')}
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
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedPass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Pass Details</h2>
              <button onClick={() => setSelectedPass(null)} className="modal-close"><Icon name="x" size={18}/></button>
            </div>
            
            {selectedPass.qrPayload && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 20px' }}>
                <div style={{ padding: 12, background: 'white', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                  <QRCodeSVG value={getPassVerificationUrl(selectedPass)} size={180} />
                </div>
              </div>
            )}

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
                <span style={{ fontWeight: 500, color: '#374151' }}>{selectedPass.resident?.name || 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6B7280' }}>Created By</span>
                <span style={{ 
                  fontWeight: 600, 
                  color: selectedPass.createdByRole === 'MANAGER' ? '#0284c7' : '#059669',
                  fontSize: 12,
                  backgroundColor: selectedPass.createdByRole === 'MANAGER' ? '#F0F9FF' : '#ECFDF5',
                  padding: '2px 8px',
                  borderRadius: 6
                }}>
                  {selectedPass.createdByRole === 'MANAGER' 
                    ? (selectedPass.createdByName || 'Property Manager') 
                    : (selectedPass.resident?.name ? `${selectedPass.resident.name} (Resident)` : 'Resident')}
                </span>
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
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => sharePassViaWhatsApp(selectedPass)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 6, backgroundColor: '#25D366', border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                <Icon name="brand-whatsapp" size={16} /> WhatsApp
              </button>
              <button
                onClick={() => sharePassViaEmail(selectedPass)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 6, backgroundColor: 'white', border: '1px solid #E5E7EB', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                <Icon name="mail" size={16} /> Email
              </button>
            </div>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
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
              <button onClick={closeAddModal} className="modal-close"><Icon name="x" size={18}/></button>
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
                  {/* /residents (getAllResidents) already returns one grouped
                      entry per unit - {unitId, tower, apartmentNumber} - not
                      a nested `.unit` object, so this used to map every
                      family to `undefined` and filter the whole list away. */}
                  {residents.map(r => (
                    <option key={r.unitId} value={r.unitId}>{r.tower} - {r.apartmentNumber}</option>
                  ))}
                </select>
              </div>

              {addForm.type === 'RECURRING' ? (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>Days of the Week</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {WEEK_DAYS.map(d => {
                        const active = addForm.recurringDays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleRecurringDay(d.value)}
                            style={{
                              flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              border: active ? '1px solid var(--primary)' : '1px solid #E5E7EB',
                              backgroundColor: active ? 'var(--primary)' : 'white',
                              color: active ? 'white' : '#4B5563',
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Daily Entry Window</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <ClockTimePicker
                        hour={addForm.entryStartHour} minute={addForm.entryStartMinute} period={addForm.entryStartPeriod}
                        onChange={(h, m, p) => setAddForm({...addForm, entryStartHour: h, entryStartMinute: m, entryStartPeriod: p})}
                      />
                      <span style={{ color: '#9CA3AF', fontSize: 13 }}>to</span>
                      <ClockTimePicker
                        hour={addForm.entryEndHour} minute={addForm.entryEndMinute} period={addForm.entryEndPeriod}
                        onChange={(h, m, p) => setAddForm({...addForm, entryEndHour: h, entryEndMinute: m, entryEndPeriod: p})}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Pass Expires On</label>
                    <input
                      type="date" required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                      value={addForm.expiresOnDate} onChange={e => setAddForm({...addForm, expiresOnDate: e.target.value})}
                    />
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Valid From</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="date" required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                        value={addForm.validFromDate} onChange={e => setAddForm({...addForm, validFromDate: e.target.value})}
                      />
                      <ClockTimePicker
                        hour={addForm.validFromHour} minute={addForm.validFromMinute} period={addForm.validFromPeriod}
                        onChange={(h, m, p) => setAddForm({...addForm, validFromHour: h, validFromMinute: m, validFromPeriod: p})}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Valid Until</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="date" required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                        value={addForm.validUntilDate} onChange={e => setAddForm({...addForm, validUntilDate: e.target.value})}
                      />
                      <ClockTimePicker
                        hour={addForm.validUntilHour} minute={addForm.validUntilMinute} period={addForm.validUntilPeriod}
                        onChange={(h, m, p) => setAddForm({...addForm, validUntilHour: h, validUntilMinute: m, validUntilPeriod: p})}
                      />
                    </div>
                  </div>
                </div>
              )}

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
                  onClick={closeAddModal}
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
