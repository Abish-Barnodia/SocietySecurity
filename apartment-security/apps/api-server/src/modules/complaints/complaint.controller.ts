import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { auditLog } from '../../utils/audit.util';
import { io } from '../../server';
import { uploadBuffer } from '../../utils/objectStorage.util';
import { getResidentContext } from '../../utils/residentContext.util';
import { Role } from '@prisma/client';

const complaintInclude = {
  resident: { select: { id: true, name: true, userId: true, unit: { select: { unitNumber: true, tower: true } } } },
  updates: { orderBy: { createdAt: 'asc' as const } },
};

export const listComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, q, sort } = req.query as Record<string, string | undefined>;

    const where: any = {};
    if (req.user!.role === 'RESIDENT') {
      const { residentId } = await getResidentContext(req.user!.userId);
      where.residentId = residentId;
    } else {
      const propertyId = req.user!.propertyId;
      if (req.user!.role === 'MANAGER' && !propertyId) {
        return next(new AppError('No property context found', 400));
      }
      if (propertyId) where.propertyId = propertyId;
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
      include: complaintInclude,
      take: 100,
    });

    sendSuccess(res, 200, 'Complaints retrieved', complaints);
  } catch (err) { next(err); }
};

export const createComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { residentId, unitId, propertyId } = await getResidentContext(req.user!.userId);
    const { category, priority, title, description, attachmentUrls } = req.body;

    const complaint = await prisma.complaint.create({
      data: {
        propertyId,
        unitId,
        residentId,
        category,
        priority: priority ?? 'MEDIUM',
        title,
        description,
        attachmentUrls: attachmentUrls ?? [],
      },
      include: complaintInclude,
    });

    await prisma.complaintUpdate.create({
      data: {
        complaintId: complaint.id,
        actorId: req.user!.userId,
        actorRole: 'RESIDENT',
        action: 'CREATED',
      },
    });

    await auditLog(req.user!.userId, 'CREATE_COMPLAINT', 'Complaint', complaint.id);

    io?.to(`property:${propertyId}`).emit('complaint:new', complaint);

    sendSuccess(res, 201, 'Complaint submitted', complaint);
  } catch (err) { next(err); }
};

const canAccessComplaint = async (userId: string, role: string, complaint: { propertyId: string; residentId: string }) => {
  if (role === 'RESIDENT') {
    const { residentId } = await getResidentContext(userId);
    return residentId === complaint.residentId;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { manager: true, committee: true } });
  if (role === 'MANAGER') return user?.manager?.propertyId === complaint.propertyId;
  return role === 'COMMITTEE'; // committee members aren't scoped to a single property today
};

export const getComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const complaint = await prisma.complaint.findUnique({ where: { id }, include: complaintInclude });
    if (!complaint) return next(new AppError('Complaint not found', 404));

    const allowed = await canAccessComplaint(req.user!.userId, req.user!.role, complaint);
    if (!allowed) return next(new AppError('You do not have access to this complaint', 403));

    sendSuccess(res, 200, 'Complaint retrieved', complaint);
  } catch (err) { next(err); }
};

export const updateComplaintStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status, note } = req.body;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return next(new AppError('Complaint not found', 404));

    const data: any = { status };
    if (status === 'RESOLVED') data.resolutionNote = note ?? complaint.resolutionNote;
    if (status === 'RESOLVED' && !complaint.resolvedAt) data.resolvedAt = new Date();
    if (status === 'CLOSED' && !complaint.closedAt) data.closedAt = new Date();

    const updated = await prisma.complaint.update({ where: { id }, data, include: complaintInclude });

    await prisma.complaintUpdate.create({
      data: {
        complaintId: id,
        actorId: req.user!.userId,
        actorRole: req.user!.role as Role,
        action: `STATUS_${status}`,
        note,
      },
    });

    io?.to(`property:${complaint.propertyId}`).emit('complaint:update', updated);
    io?.to(`user:${updated.resident.userId}`).emit('complaint:update', updated);

    sendSuccess(res, 200, 'Complaint status updated', updated);
  } catch (err) { next(err); }
};

export const assignComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { assignedTo, assignedToName } = req.body;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return next(new AppError('Complaint not found', 404));

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        assignedTo,
        assignedToName,
        assignedAt: new Date(),
        status: complaint.status === 'OPEN' ? 'IN_PROGRESS' : complaint.status,
      },
      include: complaintInclude,
    });

    await prisma.complaintUpdate.create({
      data: {
        complaintId: id,
        actorId: req.user!.userId,
        actorRole: req.user!.role as Role,
        action: 'ASSIGNED',
        note: `Assigned to ${assignedToName}`,
      },
    });

    io?.to(`property:${complaint.propertyId}`).emit('complaint:update', updated);
    io?.to(`user:${updated.resident.userId}`).emit('complaint:update', updated);

    sendSuccess(res, 200, 'Complaint assigned', updated);
  } catch (err) { next(err); }
};

const ALLOWED_UPLOAD_MIME = /^(image\/|video\/|audio\/|application\/pdf$|application\/vnd\.)/;

export const uploadComplaintAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = await getResidentContext(req.user!.userId);
    const file = req.file;
    if (!file) return next(new AppError('No file uploaded', 400));
    if (!ALLOWED_UPLOAD_MIME.test(file.mimetype)) {
      return next(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
    }

    const path = `complaints/${propertyId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const url = await uploadBuffer(file.buffer, path, file.mimetype);

    sendSuccess(res, 201, 'Uploaded', { url, mimeType: file.mimetype, sizeBytes: file.size, fileName: file.originalname });
  } catch (err) { next(err); }
};
