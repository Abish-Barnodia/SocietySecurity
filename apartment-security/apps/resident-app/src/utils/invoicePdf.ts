import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Invoice } from '../context/MaintenanceContext';

export const generateInvoiceHtml = (inv: Invoice): string => {
  const isPaid = inv.status === 'PAID';
  const successfulPayment = inv.payments?.find((p) => p.status === 'SUCCESS');
  const paidDate = inv.paidAt || successfulPayment?.paidAt;
  const unitText = inv.unit
    ? inv.unit.tower
      ? `Tower ${inv.unit.tower} - Flat ${inv.unit.unitNumber}`
      : `Flat ${inv.unit.unitNumber}`
    : 'Apartment Unit';
  const societyName = inv.property?.name || 'Society Security';
  const societyAddress = inv.property?.address || 'Apartment Complex & Residential Community';
  const residentName = inv.resident?.name || 'Valued Resident';
  const txnId = successfulPayment?.transactionId || 'N/A';
  const orderId = successfulPayment?.razorpayOrderId || 'N/A';
  const invoiceNum = `INV-${inv.id.slice(-8).toUpperCase()}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${invoiceNum}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          body { padding: 40px; color: #0f172a; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #f1f5f9; margin-bottom: 28px; }
          .logo { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .sub-logo { font-size: 13px; color: #64748b; margin-top: 4px; }
          .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
          .badge-paid { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
          .badge-pending { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
          .badge-overdue { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
          .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px; }
          .val-title { font-size: 16px; font-weight: 700; color: #0f172a; }
          .val-sub { font-size: 13px; color: #475569; margin-top: 4px; line-height: 1.4; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
          th { background: #f8fafc; text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 700; color: #475569; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
          td { padding: 16px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
          .total-container { display: flex; justify-content: flex-end; margin-bottom: 32px; }
          .total-box { width: 300px; background: ${isPaid ? '#f0fdf4' : '#fff7ed'}; border-radius: 12px; padding: 16px 20px; border: 1px solid ${isPaid ? '#bbf7d0' : '#fed7aa'}; }
          .total-row { display: flex; justify-content: space-between; align-items: center; }
          .total-label { font-size: 13px; font-weight: 600; color: #475569; }
          .total-val { font-size: 20px; font-weight: 800; color: ${isPaid ? '#15803d' : '#c2410c'}; }
          .payment-info-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 14px 18px; margin-bottom: 32px; font-size: 13px; color: #475569; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">${societyName}</div>
            <div class="sub-logo">${societyAddress}</div>
          </div>
          <div style="text-align: right;">
            <div class="badge ${isPaid ? 'badge-paid' : inv.status === 'OVERDUE' ? 'badge-overdue' : 'badge-pending'}">${inv.status}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 8px; font-weight: 600;">${invoiceNum}</div>
          </div>
        </div>

        <div class="grid">
          <div>
            <div class="label">Billed To</div>
            <div class="val-title">${residentName}</div>
            <div class="val-sub">${unitText}</div>
          </div>
          <div>
            <div class="label">Invoice Details</div>
            <div class="val-sub"><strong>Due Date:</strong> ${new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            ${paidDate ? `<div class="val-sub"><strong>Paid Date:</strong> ${new Date(paidDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>` : ''}
            <div class="val-sub"><strong>Invoice ID:</strong> ${inv.id}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ITEM DESCRIPTION</th>
              <th style="text-align: right;">AMOUNT (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="font-weight: 600; color: #0f172a;">${inv.description}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Monthly residential maintenance assessment</div>
              </td>
              <td style="text-align: right; font-weight: 700; font-size: 15px;">₹${Number(inv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-container">
          <div class="total-box">
            <div class="total-row">
              <span class="total-label">${isPaid ? 'Total Paid:' : 'Total Due:'}</span>
              <span class="total-val">₹${Number(inv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        ${
          isPaid
            ? `
          <div class="payment-info-box">
            <div style="font-weight: 700; color: #15803d; margin-bottom: 4px;">✓ Payment Verified</div>
            <div><strong>Razorpay Payment ID:</strong> ${txnId}</div>
            ${orderId !== 'N/A' ? `<div><strong>Order ID:</strong> ${orderId}</div>` : ''}
          </div>
        `
            : ''
        }

        <div class="footer">
          This is a computer-generated maintenance invoice receipt. Thank you for your prompt payment!
        </div>
      </body>
    </html>
  `;
};

export const downloadInvoicePdf = async (inv: Invoice): Promise<void> => {
  const html = generateInvoiceHtml(inv);

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Download Invoice INV-${inv.id.slice(-8).toUpperCase()}`,
    });
  }
};
