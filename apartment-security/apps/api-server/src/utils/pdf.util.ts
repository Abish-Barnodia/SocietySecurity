import PDFDocument from 'pdfkit';

export const generateMonthlyPDF = (reportData: any): any => {
  const doc = new PDFDocument({ margin: 50 });

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
