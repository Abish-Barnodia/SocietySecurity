import api from '../utils/api';

export type ScanResult = {
  id?: string;
  status: 'APPROVED' | 'DENIED' | 'PENDING_APPROVAL';
  reason?: string;
  visitorName?: string;
  visitorPhone?: string | null;
  visitorPhoto?: string | null;
  vehicleNumber?: string | null;
  residentPhone?: string | null;
  unit?: { unitNumber: string; tower: string | null } | null;
  gateName?: string | null;
  timeoutAt?: string | null;
};

// The QR itself fully describes the visit once the backend verifies the
// signed pass — the guard app only ever supplies where the scan happened.
export async function submitScan(entryPointId: string, qrPayload: string): Promise<ScanResult> {
  const response = await api.post('/entries', { method: 'QR_SCAN', entryPointId, qrPayload });
  return response.data.data;
}

export async function callResident(entryId: string): Promise<{ guardCalledAt: string }> {
  const response = await api.post(`/walkins/${entryId}/call-resident`);
  return response.data.data;
}
