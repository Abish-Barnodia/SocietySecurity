import jsPDF from 'jspdf';
import { API_BASE } from './config';

export type CredentialEntry = { name: string; loginId: string; password: string };

// One PDF can list multiple people (a whole household) or just one (a guard).
export function buildCredentialPdf(propertyName: string, role: string, entries: CredentialEntry[]): Blob {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Account Credentials', 20, 20);
  doc.setFontSize(11);
  doc.text(`Property: ${propertyName}`, 20, 32);
  doc.text(`Role: ${role}`, 20, 39);

  let y = 55;
  entries.forEach((entry, i) => {
    doc.setFontSize(13);
    doc.text(entry.name, 20, y);
    doc.setFontSize(11);
    doc.text(`Login ID: ${entry.loginId}`, 26, y + 8);
    doc.text(`Password: ${entry.password}`, 26, y + 16);
    y += 30;
    if (i < entries.length - 1) {
      doc.setDrawColor(220);
      doc.line(20, y - 8, 190, y - 8);
    }
  });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Keep this document secure — do not forward beyond the intended recipient.', 20, y + 5);

  return doc.output('blob');
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Claims one of the (representative) account's limited shares — max 2,
// enforced server-side — before generating/handing off the PDF. A household
// PDF bundles several members, but the share limit is charged once per
// action against the primary/first account, not once per member, so a
// 3-person household doesn't burn through the cap 3x faster than a guard.
async function claimCredentialShare(kind: 'guards' | 'residents', id: string, getAuthToken: () => string) {
  const res = await fetch(`${API_BASE}/${kind}/${id}/credential-share`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getAuthToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Could not share credentials right now.');
  }
}

export async function shareCredentialPdf(opts: {
  kind: 'guards' | 'residents';
  id: string;
  getAuthToken: () => string;
  propertyName: string;
  role: string;
  entries: CredentialEntry[];
  target: 'whatsapp' | 'email';
  phone?: string;
}) {
  await claimCredentialShare(opts.kind, opts.id, opts.getAuthToken);

  const blob = buildCredentialPdf(opts.propertyName, opts.role, opts.entries);
  const filename = `Credentials_${opts.entries[0]?.name.replace(/\s+/g, '_') || 'account'}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  const names = opts.entries.map(e => e.name).join(', ');
  const shareText = `Hello, here are the login credentials for ${names} at ${opts.propertyName}. Please keep this secure.`;

  // Hands the actual PDF straight to whatever the OS's native share sheet
  // offers — WhatsApp/Mail apps on mobile, and (on Windows) an installed
  // WhatsApp Desktop app too. Falls through to the download + wa.me/mailto
  // fallback below only when no such target exists at all.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Account Credentials', text: shareText });
      return;
    } catch {
      return; // user cancelled the native share sheet
    }
  }

  downloadBlob(blob, filename);
  if (opts.target === 'whatsapp') {
    const phone = (opts.phone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(shareText)}`, '_blank');
    alert('Credentials PDF downloaded. Attach it in the WhatsApp chat that just opened — browsers on desktop can\'t attach files to a link automatically.');
  } else {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Account Credentials - ${names}`)}&body=${encodeURIComponent(shareText)}`;
    alert('Credentials PDF downloaded. Attach it to the email draft that just opened — mailto links can\'t carry attachments.');
  }
}
