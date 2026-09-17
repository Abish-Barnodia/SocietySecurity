import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from './config';

// ─── Iconify CDN icon component (ponytail: no npm install needed) ─────────────
const Icon = ({ icon, size = 24, color = 'currentColor', style }: {
  icon: string; size?: number; color?: string; style?: React.CSSProperties;
}) => (
  <img
    src={`https://api.iconify.design/${icon}.svg?color=${encodeURIComponent(color)}`}
    width={size} height={size}
    style={{ display: 'inline-block', flexShrink: 0, ...style }}
    alt=""
  />
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface DemoForm {
  // Society Information
  societyName: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  flats: string;
  towers: string;
  // Contact & Manager Information
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  // Preferences & Scheduling
  selectedPlan: string;
  currentSecurity: string;
  demoDate: string;
  message: string;
}

const emptyDemo = (defaultPlan = ''): DemoForm => ({
  societyName: '',
  address: '',
  city: '',
  state: '',
  pin: '',
  flats: '',
  towers: '',
  managerName: '',
  managerPhone: '',
  managerEmail: '',
  selectedPlan: defaultPlan,
  currentSecurity: '',
  demoDate: '',
  message: '',
});

// ─── Scroll fade-in hook ─────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Filled green icon circle ─────────────────────────────────────────────────
const GreenIconCircle = ({ icon, size = 44 }: { icon: string; size?: number }) => (
  <div style={{
    width: size, height: size, borderRadius: size / 3,
    background: 'linear-gradient(135deg, #00C896 0%, #00A67C 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0,200,150,0.35)', flexShrink: 0,
  }}>
    <Icon icon={icon} size={size * 0.48} color="white" />
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  if (!open) return null;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, animation: 'lpFadeIn 0.2s ease',
    }}>
      {children}
    </div>
  );
};

// Helper to load Razorpay Checkout script dynamically
const loadRazorpaySdk = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay payment SDK'));
    document.body.appendChild(script);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
