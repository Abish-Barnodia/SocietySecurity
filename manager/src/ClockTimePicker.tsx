import { useState } from 'react';

// A circular analog clock-face time picker matching the native mobile
// picker's look (tap an hour, it switches to minute mode, then OK/Cancel) -
// used instead of plain dropdowns so picking a time on the web dashboard
// feels the same as the resident app.
type Props = {
  hour: string;   // '1'-'12'
  minute: string; // '00'-'55'
  period: string; // 'AM' | 'PM'
  onChange: (hour: string, minute: string, period: string) => void;
};

const HOUR_POSITIONS = Array.from({ length: 12 }, (_, i) => {
  const value = i === 0 ? 12 : i;
  const angle = (i * 30 - 90) * (Math.PI / 180);
  return { value: String(value), x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
});

const MINUTE_POSITIONS = Array.from({ length: 12 }, (_, i) => {
  const value = String(i * 5).padStart(2, '0');
  const angle = (i * 30 - 90) * (Math.PI / 180);
  return { value, x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
});

export default function ClockTimePicker({ hour, minute, period, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);
  const [draftPeriod, setDraftPeriod] = useState(period);

  const openPicker = () => {
    setDraftHour(hour);
    setDraftMinute(minute);
    setDraftPeriod(period);
    setMode('hour');
    setOpen(true);
  };

  const confirm = () => {
    onChange(draftHour, draftMinute, draftPeriod);
    setOpen(false);
  };

  const positions = mode === 'hour' ? HOUR_POSITIONS : MINUTE_POSITIONS;
  const selectedValue = mode === 'hour' ? draftHour : draftMinute;

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        onClick={openPicker}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: 'white', textAlign: 'left', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 14 }}>🕐</span> {hour}:{minute} {period}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 41, background: '#1F2937', borderRadius: 12, padding: 20, width: 280, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            {/* Digital readout, matching the reference picker's header */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button type="button" onClick={() => setMode('hour')}
                style={{ fontSize: 36, fontWeight: 700, color: mode === 'hour' ? '#5EEAD4' : 'white', background: 'none', border: 'none' }}>
                {draftHour}
              </button>
              <span style={{ fontSize: 36, fontWeight: 700, color: 'white' }}>:</span>
              <button type="button" onClick={() => setMode('minute')}
                style={{ fontSize: 36, fontWeight: 700, color: mode === 'minute' ? '#5EEAD4' : 'white', background: 'none', border: 'none' }}>
                {draftMinute}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 4 }}>
                <button type="button" onClick={() => setDraftPeriod('AM')}
                  style={{ fontSize: 13, fontWeight: 700, color: draftPeriod === 'AM' ? '#5EEAD4' : '#9CA3AF', background: 'none', border: 'none', padding: '2px 0' }}>
                  AM
                </button>
                <button type="button" onClick={() => setDraftPeriod('PM')}
                  style={{ fontSize: 13, fontWeight: 700, color: draftPeriod === 'PM' ? '#5EEAD4' : '#9CA3AF', background: 'none', border: 'none', padding: '2px 0' }}>
                  PM
                </button>
              </div>
            </div>

            {/* Clock face */}
            <div style={{ position: 'relative', width: 220, height: 220, borderRadius: '50%', backgroundColor: '#374151', margin: '0 auto' }}>
              {/* Hand from center to the selected value */}
              {(() => {
                const sel = positions.find(p => p.value === selectedValue) ?? positions[0]!;
                return (
                  <div style={{
                    position: 'absolute', left: '50%', top: '50%', width: `${Math.hypot(sel.x - 50, sel.y - 50)}%`, height: 2,
                    backgroundColor: '#5EEAD4', transformOrigin: '0 50%',
                    transform: `rotate(${Math.atan2(sel.y - 50, sel.x - 50)}rad)`,
                  }} />
                );
              })()}
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#5EEAD4', transform: 'translate(-50%, -50%)' }} />
              {positions.map(p => {
                const active = p.value === selectedValue;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      if (mode === 'hour') { setDraftHour(p.value); setMode('minute'); }
                      else setDraftMinute(p.value);
                    }}
                    style={{
                      position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)',
                      width: 32, height: 32, borderRadius: '50%', border: 'none',
                      backgroundColor: active ? '#5EEAD4' : 'transparent',
                      color: active ? '#1F2937' : 'white',
                      fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {p.value}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 16 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#5EEAD4', fontWeight: 600, fontSize: 13 }}>CANCEL</button>
              <button type="button" onClick={confirm} style={{ background: 'none', border: 'none', color: '#5EEAD4', fontWeight: 600, fontSize: 13 }}>OK</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
