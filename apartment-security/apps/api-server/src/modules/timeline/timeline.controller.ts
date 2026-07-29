import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

export const getTimelineEvents = async (req: Request, res: Response) => {
  try {
    const { unitId, guardId } = req.query;

    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID required' });
    }

    let unitFilter = {};
    if (unitId && typeof unitId === 'string') {
      // Find the unit first to get its actual ID based on unitNumber or ID
      const unit = await prisma.unit.findFirst({
        where: { 
          propertyId,
          OR: [
            { id: unitId },
            { unitNumber: unitId }
          ]
        }
      });
      if (unit) {
        unitFilter = { unitId: unit.id };
      }
    }

    let guardFilter = {};
    if (guardId && typeof guardId === 'string') {
      const guard = await prisma.guard.findFirst({
        where: { 
          propertyId,
          OR: [
            { id: guardId },
            { badgeNumber: guardId },
            { name: { contains: guardId, mode: 'insensitive' } }
          ]
        }
      });
      if (guard) {
        guardFilter = { guardId: guard.id };
      }
    }

    // 1. Fetch Entries
    const entries = await prisma.entry.findMany({
      where: { 
        entryPoint: { propertyId },
        ...unitFilter,
        ...guardFilter
      },
      include: {
        unit: true,
        guard: true,
        entryPoint: true,
        pass: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // 2. Fetch Walkin Approvals (if unit filter applied, since guards don't strictly own these in the same way, but let's query via entry relation)
    // Wait, WalkinApproval has residentId and entryId.
    const walkins = await prisma.walkinApproval.findMany({
      where: {
        entry: {
          entryPoint: { propertyId },
          ...unitFilter,
          ...guardFilter
        }
      },
      include: {
        entry: { include: { guard: true, entryPoint: true } },
        resident: { include: { user: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // 3. Fetch Passes
    const passes = await prisma.pass.findMany({
      where: {
        unit: { propertyId },
        ...unitFilter
      },
      include: {
        unit: true,
        resident: { include: { user: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // 4. Guard Shifts (for guard view)
    let shifts: any[] = [];
    if (guardId && guardFilter) {
      shifts = await prisma.shift.findMany({
        where: {
          ...guardFilter
        },
        include: {
          guard: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
    }

    // Map into Unified Format
    const events: any[] = [];

    entries.forEach(e => {
      // Entry Event
      events.push({
        id: `entry-${e.id}`,
        type: e.method === 'WALKIN' && e.status === 'DENIED' ? 'Alert' : 'Scan',
        iconBg: e.status === 'DENIED' ? '#FEF3C7' : '#D1FAE5',
        iconColor: e.status === 'DENIED' ? '#D97706' : '#059669',
        iconType: e.status === 'DENIED' ? 'AlertTriangle' : 'ArrowRight',
        title: `Visitor ${e.exitAt ? 'Exit' : 'Entry'} — ${e.visitorName}`,
        time: e.createdAt,
        description: e.exitAt 
          ? `${e.visitorName} exited.` 
          : `${e.visitorName} entered via ${e.entryPoint?.name}.${e.pass ? ` Pass ${e.pass.id.slice(-4)} verified.` : ''}`,
        unit: e.unit ? `${e.unit.unitNumber}` : undefined,
        guard: e.guard?.name,
        gate: e.entryPoint?.name,
        pass: e.pass ? `PASS-${e.pass.id.slice(-4)}` : undefined,
      });
    });

    walkins.forEach(w => {
      // Request Event
      events.push({
        id: `walkin-req-${w.id}`,
        type: 'Alert',
        iconBg: '#FEF3C7',
        iconColor: '#D97706',
        iconType: 'AlertTriangle',
        title: `Walk-In Request — ${w.visitorName}`,
        time: w.requestedAt,
        description: `Guard ${w.entry.guard.name} submitted walk-in approval request for ${w.visitorName}.`,
        unit: w.resident?.unitId ? `Unit` : undefined, // Simplify for now
        guard: w.entry.guard.name,
        gate: w.entry.entryPoint.name,
        linkedEvent: true
      });

      // Approval Event (if responded)
      if (w.respondedAt) {
        events.push({
          id: `walkin-res-${w.id}`,
          type: 'Approval',
          iconBg: w.decision === 'APPROVED' ? '#D1FAE5' : '#FEE2E2',
          iconColor: w.decision === 'APPROVED' ? '#059669' : '#DC2626',
          iconType: w.decision === 'APPROVED' ? 'CheckCircle' : 'XCircle',
          title: `Walk-In ${w.decision === 'APPROVED' ? 'Approved' : 'Denied'}`,
          time: w.respondedAt,
          description: `Resident ${w.decision === 'APPROVED' ? 'approved' : 'denied'} walk-in for ${w.visitorName}.`,
          unit: w.resident?.unitId ? `Unit` : undefined,
          guard: w.entry.guard.name,
          gate: w.entry.entryPoint.name,
          linkedEvent: true
        });
      }
    });

    passes.forEach(p => {
      events.push({
        id: `pass-${p.id}`,
        type: 'Pass Created',
        iconBg: '#F3F4F6',
        iconColor: '#4B5563',
        iconType: 'Key',
        title: `Pass Created — ${p.visitorName}`,
        time: p.createdAt,
        description: `Resident created a ${p.type.toLowerCase()} pass.`,
        unit: p.unit?.unitNumber,
        pass: `PASS-${p.id.slice(-4)}`
      });
    });
    
    shifts.forEach(s => {
      events.push({
        id: `shift-${s.id}`,
        type: 'Checkin',
        iconBg: '#D1FAE5',
        iconColor: '#059669',
        iconType: 'ArrowRight',
        title: `Shift Started`,
        time: s.startedAt,
        description: `Checked in for shift.`,
        guard: s.guard.name
      });
    });

    // Sort descending by time
    events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Take top 50
    const finalEvents = events.slice(0, 50).map(e => ({
      ...e,
      time: new Date(e.time).toLocaleString('en-US', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      })
    }));

    return res.json({ events: finalEvents });

  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline events' });
  }
};
