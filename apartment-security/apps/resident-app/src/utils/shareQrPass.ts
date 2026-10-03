import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export interface ThemedPassShareOptions {
  qrPayload: string;
  filenameHint: string;
  visitorName: string;
  residentName?: string;
  themeId?: string;
  greeting?: string;
  validTimeWindow?: string;
  passCode?: string;
  note?: string;
  propertyName?: string;
  unitName?: string;
  passType?: string;
  purpose?: string;
}

export interface ThemeConfig {
  name: string;
  bgGradient: string;
  cardBg: string;
  bannerColor: string;
  tagline: string;
  accentColor: string;
  emoji: string;
  themeImageName?: string;
}

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
  home: {
    name: 'Home Welcome',
    bgGradient: 'linear-gradient(180deg, #1C1917 0%, #292524 30%, #44403C 70%, #1C1917 100%)',
    cardBg: '#FFFBEB',
    bannerColor: '#B45309',
    tagline: "You're Invited",
    accentColor: '#D97706',
    emoji: '🏠',
  },
  party: {
    name: 'Dinner / Party',
    bgGradient: 'linear-gradient(180deg, #18181B 0%, #27272A 30%, #3F3F46 70%, #18181B 100%)',
    cardBg: '#FFF1F2',
    bannerColor: '#BE123C',
    tagline: "Dinner & Celebrations",
    accentColor: '#E11D48',
    emoji: '🍷',
  },
  balloons: {
    name: 'Celebration',
    bgGradient: 'linear-gradient(180deg, #0F172A 0%, #1E293B 30%, #334155 70%, #0F172A 100%)',
    cardBg: '#F0F9FF',
    bannerColor: '#0369A1',
    tagline: "Party & Celebration",
    accentColor: '#0284C7',
    emoji: '🎈',
  },
  formal: {
    name: 'Formal Meeting',
    bgGradient: 'linear-gradient(180deg, #09090B 0%, #18181B 30%, #27272A 70%, #09090B 100%)',
    cardBg: '#F8FAFC',
    bannerColor: '#334155',
    tagline: "Scheduled Meeting",
    accentColor: '#64748B',
    emoji: '💼',
  },
  games: {
    name: 'Fun & Games',
    bgGradient: 'linear-gradient(180deg, #1E1B4B 0%, #312E81 30%, #4338CA 70%, #1E1B4B 100%)',
    cardBg: '#FAF5FF',
    bannerColor: '#6D28D9',
    tagline: "Game Night / Gathering",
    accentColor: '#9333EA',
    emoji: '🎮',
  },
  help: {
    name: 'Visiting Help',
    bgGradient: 'linear-gradient(180deg, #1C1917 0%, #292524 30%, #44403C 70%, #1C1917 100%)',
    cardBg: '#FEF9C3',
    bannerColor: '#854D0E',
    tagline: "Maintenance & Visiting Help",
    accentColor: '#CA8A04',
    emoji: '🛠️',
  },
  delivery: {
    name: 'Delivery',
    bgGradient: 'linear-gradient(180deg, #082F49 0%, #0C4A6E 30%, #075985 70%, #082F49 100%)',
    cardBg: '#F0F9FF',
    bannerColor: '#0284C7',
    tagline: "Delivery Pre-Approval",
    accentColor: '#0284C7',
    emoji: '🛵',
  },
  cab: {
    name: 'Cab / Auto',
    bgGradient: 'linear-gradient(180deg, #1C1917 0%, #292524 30%, #44403C 70%, #1C1917 100%)',
    cardBg: '#FFFBEB',
    bannerColor: '#B45309',
    tagline: "Cab Pre-Approval",
    accentColor: '#D97706',
    emoji: '🚗',
  },
};

