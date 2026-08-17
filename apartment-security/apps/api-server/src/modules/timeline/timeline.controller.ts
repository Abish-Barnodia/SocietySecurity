import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

export const getTimelineEvents = async (req: Request, res: Response) => {
  try {
    const { unitId, guardId } = req.query;

    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID required' });
    }

    // Resolve unit/guard filters up front — independent of each other, so run in parallel.
    const [unitMatch, guardMatch] = await Promise.all([
      unitId && typeof unitId === 'string'
        ? prisma.unit.findFirst({
            where: { propertyId, OR: [{ id: unitId }, { unitNumber: unitId }] },
            select: { id: true },
          })
        : Promise.resolve(null),
      guardId && typeof guardId === 'string'
        ? prisma.guard.findFirst({
            where: {
              propertyId,
              OR: [{ id: guardId }, { badgeNumber: guardId }, { name: { contains: guardId, mode: 'insensitive' } }],
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const unitFilter = unitMatch ? { unitId: unitMatch.id } : {};
    const guardFilter = guardMatch ? { guardId: guardMatch.id } : {};

    // Entries/walkins/passes are independent of each other — fetch concurrently
    // instead of one after another. Each also only selects the fields the
    // mapping below actually reads, instead of pulling full related rows.
    const [entries, walkins, passes, shifts] = await Promise.all([
      prisma.entry.findMany({
        where: {
          entryPoint: { propertyId },
          ...unitFilter,
          ...guardFilter
        },
        select: {
          id: true, method: true, status: true, visitorName: true, createdAt: true, exitAt: true,
          unit: { select: { unitNumber: true } },
          guard: { select: { name: true } },
          entryPoint: { select: { name: true } },
          pass: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      // Wait, WalkinApproval has residentId and entryId.
      prisma.walkinApproval.findMany({
        where: {
          entry: {
            entryPoint: { propertyId },
            ...unitFilter,
            ...guardFilter
          }
        },
        select: {
          id: true, visitorName: true, requestedAt: true, respondedAt: true, decision: true,
          entry: { select: { guard: { select: { name: true } }, entryPoint: { select: { name: true } } } },
          resident: { select: { unitId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.pass.findMany({
        where: {
          unit: { propertyId },
          ...unitFilter
        },
        select: {
          id: true, visitorName: true, createdAt: true, type: true,
          unit: { select: { unitNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      // Guard Shifts (for guard view) — only relevant when filtering by a specific guard.
      guardId && guardMatch
        ? prisma.shift.findMany({
            where: { ...guardFilter },
            select: { id: true, startedAt: true, guard: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10
          })
        : Promise.resolve([] as any[]),
    ]);

    // Map into Unified Format
    const events: any[] = [];

    entries.forEach(e => {
      // Entry Event
      events.push({
        id: `entry-${e.id}`,
        type: e.method === 'MANUAL_GUARD' && e.status === 'DENIED' ? 'Alert' : 'Scan',
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
