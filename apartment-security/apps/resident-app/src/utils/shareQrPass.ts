import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// The guard needs to actually scan the QR, so a text message with a pass
// code isn't enough — this downloads a real PNG of the QR (via the same
// qrserver.com API PassDetailScreen's PDF export already trusts) and hands
// it to the native share sheet, so WhatsApp/etc. attach it as a real photo
// instead of plain text.
export async function shareQrAsImage(qrPayload: string, filenameHint: string) {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrPayload)}`;
  const localUri = `${FileSystem.cacheDirectory}pass_qr_${filenameHint}.png`;
  const { uri } = await FileSystem.downloadAsync(qrImageUrl, localUri);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on your device');
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Visitor Pass QR' });
}