export function detectThemeFromPass(pass: { purpose?: string; type?: string }): string {
  const p = (pass.purpose || '').toLowerCase();
  const t = (pass.type || '').toLowerCase();

  if (p.includes('party') || p.includes('dinner') || p.includes('food') || p.includes('wine')) return 'party';
  if (p.includes('celebrat') || p.includes('birthday') || p.includes('balloon') || p.includes('event')) return 'balloons';
  if (p.includes('meet') || p.includes('formal') || p.includes('work') || p.includes('office')) return 'formal';
  if (p.includes('game') || p.includes('play') || p.includes('night') || p.includes('club')) return 'games';
  if (p.includes('repair') || p.includes('help') || p.includes('plumber') || p.includes('maid') || p.includes('tutor') || p.includes('clean')) return 'help';
  if (p.includes('delivery') || t.includes('delivery')) return 'delivery';
  if (p.includes('cab') || p.includes('uber') || p.includes('ola') || p.includes('auto')) return 'cab';
  return 'home';
}

export function buildThemedHtml(options: ThemedPassShareOptions): string {
  const themeKey = options.themeId || detectThemeFromPass({ purpose: options.purpose, type: options.passType });
  const theme = THEME_CONFIGS[themeKey] || THEME_CONFIGS.home;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(
    options.qrPayload
  )}`;

  const hostName = options.residentName || 'Resident';
  const visitorName = options.visitorName || 'Special Guest';
  const propertyName = options.propertyName || 'Greenfield Heights';
  const unit = options.unitName || 'Tower A • Flat 402';
  const timeWindow = options.validTimeWindow || 'Today • Valid Entry';
  const code = options.passCode || options.filenameHint.toUpperCase();
  const note = options.note ? `"${options.note}"` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Themed Visitor Pass</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0C0A09;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 12px;
      min-height: 100vh;
    }
    .poster-card {
      width: 100%;
      max-width: 440px;
      background: ${theme.bgGradient};
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
      border: 2px solid rgba(212, 175, 55, 0.4);
      position: relative;
      text-align: center;
      padding-bottom: 24px;
    }
    
    /* Top Decorative Illumination & Lights */
    .fairy-lights-bar {
      padding-top: 24px;
      display: flex;
      justify-content: center;
      gap: 16px;
    }
    .fairy-light-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FDE047;
      box-shadow: 0 0 14px 4px #FACC15, 0 0 24px #EAB308;
      animation: pulse 2s infinite alternate;
    }
    .fairy-light-dot:nth-child(even) {
      background: #FDBA74;
      box-shadow: 0 0 14px 4px #FB923C;
    }

    /* Occasion House & Calligraphy Header */
    .occasion-header {
      padding: 16px 20px 8px;
    }
    .occasion-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 4px;
      filter: drop-shadow(0 2px 8px rgba(250, 204, 21, 0.4));
    }
    .calligraphy-sub {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: #FACC15;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: -4px;
    }
    .calligraphy-title {
      font-family: 'Great Vibes', 'Playfair Display', cursive, serif;
      font-size: 48px;
      font-weight: normal;
      color: #FDF4DC;
      text-shadow: 0 3px 12px rgba(217, 119, 6, 0.5), 0 1px 2px rgba(0,0,0,0.8);
      line-height: 1.15;
      margin-bottom: 2px;
    }
    .heart-divider {
      color: #D97706;
      font-size: 14px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .heart-line {
      height: 1px;
      width: 45px;
      background: linear-gradient(90deg, transparent, #D97706, transparent);
    }

    /* Golden Framed Scannable QR Container (Matching Reference Image) */
    .qr-frame {
      background: linear-gradient(135deg, #FFFDF8 0%, #FFFFFF 50%, #FFFBEB 100%);
      margin: 0 24px 18px;
      padding: 22px;
      border-radius: 28px;
      border: 3.5px solid #D4AF37;
      box-shadow: 0 12px 36px rgba(0,0,0,0.35), inset 0 0 16px rgba(212, 175, 55, 0.15);
      position: relative;
    }
    .qr-image {
      width: 220px;
      height: 220px;
      border-radius: 12px;
      margin: 0 auto;
      display: block;
    }
    .passcode-pill {
      display: inline-block;
      margin-top: 14px;
      background: #FEF3C7;
      color: #78350F;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 3px;
      padding: 6px 20px;
      border-radius: 10px;
      border: 1px solid #FDE68A;
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    }

    /* Visitor & Host Details */
    .details-card {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      margin: 0 24px 14px;
      padding: 16px 20px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      text-align: left;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-lbl {
      font-size: 11px;
      font-weight: 700;
      color: #D4D4D8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-val {
      font-size: 13px;
      font-weight: 800;
      color: #F4F4F5;
      text-align: right;
    }

    /* Host Note */
    .note-bubble {
      background: rgba(250, 204, 21, 0.12);
      border: 1px dashed rgba(250, 204, 21, 0.4);
      color: #FEF08A;
      margin: 0 24px 14px;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 12px;
      font-style: italic;
    }

    /* Welcome Mat & Gate Footer */
    .gate-footer {
      background: rgba(0, 0, 0, 0.3);
      margin: 0 24px;
      padding: 12px 16px;
      border-radius: 14px;
      font-size: 11px;
      font-weight: 700;
      color: #E4E4E7;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .gate-footer span {
      color: #FACC15;
    }
  </style>
</head>
<body>
  <div class="poster-card">
    <!-- Fairy Lights Header -->
    <div class="fairy-lights-bar">
      <div class="fairy-light-dot"></div>
      <div class="fairy-light-dot"></div>
      <div class="fairy-light-dot"></div>
      <div class="fairy-light-dot"></div>
      <div class="fairy-light-dot"></div>
      <div class="fairy-light-dot"></div>
      <div class="fairy-light-dot"></div>
    </div>

    <!-- Occasion Invitation Calligraphy Header -->
    <div class="occasion-header">
      <div class="occasion-icon-wrap">${theme.emoji}</div>
      <div class="calligraphy-sub">You're</div>
      <div class="calligraphy-title">Invited</div>
      <div class="heart-divider">
        <div class="heart-line"></div>
        <span>♥</span>
        <div class="heart-line"></div>
      </div>
    </div>

    <!-- Golden Framed Scannable QR Container -->
    <div class="qr-frame">
      <img class="qr-image" src="${qrImageUrl}" alt="Scan QR Pass" />
      <div class="passcode-pill">${code}</div>
    </div>

    <!-- Details Summary -->
    <div class="details-card">
      <div class="detail-row">
        <span class="detail-lbl">Guest Name</span>
        <span class="detail-val">${visitorName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-lbl">Host Resident</span>
        <span class="detail-val">${hostName} (${unit})</span>
      </div>
      <div class="detail-row">
        <span class="detail-lbl">Location</span>
        <span class="detail-val">${propertyName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-lbl">Valid Time</span>
        <span class="detail-val">${timeWindow}</span>
      </div>
    </div>

    ${note ? `<div class="note-bubble">📝 Note: ${note}</div>` : ''}

    <!-- Security Gate Footer -->
    <div class="gate-footer">
      🛡️ <span>Fast-Track Pass</span>: Show this QR code at the security gate for instant clearance.
    </div>
  </div>
</body>
</html>
  `;
}

export async function shareQrAsImage(
  qrPayload: string,
  filenameHint: string,
  options?: Partial<ThemedPassShareOptions>
) {
  const opts: ThemedPassShareOptions = {
    qrPayload,
    filenameHint,
    visitorName: options?.visitorName || 'Guest',
    residentName: options?.residentName || 'Resident',
    themeId: options?.themeId,
    greeting: options?.greeting,
    validTimeWindow: options?.validTimeWindow,
    passCode: options?.passCode,
    note: options?.note,
    propertyName: options?.propertyName,
    unitName: options?.unitName,
    passType: options?.passType,
    purpose: options?.purpose,
  };

  const html = buildThemedHtml(opts);

  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on your device');
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Themed Visitor Pass',
      UTI: 'com.adobe.pdf',
    });
  } catch {
    // Fallback to QR image if print fails
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
      qrPayload
    )}`;
    const localUri = `${FileSystem.cacheDirectory}pass_qr_${filenameHint}.png`;
    const { uri } = await FileSystem.downloadAsync(qrImageUrl, localUri);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Visitor Pass',
      });
    }
  }
}
