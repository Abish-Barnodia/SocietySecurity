"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePDFBuffer = exports.generateMonthlyPDF = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const generateMonthlyPDF = (reportData) => {
    const doc = new pdfkit_1.default({ margin: 50 });
    doc
        .fontSize(20)
        .text(`Security Operations Report - ${reportData.property.name}`, { align: 'center' })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Period: ${reportData.period.month}/${reportData.period.year}`)
        .text(`Generated At: ${reportData.generatedAt.toISOString()}`)
        .moveDown();
    doc
        .fontSize(16)
        .text('Entries Summary')
        .fontSize(12)
        .text(`Total Entries: ${reportData.entries.total}`)
        .text(`Digital Entries (QR/OTP): ${reportData.entries.digital} (${reportData.entries.digitalRate}%)`)
        .moveDown();
    doc
        .fontSize(16)
        .text('Incidents')
        .fontSize(12)
        .text(`Total Incidents: ${reportData.incidents.total}`)
        .text(`Open: ${reportData.incidents.open}`)
        .text(`In Progress: ${reportData.incidents.inProgress}`)
        .text(`Closed: ${reportData.incidents.closed}`)
        .moveDown();
    doc
        .fontSize(16)
        .text('Guard Compliance')
        .fontSize(12)
        .text(`Shifts Completed: ${reportData.guards.shiftsCompleted}`)
        .moveDown();
    doc
        .fontSize(16)
        .text('Credentials & Passes')
        .fontSize(12)
        .text(`Active Passes: ${reportData.credentials.activePasses}`)
        .text(`Anomalies Found: ${reportData.credentials.anomalies.length}`)
        .moveDown();
    doc.end();
    return doc;
};
exports.generateMonthlyPDF = generateMonthlyPDF;
const generateInvoicePDFBuffer = (invoiceData) => {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));
        // Header banner
        doc.rect(40, 40, 515, 65).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(20).text(invoiceData.societyName || 'Society Security', 55, 55);
        doc.fontSize(10).fillColor('#94a3b8').text(invoiceData.societyAddress || 'Apartment Management & Security Portal', 55, 80);
        // Title & Status
        doc.fillColor('#0f172a').fontSize(16).text('MAINTENANCE INVOICE', 40, 125);
        const statusColor = invoiceData.status === 'PAID' ? '#16a34a' : '#ea580c';
        doc.fontSize(12).fillColor(statusColor).text(`Status: ${invoiceData.status.toUpperCase()}`, 380, 125, { align: 'right', width: 175 });
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 148).lineTo(555, 148).stroke();
        // Invoice Meta & Bill To
        doc.fontSize(10).fillColor('#64748b').text('INVOICE TO:', 40, 160);
        doc.fontSize(12).fillColor('#0f172a').text(invoiceData.residentName || 'Primary Resident', 40, 175);
        const unitText = invoiceData.tower ? `Tower ${invoiceData.tower} - Flat ${invoiceData.unitNumber}` : `Flat ${invoiceData.unitNumber}`;
        doc.fontSize(10).fillColor('#334155').text(unitText, 40, 192);
        doc.fontSize(10).fillColor('#64748b').text('INVOICE DETAILS:', 350, 160);
        doc.fontSize(10).fillColor('#334155').text(`Invoice #: INV-${invoiceData.invoiceId.slice(-8).toUpperCase()}`, 350, 175);
        doc.text(`Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 350, 190);
        if (invoiceData.paidAt) {
            doc.text(`Paid At: ${new Date(invoiceData.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 350, 205);
        }
        if (invoiceData.transactionId) {
            doc.text(`Txn Ref: ${invoiceData.transactionId}`, 350, 220);
        }
        // Line items table
        const tableTop = 250;
        doc.rect(40, tableTop, 515, 26).fill('#f1f5f9');
        doc.fillColor('#0f172a').fontSize(10).text('Description', 55, tableTop + 8);
        doc.text('Amount (INR)', 430, tableTop + 8, { align: 'right', width: 110 });
        doc.fillColor('#334155').fontSize(11).text(invoiceData.description, 55, tableTop + 40);
        doc.fontSize(11).text(`₹${Number(invoiceData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 430, tableTop + 40, { align: 'right', width: 110 });
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, tableTop + 75).lineTo(555, tableTop + 75).stroke();
        // Total
        doc.rect(340, tableTop + 90, 215, 40).fill(invoiceData.status === 'PAID' ? '#f0fdf4' : '#fff7ed');
        doc.fillColor('#0f172a').fontSize(11).text(invoiceData.status === 'PAID' ? 'Total Paid:' : 'Total Due:', 355, tableTop + 103);
        doc.fillColor(invoiceData.status === 'PAID' ? '#15803d' : '#c2410c').fontSize(13).text(`₹${Number(invoiceData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 440, tableTop + 102, { align: 'right', width: 100 });
        // Payment Instructions / Notice
        doc.fontSize(10).fillColor('#64748b').text('Note: Residents can pay directly from the Resident Mobile App via UPI, NetBanking, Debit/Credit Card through Razorpay.', 40, tableTop + 165, { width: 515 });
        doc.fontSize(9).fillColor('#94a3b8').text('This is a computer-generated invoice and requires no physical signature.', 40, 750, { align: 'center', width: 515 });
        doc.end();
    });
};
exports.generateInvoicePDFBuffer = generateInvoicePDFBuffer;
//# sourceMappingURL=pdf.util.js.map