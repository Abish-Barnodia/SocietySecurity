import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import EmptyState from './EmptyState';

// Mock UI — no physical camera integration exists in this app (confirmed
// during the Settings audit). Thumbnails are real photos from Picsum
// (stable, no API key) used as stand-ins for camera footage; a seed per
// camera keeps each one's image consistent across renders.
type CameraStatus = 'recording' | 'online' | 'issue';

interface Camera {
  id: string;
  name: string;
  location: string;
  areaType: string;
  resolution: string;
  fps: number;
  status: CameraStatus;
  lastMotion: string;
  uptime: string;
  seed: string;
}

const AREA_TYPES = ['All Types', 'Gates', 'Parking', 'Amenities', 'Common Areas', 'Perimeter'];

const CAMERAS: Camera[] = [
  // Gates
  { id: 'gate-main-entry', name: 'Main Gate Entry', location: 'Main Gate', areaType: 'Gates', resolution: '4K', fps: 30, status: 'recording', lastMotion: 'Just now', uptime: '14d 7h 32m', seed: 'gate1' },
  { id: 'gate-main-exit', name: 'Main Gate Exit', location: 'Main Gate', areaType: 'Gates', resolution: '4K', fps: 30, status: 'recording', lastMotion: '2 min ago', uptime: '14d 7h 30m', seed: 'gate2' },
  { id: 'gate-main-overview', name: 'Main Gate Overview', location: 'Main Gate', areaType: 'Gates', resolution: '1080p', fps: 25, status: 'online', lastMotion: '30 sec ago', uptime: '7d 2h 15m', seed: 'gate3' },
  { id: 'gate-main-pedestrian', name: 'Main Gate Pedestrian', location: 'Main Gate', areaType: 'Gates', resolution: '1080p', fps: 25, status: 'online', lastMotion: '4 min ago', uptime: '11d 1h 5m', seed: 'gate4' },
  { id: 'gate-service-entry', name: 'Service Gate Entry', location: 'Service Gate', areaType: 'Gates', resolution: '4K', fps: 30, status: 'recording', lastMotion: '5 min ago', uptime: '21d 12h 44m', seed: 'gate5' },
  { id: 'gate-service-exit', name: 'Service Gate Exit', location: 'Service Gate', areaType: 'Gates', resolution: '1080p', fps: 25, status: 'online', lastMotion: '9 min ago', uptime: '21d 12h 40m', seed: 'gate6' },
  { id: 'gate-back', name: 'Back Gate', location: 'Back Gate', areaType: 'Gates', resolution: '1080p', fps: 20, status: 'issue', lastMotion: '3h ago', uptime: '—', seed: 'gate7' },

  // Parking
  { id: 'parking-entry', name: 'Parking Entry Barrier', location: 'Parking Entry', areaType: 'Parking', resolution: '4K', fps: 30, status: 'recording', lastMotion: '1 min ago', uptime: '9d 4h 2m', seed: 'park1' },
  { id: 'parking-exit', name: 'Parking Exit Barrier', location: 'Parking Exit', areaType: 'Parking', resolution: '4K', fps: 30, status: 'recording', lastMotion: '3 min ago', uptime: '9d 4h 0m', seed: 'park2' },
  { id: 'parking-ramp', name: 'Parking Ramp', location: 'Parking Ramp', areaType: 'Parking', resolution: '1080p', fps: 25, status: 'online', lastMotion: '12 min ago', uptime: '6d 18h 20m', seed: 'park3' },
  { id: 'parking-b1-north', name: 'Parking Level B1 — North', location: 'Parking B1', areaType: 'Parking', resolution: '1080p', fps: 20, status: 'online', lastMotion: '20 min ago', uptime: '30d 0h 0m', seed: 'park4' },
  { id: 'parking-b1-south', name: 'Parking Level B1 — South', location: 'Parking B1', areaType: 'Parking', resolution: '1080p', fps: 20, status: 'online', lastMotion: '18 min ago', uptime: '30d 0h 0m', seed: 'park5' },
  { id: 'parking-b2-north', name: 'Parking Level B2 — North', location: 'Parking B2', areaType: 'Parking', resolution: '1080p', fps: 20, status: 'recording', lastMotion: '6 min ago', uptime: '30d 0h 0m', seed: 'park6' },
  { id: 'parking-b2-south', name: 'Parking Level B2 — South', location: 'Parking B2', areaType: 'Parking', resolution: '1080p', fps: 20, status: 'issue', lastMotion: '1d ago', uptime: '—', seed: 'park7' },

  // Amenities
  { id: 'amenity-clubhouse', name: 'Clubhouse', location: 'Clubhouse', areaType: 'Amenities', resolution: '1080p', fps: 25, status: 'online', lastMotion: '25 min ago', uptime: '5d 3h 12m', seed: 'amen1' },
  { id: 'amenity-clubhouse-entrance', name: 'Clubhouse Entrance', location: 'Clubhouse', areaType: 'Amenities', resolution: '1080p', fps: 25, status: 'recording', lastMotion: '2 min ago', uptime: '5d 3h 10m', seed: 'amen2' },
  { id: 'amenity-gym', name: 'Gym', location: 'Gym', areaType: 'Amenities', resolution: '1080p', fps: 20, status: 'online', lastMotion: '40 min ago', uptime: '18d 6h 0m', seed: 'amen3' },
  { id: 'amenity-kids', name: 'Kids Play Area', location: 'Kids Play Area', areaType: 'Amenities', resolution: '1080p', fps: 25, status: 'recording', lastMotion: '1 min ago', uptime: '18d 6h 2m', seed: 'amen4' },
  { id: 'amenity-pool', name: 'Swimming Pool', location: 'Swimming Pool', areaType: 'Amenities', resolution: '4K', fps: 30, status: 'online', lastMotion: '15 min ago', uptime: '12d 9h 40m', seed: 'amen5' },
  { id: 'amenity-jog-n', name: 'Jogging Track — North', location: 'Jogging Track', areaType: 'Amenities', resolution: '1080p', fps: 25, status: 'online', lastMotion: '8 min ago', uptime: '12d 9h 38m', seed: 'amen6' },

  // Common Areas
  { id: 'lobby-a', name: 'Tower A Lobby', location: 'Tower A Lobby', areaType: 'Common Areas', resolution: '4K', fps: 30, status: 'recording', lastMotion: 'Just now', uptime: '25d 1h 0m', seed: 'lobby1' },
  { id: 'lobby-a-corridor', name: 'Tower A Corridor', location: 'Tower A Lobby', areaType: 'Common Areas', resolution: '1080p', fps: 20, status: 'online', lastMotion: '7 min ago', uptime: '25d 0h 58m', seed: 'lobby2' },
  { id: 'lobby-b', name: 'Tower B Lobby', location: 'Tower B Lobby', areaType: 'Common Areas', resolution: '4K', fps: 30, status: 'recording', lastMotion: '3 min ago', uptime: '25d 1h 0m', seed: 'lobby3' },
  { id: 'lobby-b-corridor', name: 'Tower B Corridor', location: 'Tower B Lobby', areaType: 'Common Areas', resolution: '1080p', fps: 20, status: 'online', lastMotion: '10 min ago', uptime: '25d 0h 55m', seed: 'lobby4' },
  { id: 'lobby-c', name: 'Tower C Lobby', location: 'Tower C Lobby', areaType: 'Common Areas', resolution: '4K', fps: 30, status: 'online', lastMotion: '22 min ago', uptime: '25d 1h 0m', seed: 'lobby5' },
  { id: 'lobby-c-corridor', name: 'Tower C Corridor', location: 'Tower C Lobby', areaType: 'Common Areas', resolution: '1080p', fps: 20, status: 'online', lastMotion: '19 min ago', uptime: '25d 0h 50m', seed: 'lobby6' },

  // Perimeter
  { id: 'perimeter-north', name: 'Perimeter North', location: 'Perimeter North', areaType: 'Perimeter', resolution: '1080p', fps: 25, status: 'online', lastMotion: '35 min ago', uptime: '40d 2h 0m', seed: 'perim1' },
  { id: 'perimeter-south', name: 'Perimeter South', location: 'Perimeter South', areaType: 'Perimeter', resolution: '1080p', fps: 25, status: 'online', lastMotion: '28 min ago', uptime: '40d 2h 0m', seed: 'perim2' },
  { id: 'perimeter-east', name: 'Perimeter East', location: 'Perimeter East', areaType: 'Perimeter', resolution: '1080p', fps: 25, status: 'recording', lastMotion: '4 min ago', uptime: '40d 1h 55m', seed: 'perim3' },
  { id: 'perimeter-east-2', name: 'Perimeter East — Annex', location: 'Perimeter East', areaType: 'Perimeter', resolution: '1080p', fps: 20, status: 'online', lastMotion: '31 min ago', uptime: '40d 1h 50m', seed: 'perim4' },
  { id: 'perimeter-west', name: 'Perimeter West', location: 'Perimeter West', areaType: 'Perimeter', resolution: '1080p', fps: 25, status: 'online', lastMotion: '17 min ago', uptime: '40d 2h 0m', seed: 'perim5' },
  { id: 'perimeter-west-2', name: 'Perimeter West — Annex', location: 'Perimeter West', areaType: 'Perimeter', resolution: '1080p', fps: 20, status: 'issue', lastMotion: '6h ago', uptime: '—', seed: 'perim6' },
  { id: 'perimeter-ne', name: 'Perimeter Northeast', location: 'Perimeter North', areaType: 'Perimeter', resolution: '1080p', fps: 20, status: 'online', lastMotion: '14 min ago', uptime: '40d 1h 45m', seed: 'perim7' },
  { id: 'gate-service-loading', name: 'Service Gate — Loading Bay', location: 'Service Gate', areaType: 'Gates', resolution: '1080p', fps: 20, status: 'online', lastMotion: '2 min ago', uptime: '21d 12h 30m', seed: 'gate8' },
  { id: 'amenity-jog-s', name: 'Jogging Track — South', location: 'Jogging Track', areaType: 'Amenities', resolution: '1080p', fps: 25, status: 'online', lastMotion: '11 min ago', uptime: '12d 9h 30m', seed: 'amen7' },
  { id: 'amenity-gym-entrance', name: 'Gym Entrance', location: 'Gym', areaType: 'Amenities', resolution: '1080p', fps: 20, status: 'recording', lastMotion: '5 min ago', uptime: '18d 5h 58m', seed: 'amen8' },
];

