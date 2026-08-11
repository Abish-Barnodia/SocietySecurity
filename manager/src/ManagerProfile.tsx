import { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const ManagerProfile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          setProfile(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="card">Loading profile...</div>;
  if (!profile) return <div className="card">Error loading profile data.</div>;

  const managerData = profile.manager || {};
  const propertyName = managerData.property?.name || 'No Property Assigned';

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account, security settings, and preferences</p>
        </div>
        <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Edit Profile
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Icon name="user" size={48} />
          </div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{managerData.name || 'Admin'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>{profile.role === 'MANAGER' ? 'Facility Manager' : profile.role}</p>
          <p style={{ color: 'var(--text-sidebar)', fontSize: 13, marginBottom: 16 }}>{propertyName}</p>
          
          <div style={{ padding: '6px 12px', background: '#E6FBF5', color: '#00A676', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00A676' }}></span> Online
          </div>

          <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', margin: '24px 0 16px' }}></div>
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Role Status</span>
              <span style={{ fontWeight: 500 }}>{profile.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Member since</span>
              <span style={{ fontWeight: 500 }}>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 24 }}>
            <button className="tab-btn active"><Icon name="user" size={16} /> General</button>
            <button className="tab-btn"><Icon name="shield" size={16} /> Security</button>
            <button className="tab-btn"><Icon name="bell" size={16} /> Notifications</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Full Name</label>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{managerData.name || 'N/A'}</div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Role</label>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{profile.role === 'MANAGER' ? 'Facility Manager' : profile.role}</div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Email</label>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{profile.email || 'N/A'}</div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Phone</label>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{profile.phone || 'N/A'}</div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Assigned Property</label>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{propertyName}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerProfile;