const LandingPage: React.FC<{ onGoToLogin: () => void }> = ({ onGoToLogin }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState<DemoForm>(emptyDemo());
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [paymentSuccessInfo, setPaymentSuccessInfo] = useState<{ paymentId: string; plan: string; society: string } | null>(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scrollTo = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError('');
    setDemoLoading(true);

    try {
      // 1. Ensure Razorpay SDK is loaded
      await loadRazorpaySdk();

      // 2. Request backend to create ₹1 order
      const orderRes = await fetch(`${API_BASE}/demo-requests/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.data?.orderId) {
        throw new Error(orderData.message || 'Unable to initiate Razorpay checkout order.');
      }

      const { orderId, keyId, amount } = orderData.data;

      const extraNotes: string[] = [];
      if (demoForm.address) extraNotes.push(`Address: ${demoForm.address}`);
      if (demoForm.state) extraNotes.push(`State: ${demoForm.state}`);
      if (demoForm.pin) extraNotes.push(`PIN: ${demoForm.pin}`);
      if (demoForm.towers) extraNotes.push(`Towers: ${demoForm.towers}`);
      if (demoForm.selectedPlan) extraNotes.push(`Interested Plan: ${demoForm.selectedPlan}`);
      if (demoForm.currentSecurity) extraNotes.push(`Current System: ${demoForm.currentSecurity}`);
      if (demoForm.demoDate) extraNotes.push(`Preferred Date: ${demoForm.demoDate}`);
      if (demoForm.message) extraNotes.push(`Requirements: ${demoForm.message}`);

      const formDataPayload = {
        contactName: demoForm.managerName,
        societyName: demoForm.societyName,
        phone: demoForm.managerPhone,
        email: demoForm.managerEmail,
        city: demoForm.city || undefined,
        numberOfUnits: demoForm.flats ? parseInt(demoForm.flats, 10) : undefined,
        selectedPlan: demoForm.selectedPlan || 'Standard Pro (₹5,999/mo - Up to 300 Flats)',
        message: extraNotes.length > 0 ? extraNotes.join(' | ') : undefined,
      };

      // 3. Open Razorpay Checkout popup for ₹1.00
      const options = {
        key: keyId,
        amount: amount || 100, // 100 paise = ₹1.00
        currency: 'INR',
        name: 'SecureGate Platform',
        description: '1-Month Demo Trial Activation (₹1.00)',
        order_id: orderId,
        prefill: {
          name: demoForm.managerName,
          email: demoForm.managerEmail,
          contact: demoForm.managerPhone,
        },
        theme: {
          color: '#00A67C',
        },
        modal: {
          ondismiss: () => {
            setDemoLoading(false);
          },
        },
        handler: async (response: any) => {
          try {
            setDemoLoading(true);
            const verifyRes = await fetch(`${API_BASE}/demo-requests/verify-and-submit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                ...formDataPayload,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              setPaymentSuccessInfo({
                paymentId: response.razorpay_payment_id,
                plan: formDataPayload.selectedPlan,
                society: formDataPayload.societyName,
              });
              setDemoSubmitted(true);
            } else {
              setDemoError(verifyData.message || 'Payment verification failed.');
            }
          } catch (err: any) {
            setDemoError(err.message || 'Failed to complete demo trial activation.');
          } finally {
            setDemoLoading(false);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setDemoError(resp.error?.description || 'Payment was unsuccessful or cancelled.');
        setDemoLoading(false);
      });
      rzp.open();
    } catch (err: any) {
      setDemoError(err.message || 'Unable to connect to payment server. Please try again.');
      setDemoLoading(false);
    }
  };

  const openDemo = (plan?: string | React.MouseEvent) => {
    const planStr = typeof plan === 'string' ? plan : '';
    setDemoForm(emptyDemo(planStr));
    setDemoSubmitted(false);
    setPaymentSuccessInfo(null);
    setDemoError('');
    setDemoOpen(true);
  };

  const ref1 = useFadeIn(), ref2 = useFadeIn(), ref3 = useFadeIn(),
        ref4 = useFadeIn(), ref5 = useFadeIn(), ref7 = useFadeIn();

  const navLinks = [
    { label: 'Home', id: 'lp-hero' },
    { label: 'Features', id: 'lp-features' },
    { label: 'How It Works', id: 'lp-how' },
    { label: 'Pricing', id: 'lp-pricing' },
    { label: 'About', id: 'lp-stats' },
    { label: 'Contact', id: 'lp-footer' },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#0f172a', overflowX: 'hidden', background: '#fff' }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(14px)',
        borderBottom: scrolled ? '1px solid #e8f3ee' : '1px solid rgba(255,255,255,0.2)',
        boxShadow: scrolled ? '0 2px 20px rgba(0,120,80,0.08)' : 'none',
        transition: 'all 0.3s ease', padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 68 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div style={{ background: 'linear-gradient(135deg,#00C896,#00A67C)', padding: 8, borderRadius: 10, boxShadow: '0 3px 10px rgba(0,200,150,0.3)' }}>
              <Icon icon="lucide:shield-check" size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: scrolled ? '#0f172a' : 'white', letterSpacing: '-0.4px', lineHeight: 1.1, transition: 'color 0.3s' }}>SecureGate</div>
              <div style={{ fontSize: 10, color: '#00C896', fontWeight: 600, letterSpacing: '0.3px' }}>Safer Societies, Smarter Communities</div>
            </div>
          </div>

          <div className="lp-nav-links">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)} style={{
                background: 'none', border: 'none', fontSize: 14, fontWeight: 500,
                color: scrolled ? '#374151' : 'rgba(255,255,255,0.9)', cursor: 'pointer',
                padding: '6px 14px', borderRadius: 8, transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#00C896'; e.currentTarget.style.background = 'rgba(0,200,150,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = scrolled ? '#374151' : 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'none'; }}
              >{l.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 16 }}>
            <button className="lp-hide-mobile" onClick={onGoToLogin} style={{
              background: 'none', border: `1.5px solid ${scrolled ? '#00C896' : 'rgba(255,255,255,0.6)'}`,
              color: scrolled ? '#00A67C' : 'white',
              padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,200,150,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >Sign In</button>
            
            <button onClick={openDemo} style={{
              background: 'linear-gradient(135deg,#00C896,#00A67C)', color: 'white', border: 'none',
              padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(0,200,150,0.35)', transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,200,150,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,200,150,0.35)'; }}
            >Book a Demo</button>
            
            <button className="lp-hamburger" onClick={() => setMenuOpen(o => !o)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 6,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {[0,1,2].map(i => <span key={i} style={{ display: 'block', width: 22, height: 2, background: scrolled ? '#374151' : 'white', borderRadius: 2 }} />)}
            </button>
          </div>
        </div>

        {menuOpen && (
          <>
            {/* Click outside to close */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onClick={() => setMenuOpen(false)}
            />
            {/* Glassmorphic small dropdown */}
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 20,
              width: 230,
              background: 'rgba(8, 28, 20, 0.78)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(0, 200, 150, 0.28)',
              borderRadius: 16,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06) inset',
              padding: '10px 8px',
              zIndex: 1000,
              animation: 'lpDropdownIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {navLinks.map(l => (
                  <button
                    key={l.id}
                    onClick={() => scrollTo(l.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: 'rgba(255, 255, 255, 0.9)',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: 8,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(0, 200, 150, 0.18)';
                      e.currentTarget.style.color = '#00E5AA';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)', margin: '8px 4px' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 4px' }}>
                <button
                  onClick={() => { setMenuOpen(false); onGoToLogin(); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(0, 200, 150, 0.35)',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 200, 150, 0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                >
                  Sign In to Portal
                </button>
                <button
                  onClick={() => { setMenuOpen(false); openDemo(); }}
                  style={{
                    background: 'linear-gradient(135deg, #00C896, #00A67C)',
                    color: 'white',
                    border: 'none',
                    padding: '9px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(0, 200, 150, 0.3)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                >
                  Book a Demo
                </button>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* ── HERO — full-bleed background image with text overlay ── */}
      <section id="lp-hero" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {/* Background image */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/hero_apartment.jpg), url(https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=2000&q=80)',
          backgroundSize: 'cover', backgroundPosition: 'center 35%',
        }} />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(105deg, rgba(0,28,17,0.88) 0%, rgba(0,38,24,0.75) 40%, rgba(0,25,16,0.45) 75%, rgba(0,15,10,0.25) 100%)',
        }} />
        {/* Subtle green grid texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(0,200,150,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,150,0.06) 1px,transparent 1px)',
          backgroundSize: '48px 48px', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '120px 24px 80px', width: '100%' }}>
          <div style={{ maxWidth: 640, animation: 'lpSlideUp 0.8s ease both' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,200,150,0.18)', color: '#a7f3d0',
              padding: '7px 16px', borderRadius: 30, fontSize: 12, fontWeight: 700,
              marginBottom: 28, border: '1px solid rgba(0,200,150,0.3)', backdropFilter: 'blur(8px)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00C896', display: 'inline-block', boxShadow: '0 0 0 3px rgba(0,200,150,0.3)' }} />
              Smart Security. Stronger Communities.
            </div>

            <h1 style={{ fontSize: 'clamp(38px,5.5vw,66px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: 22, color: 'white' }}>
              A Safer Society<br />
              <span style={{ color: '#00C896' }}>Starts Here</span>
            </h1>

            <p style={{ fontSize: 18, lineHeight: 1.75, color: 'rgba(255,255,255,0.78)', marginBottom: 40, maxWidth: 520 }}>
              An all-in-one security and community management platform for modern residential societies — empowering <strong style={{ color: '#a7f3d0' }}>Managers</strong>, <strong style={{ color: '#a7f3d0' }}>Guards</strong> and <strong style={{ color: '#a7f3d0' }}>Residents</strong> to live safer and smarter.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
              <button onClick={openDemo} style={{
                background: 'linear-gradient(135deg,#00C896,#00A67C)', color: 'white', border: 'none',
                padding: '16px 36px', borderRadius: 12, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 6px 22px rgba(0,200,150,0.5)',
                display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.25s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,200,150,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,200,150,0.5)'; }}
              >
                Book a Demo <Icon icon="lucide:arrow-right" size={17} color="white" />
              </button>
            </div>

            {/* Benefits */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { t: 'Secure Access', i: 'lucide:lock' },
                { t: 'Connected Community', i: 'lucide:users' },
                { t: 'Smarter Management', i: 'lucide:bar-chart-3' },
              ].map(b => (
                <div key={b.t} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
                  <Icon icon={b.i} size={16} color="#00C896" />
                  {b.t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ONE PLATFORM ── */}
      <section id="lp-portals" style={{ padding: '100px 24px', background: '#fff' }}>
        <div ref={ref1} className="lp-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f8f1', color: '#1a6b4a', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
              <Icon icon="lucide:layers" size={13} color="#00A67C" /> Our Solutions
            </div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.8px', marginBottom: 14 }}>
              Everything Your Society Needs,<br /><span style={{ color: '#00A67C' }}>In One Platform</span>
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 500, margin: '0 auto' }}>One connected ecosystem for managers, guards and residents.</p>
          </div>

          <div className="lp-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28 }}>
            {[
              {
                img: '/manager_portal.jpg', icon: 'lucide:layout-dashboard', title: 'Manager Portal', badge: 'Web Portal',
                desc: 'Manage your entire society from one place. Handle residents, visitor records, staff, complaints, notices, security and more.',
                features: [
                  { t: 'Society Management', i: 'lucide:building-2' },
                  { t: 'Visitor Management', i: 'lucide:user-check' },
                  { t: 'Staff Management', i: 'lucide:briefcase' },
                  { t: 'Complaints', i: 'lucide:message-circle-warning' },
                  { t: 'Reports & Analytics', i: 'lucide:bar-chart-3' },
                ],
                cta: 'Open Manager Portal', onClick: onGoToLogin,
              },
              {
                img: '/guard_app.jpg', icon: 'lucide:shield-check', title: 'Guard App', badge: 'Mobile App',
                desc: 'Give your security team the tools they need to verify visitors, manage entries, receive alerts and keep the society secure.',
                features: [
                  { t: 'Visitor Verification', i: 'lucide:scan-face' },
                  { t: 'Entry Management', i: 'lucide:door-open' },
                  { t: 'Delivery Tracking', i: 'lucide:package' },
                  { t: 'Emergency Alerts', i: 'lucide:siren' },
                  { t: 'Digital Logs', i: 'lucide:clipboard-list' },
                ],
                cta: 'Explore Guard App', onClick: openDemo,
              },
              {
                img: '/resident_app.jpg', icon: 'lucide:users', title: 'Resident App', badge: 'Mobile App',
                desc: 'A safer and more connected living experience. Approve visitors, receive alerts, raise complaints and stay connected.',
                features: [
                  { t: 'Visitor Approval', i: 'lucide:check-circle-2' },
                  { t: 'Instant Notifications', i: 'lucide:bell' },
                  { t: 'Complaints', i: 'lucide:message-circle-warning' },
                  { t: 'Society Notices', i: 'lucide:megaphone' },
                  { t: 'Emergency Assistance', i: 'lucide:phone-call' },
                ],
                cta: 'Explore Resident App', onClick: openDemo,
              },
            ].map(card => (
              <div key={card.title} className="lp-portal-card" style={{
                borderRadius: 20, overflow: 'hidden', border: '1px solid #e2f0ea',
                boxShadow: '0 4px 24px rgba(0,100,60,0.06)', background: 'white',
                transition: 'transform 0.3s, box-shadow 0.3s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 50px rgba(0,100,60,0.14)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(0,100,60,0.06)'; }}
              >
                <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden' }}>
                  <img src={card.img} alt={card.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.28) 0%, transparent 55%)' }} />
                  <span style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.92)', color: '#00A67C', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>{card.badge}</span>
                </div>
                <div style={{ padding: '24px 24px 28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <GreenIconCircle icon={card.icon} />
                    <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>{card.title}</h3>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#475569', marginBottom: 18 }}>{card.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                    {card.features.map(f => (
                      <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155', fontWeight: 500 }}>
                        <Icon icon={f.i} size={15} color="#00A67C" />
                        {f.t}
                      </div>
                    ))}
                  </div>
                  <button onClick={card.onClick} style={{
                    width: '100%', background: 'linear-gradient(135deg,#00C896,#00A67C)', color: 'white', border: 'none',
                    padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 3px 12px rgba(0,200,150,0.3)', transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,200,150,0.45)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,200,150,0.3)'; }}
                  >{card.cta} →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="lp-how" style={{ padding: '100px 24px', background: '#f8fafc' }}>
        <div ref={ref2} className="lp-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f8f1', color: '#1a6b4a', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
              <Icon icon="lucide:workflow" size={13} color="#00A67C" /> Getting Started
            </div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.8px', marginBottom: 14 }}>
              How SecureGate Works
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 500, margin: '0 auto' }}>Get your society onboarded in three simple steps.</p>
          </div>

          <div className="lp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }}>
            {[
              { step: '01', title: 'Request a Demo', desc: 'Share your basic society details and schedule a walkthrough with our team.', icon: 'lucide:calendar-check' },
              { step: '02', title: 'Setup & Provision', desc: 'Our team provisions your workspace, configures entry gates and manager access.', icon: 'lucide:settings-2' },
              { step: '03', title: 'Go Live', desc: 'Deploy the Guard App and onboard residents for safe, intelligent community access.', icon: 'lucide:rocket' },
            ].map(s => (
              <div key={s.step} style={{ background: 'white', padding: '36px 28px', borderRadius: 20, border: '1px solid #e2f0ea', boxShadow: '0 4px 20px rgba(0,100,60,0.05)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 20, right: 24, fontSize: 36, fontWeight: 900, color: '#e2f0ea' }}>{s.step}</span>
                <div style={{ marginBottom: 20 }}>
                  <GreenIconCircle icon={s.icon} size={48} />
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 800, marginBottom: 10, color: '#0f172a' }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section id="lp-features" style={{ padding: '100px 24px', background: '#fff' }}>
        <div ref={ref3} className="lp-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f8f1', color: '#1a6b4a', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
              <Icon icon="lucide:sparkles" size={13} color="#00A67C" /> Platform Capabilities
            </div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.8px', marginBottom: 14 }}>
              Enterprise-Grade Security Features
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 500, margin: '0 auto' }}>Designed specifically for the needs of Indian residential complexes.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
            {[
              { icon: 'lucide:qr-code', title: 'Digital Gate Passes', desc: 'Pre-approved digital entry passes with QR codes for guests and frequent visitors.' },
              { icon: 'lucide:shield-alert', title: 'Instant SOS Alerts', desc: 'Panic alarms and emergency notifications sent directly to guard kiosks and admins.' },
              { icon: 'lucide:car', title: 'Vehicle & Parking Mgmt', desc: 'Track authorized resident slots and visitor parking logs in real-time.' },
              { icon: 'lucide:users-round', title: 'Resident Directory', desc: 'Maintain complete directory of flats, owners, tenants, and family members.' },
              { icon: 'lucide:badge-alert', title: 'Guard Duty Logs', desc: 'Monitor active guard shifts, attendance, check-in posts and patrol logs.' },
              { icon: 'lucide:file-text', title: 'Compliance & Reports', desc: 'Automated weekly and monthly reports on traffic, incidents, and maintenance.' },
            ].map(f => (
              <div key={f.title} style={{ padding: '28px', borderRadius: 16, border: '1px solid #f1f5f9', background: '#fafbfc', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#a7f3d0'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#f1f5f9'; (e.currentTarget as HTMLDivElement).style.transform = ''; }}
              >
                <div style={{ marginBottom: 16 }}>
                  <GreenIconCircle icon={f.icon} size={42} />
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>{f.title}</h4>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING PLANS ── */}
      <section id="lp-pricing" style={{ padding: '100px 24px', background: '#f8fafc' }}>
        <div ref={ref5} className="lp-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f8f1', color: '#1a6b4a', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
              <Icon icon="lucide:tag" size={13} color="#00A67C" /> Transparent Pricing
            </div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.8px', marginBottom: 14 }}>
              Choose the Right Plan for Your Society
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 540, margin: '0 auto' }}>
              Scalable, predictable subscription tiers built for residential complexes of all sizes.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, alignItems: 'stretch' }}>
            {[
              {
                id: 'Starter Tier (₹2,999/mo - Up to 100 Flats)',
                name: 'Starter Tier',
                price: '₹2,999',
                billing: '/ month per society',
                unitLimit: 'Up to 100 Flats',
                desc: 'Essential security & resident verification for small communities.',
                color: '#6366F1',
                popular: false,
                features: [
                  'Resident Mobile App (iOS & Android)',
                  'Guard Tablet Gate & Check-in App',
                  'Visitor QR Pass & OTP Verification',
                  'Domestic Staff & Maid Attendance',
                  'Standard Push & Email Alerts',
                ],
              },
              {
                id: 'Standard Pro (₹5,999/mo - Up to 300 Flats)',
                name: 'Standard Pro',
                price: '₹5,999',
                billing: '/ month per society',
                unitLimit: 'Up to 300 Flats',
                desc: 'Complete society security, maintenance billing & smart communication.',
                color: '#8B5CF6',
                popular: true,
                features: [
                  'Everything in Starter Tier',
                  'Online Maintenance Billing & Digital Ledger',
                  'CCTV RTSP Multi-Camera Live Grid',
                  'Committee Decision & Online Polls',
                  'Priority SMS & WhatsApp Alerts',
                  'Dedicated Priority Phone Support',
                ],
              },
              {
                id: 'Enterprise Matrix (₹12,499/mo - Unlimited Flats)',
                name: 'Enterprise Matrix',
                price: '₹12,499',
                billing: '/ month per society',
                unitLimit: 'Unlimited Flats & Multi-Gate',
                desc: 'Maximum security automation & hardware integration for large townships.',
                color: '#10B981',
                popular: false,
                features: [
                  'Everything in Standard Pro',
                  'Automated ANPR Number Plate Scanning',
                  'FastTag Automatic Gate Barrier Sync',
                  'Custom Society Subdomain & Branding',
                  'Dedicated Account Manager & 99.9% SLA',
                  'Automated Cloud & Local Data Backup',
                ],
              },
            ].map(plan => (
              <div
                key={plan.name}
                style={{
                  background: 'white',
                  borderRadius: 20,
                  border: plan.popular ? '2px solid #00A67C' : '1px solid #e2f0ea',
                  boxShadow: plan.popular ? '0 12px 40px rgba(0,166,124,0.18)' : '0 4px 20px rgba(0,100,60,0.06)',
                  padding: '36px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  transform: plan.popular ? 'scale(1.03)' : 'none',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #00C896, #00A67C)',
                    color: 'white',
                    padding: '4px 16px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 12px rgba(0,200,150,0.4)',
                  }}>
                    ★ MOST POPULAR
                  </div>
                )}

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b', minHeight: 36 }}>{plan.desc}</div>
                </div>

                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', letterSpacing: '-1px' }}>{plan.price}</span>
                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{plan.billing}</span>
                  </div>
                  <div style={{ display: 'inline-block', marginTop: 8, background: '#f1f5f9', color: '#334155', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>
                    {plan.unitLimit}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, flex: 1 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#334155' }}>
                      <Icon icon="lucide:check-circle-2" size={16} color="#00A67C" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => openDemo(plan.id)}
                  style={{
                    width: '100%',
                    background: plan.popular ? 'linear-gradient(135deg,#00C896,#00A67C)' : '#f8fafc',
                    color: plan.popular ? 'white' : '#00A67C',
                    border: plan.popular ? 'none' : '1.5px solid #00A67C',
                    padding: '13px',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: plan.popular ? '0 4px 16px rgba(0,200,150,0.35)' : 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    if (!plan.popular) e.currentTarget.style.background = '#e8f8f1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = '';
                    if (!plan.popular) e.currentTarget.style.background = '#f8fafc';
                  }}
                >
                  Book Demo with {plan.name} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS SECTION ── */}
      <section id="lp-stats" style={{ padding: '80px 24px', background: 'linear-gradient(135deg,#002c1d,#001a11)', color: 'white' }}>
        <div ref={ref4} className="lp-fade-in" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32, textAlign: 'center' }}>
          {[
            { num: '500+', label: 'Societies Secured' },
            { num: '250,000+', label: 'Happy Residents' },
            { num: '99.98%', label: 'Platform Uptime' },
            { num: '< 5 sec', label: 'Visitor Verification' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 'clamp(32px,4vw,48px)', fontWeight: 900, color: '#00C896', marginBottom: 6 }}>{s.num}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '120px 24px' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/hero_apartment.jpg), url(https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=2000&q=80)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,50,30,0.92) 0%, rgba(0,100,60,0.85) 100%)' }} />
        <div ref={ref7} className="lp-fade-in" style={{ position: 'relative', maxWidth: 700, margin: '0 auto', textAlign: 'center', color: 'white' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,200,150,0.2)', color: '#a7f3d0', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 24, border: '1px solid rgba(0,200,150,0.3)' }}>
            <Icon icon="lucide:star" size={13} color="#00C896" /> Ready to Get Started?
          </div>
          <h2 style={{ fontSize: 'clamp(30px,5vw,52px)', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 20 }}>
            Ready to Make Your<br />Society <span style={{ color: '#00C896' }}>Safer?</span>
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,0.8)', marginBottom: 40 }}>
            Bring your managers, guards and residents onto one connected security platform.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
            <button onClick={openDemo} style={{ background: 'linear-gradient(135deg,#00C896,#00A67C)', color: 'white', border: 'none', padding: '16px 36px', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,200,150,0.5)', transition: 'all 0.25s', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 32px rgba(0,200,150,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,200,150,0.5)'; }}
            >
              Book a Free Demo <Icon icon="lucide:arrow-right" size={17} color="white" />
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>One platform. One community. Smarter security.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="lp-footer" style={{ background: '#0a1628', color: '#94a3b8', padding: '60px 24px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }} className="lp-footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'linear-gradient(135deg,#00C896,#00A67C)', padding: 8, borderRadius: 10 }}>
                  <Icon icon="lucide:shield-check" size={20} color="white" />
                </div>
                <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>SecureGate</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#64748b', maxWidth: 280 }}>
                Next-generation security and community management for residential complexes.
              </p>
            </div>
            <div>
              <h5 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Solutions</h5>
              {['Manager Portal', 'Guard App', 'Resident App', 'Pass System'].map(s => (
                <div key={s} style={{ fontSize: 14, color: '#64748b', marginBottom: 12, cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#00C896'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#64748b'; }}
                  onClick={openDemo}
                >{s}</div>
              ))}
            </div>
            <div>
              <h5 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Features</h5>
              {['Gate Passes', 'SOS Alerts', 'Parking Management', 'Complaints'].map(s => (
                <div key={s} style={{ fontSize: 14, color: '#64748b', marginBottom: 12, cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#00C896'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#64748b'; }}
                  onClick={openDemo}
                >{s}</div>
              ))}
            </div>
            <div>
              <h5 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Get Started</h5>
              {['Book a Demo', 'Manager Sign In', 'Contact Support'].map(s => (
                <div key={s} style={{ fontSize: 14, color: '#64748b', marginBottom: 12, cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#00C896'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#64748b'; }}
                  onClick={s === 'Manager Sign In' ? onGoToLogin : openDemo}
                >{s}</div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13 }}>© {new Date().getFullYear()} SecureGate. All rights reserved.</div>
            <div style={{ fontSize: 13, color: '#00C896', fontWeight: 600 }}>Safe • Smart • Connected • Modern</div>
          </div>
        </div>
      </footer>

      {/* ── BOOK A DEMO MODAL ── */}
      <Modal open={demoOpen} onClose={() => setDemoOpen(false)}>
        <div style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 650, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', animation: 'lpModalIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
          {demoSubmitted ? (
            <div style={{ padding: '50px 40px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#f0fdf8,#dcfcec)', border: '2px solid #a7e8cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon="lucide:check-circle-2" size={40} color="#00A67C" />
                </div>
              </div>
              <div style={{ display: 'inline-block', background: '#e8f8f1', color: '#00A67C', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                ✓ Payment Verified & Demo Activated
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>1-Month Demo Trial Active!</h3>
              <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
                Thank you! Your trial request for <strong style={{ color: '#0f172a' }}>{paymentSuccessInfo?.society || demoForm.societyName || 'your society'}</strong> has been registered. Our Super Admin team is setting up your manager portal credentials right now.
              </p>

              {paymentSuccessInfo && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', marginBottom: 28, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>
                    Transaction & Plan Summary
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                    <div><span style={{ color: '#64748b' }}>Amount Paid:</span> <strong style={{ color: '#00A67C' }}>₹1.00</strong></div>
                    <div><span style={{ color: '#64748b' }}>Trial Duration:</span> <strong>30 Days (1 Month)</strong></div>
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Selected Plan:</span> <strong>{paymentSuccessInfo.plan}</strong></div>
                    <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#94a3b8' }}>Razorpay Payment ID: <code>{paymentSuccessInfo.paymentId}</code></div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => setDemoOpen(false)} style={{ background: 'linear-gradient(135deg,#00C896,#00A67C)', color: 'white', border: 'none', padding: '13px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  Done
                </button>
                <button onClick={() => { setDemoOpen(false); onGoToLogin(); }} style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '13px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Go to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '30px 36px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Book a 1-Month Demo Trial</h3>
                    <p style={{ fontSize: 14, color: '#64748b' }}>Pay ₹1.00 to activate a full 30-day trial of your chosen society tier.</p>
                  </div>
                  <button onClick={() => setDemoOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon icon="lucide:x" size={16} color="#64748b" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleDemoSubmit} style={{ padding: '24px 36px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Demo Trial Activation Banner */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 200, 150, 0.08), rgba(0, 166, 124, 0.12))',
                  border: '1.5px solid rgba(0, 200, 150, 0.3)',
                  borderRadius: 14,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: '#00A67C', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                      ₹
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        1-Month Demo Trial Fee: <span style={{ color: '#00A67C', fontSize: 16, fontWeight: 800 }}>₹1.00</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Full access for 30 days · Then configured per your selected plan
                      </div>
                    </div>
                  </div>
                  <div style={{ background: '#00A67C', color: 'white', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    30-Day Trial
                  </div>
                </div>

                {/* 1. Society Information */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#00A67C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon icon="lucide:building-2" size={14} color="#00A67C" /> Society Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="lp-form-grid">
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Society Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" placeholder="e.g. Greenview Heights" required value={demoForm.societyName}
                        onChange={e => setDemoForm(f => ({ ...f, societyName: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Address <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" placeholder="123 Main Road, Near Park" required value={demoForm.address}
                        onChange={e => setDemoForm(f => ({ ...f, address: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>City <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" placeholder="Mumbai" required value={demoForm.city}
                        onChange={e => setDemoForm(f => ({ ...f, city: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>State <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" placeholder="Maharashtra" required value={demoForm.state}
                        onChange={e => setDemoForm(f => ({ ...f, state: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>PIN Code <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" placeholder="400001" required value={demoForm.pin}
                        onChange={e => setDemoForm(f => ({ ...f, pin: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Number of Flats <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="number" placeholder="200" required value={demoForm.flats}
                        onChange={e => setDemoForm(f => ({ ...f, flats: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Towers / Blocks</label>
                      <input type="text" placeholder="4 Towers (A, B, C, D)" value={demoForm.towers}
                        onChange={e => setDemoForm(f => ({ ...f, towers: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Manager / Contact Details */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#00A67C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon icon="lucide:user-circle-2" size={14} color="#00A67C" /> Contact Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="lp-form-grid">
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" placeholder="Arjun Mehta" required value={demoForm.managerName}
                        onChange={e => setDemoForm(f => ({ ...f, managerName: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="tel" placeholder="+91 98765 43210" required value={demoForm.managerPhone}
                        onChange={e => setDemoForm(f => ({ ...f, managerPhone: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="email" placeholder="arjun@example.com" required value={demoForm.managerEmail}
                        onChange={e => setDemoForm(f => ({ ...f, managerEmail: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Scheduling & Requirements */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#00A67C', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon icon="lucide:calendar" size={14} color="#00A67C" /> Preferred Schedule & Plan Selection
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="lp-form-grid">
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                        Select Subscription Plan
                      </label>
                      <select
                        value={demoForm.selectedPlan}
                        onChange={e => setDemoForm(f => ({ ...f, selectedPlan: e.target.value }))}
                        className="form-input"
                        style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%', cursor: 'pointer' }}
                      >
                        <option value="">-- Choose a Plan (Optional) --</option>
                        <option value="Starter Tier (₹2,999/mo - Up to 100 Flats)">Starter Tier (₹2,999/mo · Up to 100 Flats)</option>
                        <option value="Standard Pro (₹5,999/mo - Up to 300 Flats)">Standard Pro (₹5,999/mo · Up to 300 Flats) ★ Popular</option>
                        <option value="Enterprise Matrix (₹12,499/mo - Unlimited Flats)">Enterprise Matrix (₹12,499/mo · Unlimited Flats & Multi-Gate)</option>
                        <option value="Not Sure Yet (Need Recommendation)">Not Sure Yet (Need Recommendation)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Preferred Demo Date</label>
                      <input type="date" value={demoForm.demoDate}
                        onChange={e => setDemoForm(f => ({ ...f, demoDate: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Current Security System</label>
                      <input type="text" placeholder="Manual registers / intercom / none" value={demoForm.currentSecurity}
                        onChange={e => setDemoForm(f => ({ ...f, currentSecurity: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Requirements / Notes</label>
                      <textarea rows={2} placeholder="Tell us about any specific requirements..." value={demoForm.message}
                        onChange={e => setDemoForm(f => ({ ...f, message: e.target.value }))}
                        className="form-input" style={{ borderRadius: 9, padding: '10px 13px', fontSize: 13, background: '#f8fafc', width: '100%', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>

                {demoError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#ef4444', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon="lucide:alert-circle" size={16} color="#ef4444" /> {demoError}
                  </div>
                )}

                <button type="submit" disabled={demoLoading} style={{ background: 'linear-gradient(135deg,#00C896,#00A67C)', color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: demoLoading ? 'not-allowed' : 'pointer', opacity: demoLoading ? 0.7 : 1, boxShadow: '0 6px 18px rgba(0,200,150,0.35)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon icon="lucide:credit-card" size={18} color="white" />
                  {demoLoading ? 'Connecting to Razorpay...' : 'Pay ₹1.00 & Activate 1-Month Demo Trial →'}
                </button>

                <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setDemoOpen(false); onGoToLogin(); }} style={{ background: 'none', border: 'none', color: '#00A67C', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Sign In to Portal →</button>
                </div>
              </form>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default LandingPage;