const STATUS_STYLE: Record<CameraStatus, { bg: string; text: string; label: string }> = {
  recording: { bg: '#FEF3C7', text: '#B45309', label: 'Recording' },
  online: { bg: '#E0F2FE', text: '#0369A1', label: 'Online' },
  issue: { bg: '#FEE2E2', text: '#991B1B', label: 'Issue' },
};

const thumbUrl = (seed: string, w = 480, h = 360) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const formatClock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        border: active ? '1px solid var(--primary)' : '1px solid var(--border-color)',
        background: active ? 'var(--primary)' : 'white',
        color: active ? 'white' : 'var(--text-main)',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

const CCTVMonitoring: React.FC = () => {
  const [areaType, setAreaType] = useState('All Types');
  const [location, setLocation] = useState<string | null>(null);
  const [activeCamera, setActiveCamera] = useState<Camera | null>(null);
  const [clock] = useState(formatClock);

  const locations = useMemo(() => {
    const pool = areaType === 'All Types' ? CAMERAS : CAMERAS.filter((c) => c.areaType === areaType);
    return Array.from(new Set(pool.map((c) => c.location))).sort();
  }, [areaType]);

  const handleAreaType = (type: string) => {
    setAreaType(type);
    setLocation(null); // location options change with area type, so any prior pick may no longer apply
  };

  const filtered = useMemo(() => {
    return CAMERAS.filter((c) => {
      if (areaType !== 'All Types' && c.areaType !== areaType) return false;
      if (location && c.location !== location) return false;
      return true;
    });
  }, [areaType, location]);

  const counts = useMemo(() => {
    const online = CAMERAS.filter((c) => c.status === 'online' || c.status === 'recording').length;
    const recording = CAMERAS.filter((c) => c.status === 'recording').length;
    const issue = CAMERAS.filter((c) => c.status === 'issue').length;
    return { online, recording, issue };
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>CCTV Monitoring</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
            Live surveillance across all gates, parking areas, amenities, common areas, and perimeter — {CAMERAS.length} cameras
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-main)', paddingTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
            {counts.online} Online
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} />
            {counts.recording} Recording
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
            {counts.issue} Issue
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-value">{CAMERAS.length}</div><div className="stat-title">Total Cameras</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--success)' }}>{counts.online}</div><div className="stat-title">Online</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#B45309' }}>{counts.recording}</div><div className="stat-title">Recording</div></div>
        <div className="stat-card"><div className="stat-value">5.5 TB</div><div className="stat-title">Storage Free</div></div>
        <div className="stat-card"><div className="stat-value">90d</div><div className="stat-title">Retention</div></div>
        <div className="stat-card"><div className="stat-value">8.7 TB</div><div className="stat-title">of 14.2 TB</div></div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>AREA TYPE</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {AREA_TYPES.map((type) => (
            <Chip key={type} label={type} active={areaType === type} onClick={() => handleAreaType(type)} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>LOCATION</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {locations.map((loc) => (
            <Chip key={loc} label={loc} active={location === loc} onClick={() => setLocation(location === loc ? null : loc)} />
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Showing {filtered.length} of {CAMERAS.length} cameras
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon="video-off" message="No cameras match this filter." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {filtered.map((cam) => {
            const s = STATUS_STYLE[cam.status];
            return (
              <div
                key={cam.id}
                onClick={() => setActiveCamera(cam)}
                style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#0F172A' }}>
                  <img src={thumbUrl(cam.seed)} alt={cam.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.4) 100%)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontSize: 12, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{cam.name}</div>
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    {cam.status === 'recording' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.55)', color: 'white', padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} /> REC
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.55)', color: cam.status === 'issue' ? '#FCA5A5' : '#6EE7B7', padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cam.status === 'issue' ? '#EF4444' : '#10B981' }} /> {cam.status === 'issue' ? 'OFFLINE' : 'LIVE'}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, left: 10, color: 'white', fontSize: 11, fontFamily: 'monospace', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{clock}</div>
                </div>

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                      <Icon name="building" size={13} color="var(--text-muted)" /> {cam.location}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: s.bg, color: s.text }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Resolution</div>
                      <div style={{ fontWeight: 600 }}>{cam.resolution}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>FPS</div>
                      <div style={{ fontWeight: 600 }}>{cam.fps}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Last Motion</div>
                      <div style={{ fontWeight: 600 }}>{cam.lastMotion}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Uptime</div>
                      <div style={{ fontWeight: 600 }}>{cam.uptime}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeCamera && (
        <div className="modal-overlay" onClick={() => setActiveCamera(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: '92vw' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{activeCamera.name}</h3>
                <p className="modal-subtitle">{activeCamera.location} · {activeCamera.areaType}</p>
              </div>
              <button className="modal-close" onClick={() => setActiveCamera(null)}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ position: 'relative', background: '#0F172A' }}>
              <img src={thumbUrl(activeCamera.seed, 1000, 620)} alt={activeCamera.name} style={{ width: '100%', display: 'block', maxHeight: '55vh', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 10, left: 14, color: 'white', fontSize: 12, fontFamily: 'monospace', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{clock}</div>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
                <div style={{ fontWeight: 600, color: STATUS_STYLE[activeCamera.status].text }}>{STATUS_STYLE[activeCamera.status].label}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Resolution</div>
                <div style={{ fontWeight: 600 }}>{activeCamera.resolution}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>FPS</div>
                <div style={{ fontWeight: 600 }}>{activeCamera.fps}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Uptime</div>
                <div style={{ fontWeight: 600 }}>{activeCamera.uptime}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CCTVMonitoring;
