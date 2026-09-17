import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response.util';
import { AppError } from '../../middlewares/error.middleware';
import { Role, SocietyStatus, DemoRequestStatus } from '@prisma/client';

export const getPlatformStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalSocieties,
      activeSocieties,
      suspendedSocieties,
      totalUnits,
      totalResidents,
      totalGuards,
      totalManagers,
      pendingDemos,
      todayEntries,
      todayAlerts,
      recentDemos,
      recentSocieties,
      allProperties,
    ] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { status: SocietyStatus.ACTIVE } }),
      prisma.property.count({ where: { status: SocietyStatus.SUSPENDED } }),
      prisma.unit.count(),
      prisma.resident.count(),
      prisma.guard.count(),
      prisma.manager.count(),
      prisma.demoRequest.count({ where: { status: DemoRequestStatus.PENDING } }),
      prisma.entry.count({ where: { createdAt: { gte: today } } }),
      prisma.alert.count({ where: { createdAt: { gte: today } } }),
      prisma.demoRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.property.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          managers: {
            include: { user: { select: { email: true, phone: true } } },
          },
          _count: {
            select: {
              units: true,
              guards: true,
            },
          },
        },
      }),
      prisma.property.findMany({
        select: {
          id: true,
          status: true,
          subscriptionPlan: true,
          totalUnits: true,
          createdAt: true,
        },
      }),
    ]);

    // Plan pricing map
    const planPrices: Record<string, number> = {
      STARTER: 2999,
      STANDARD: 5999,
      ENTERPRISE: 12499,
    };

    // Calculate real MRR from active societies and their subscription tiers
    const estimatedMRR = allProperties
      .filter((p) => p.status === SocietyStatus.ACTIVE)
      .reduce((sum, p) => sum + (planPrices[p.subscriptionPlan || 'STANDARD'] || 5999), 0);

    // ponytail: Build real 7-day daily traffic series directly from entries table
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trafficPromises = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date();
      dStart.setDate(dStart.getDate() - i);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(dStart);
      dEnd.setHours(23, 59, 59, 999);
      trafficPromises.push(
        prisma.entry
          .count({
            where: { createdAt: { gte: dStart, lte: dEnd } },
          })
          .then((count) => ({
            day: dayNames[dStart.getDay()],
            val: count,
          }))
      );
    }
    const trafficData = await Promise.all(trafficPromises);

    // ponytail: Monthly revenue & units telemetry series over recent 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueSeries = [];
    const unitsSeries = [];

    for (let m = 5; m >= 0; m--) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() - m);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const propsUpToMonth = allProperties.filter((p) => new Date(p.createdAt) <= endOfMonth);
      const mrrAtMonth = propsUpToMonth
        .filter((p) => p.status === SocietyStatus.ACTIVE)
        .reduce((sum, p) => sum + (planPrices[p.subscriptionPlan || 'STANDARD'] || 5999), 0);
      const unitsAtMonth = propsUpToMonth.reduce((sum, p) => sum + (p.totalUnits || 0), 0);

      revenueSeries.push({
        day: monthNames[targetDate.getMonth()],
        val: mrrAtMonth || estimatedMRR,
      });

      unitsSeries.push({
        day: monthNames[targetDate.getMonth()],
        val: unitsAtMonth || totalUnits,
      });
    }

    return sendSuccess(res, 200, 'Platform stats retrieved successfully', {
      metrics: {
        totalSocieties,
        activeSocieties,
        suspendedSocieties,
        pendingDemos,
        totalUnits,
        totalResidents,
        totalGuards,
        totalManagers,
        todayEntries,
        todayAlerts,
        estimatedMRR,
      },
      telemetry: {
        traffic: trafficData,
        revenue: revenueSeries,
        units: unitsSeries,
      },
      recentDemos,
      recentSocieties,
    });
  } catch (error) {
    next(error);
  }
};

export const getSocieties = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status as SocietyStatus;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          managers: {
            include: {
              user: {
                select: { id: true, email: true, phone: true, isActive: true, lastLoginAt: true },
              },
            },
          },
          _count: {
            select: {
              units: true,
              guards: true,
              entryPoints: true,
              invoices: true,
              complaints: true,
            },
          },
        },
      }),
    ]);

    return sendSuccess(res, 200, 'Societies retrieved successfully', {
      items,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSocietyById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const society = await prisma.property.findUnique({
      where: { id },
      include: {
        managers: {
          include: {
            user: { select: { id: true, email: true, phone: true, isActive: true, lastLoginAt: true } },
          },
        },
        entryPoints: true,
        managerPortalLock: true,
        _count: {
          select: {
            units: true,
            guards: true,
            amenities: true,
            complaints: true,
            incidents: true,
            invoices: true,
          },
        },
      },
    });

    if (!society) {
      return next(new AppError('Society not found', 404));
    }

    return sendSuccess(res, 200, 'Society details retrieved', society);
  } catch (error) {
    next(error);
  }
};

export const createSociety = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      address,
      city,
      pincode,
      email,
      phone,
      totalUnits = 100,
      totalTowers = 1,
      subscriptionPlan = 'STANDARD',
      managerName,
      managerEmail,
      managerPhone,
      managerPassword,
    } = req.body;

    if (!name || !managerEmail || !managerPhone) {
      return next(new AppError('Society name, manager email and manager phone are required', 400));
    }

    // Slug generation
    let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await prisma.property.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const rawPassword = managerPassword || `Gate@${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setFullYear(subscriptionExpiresAt.getFullYear() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          name,
          slug: uniqueSlug,
          address: address || 'Address to be updated',
          city: city || 'City',
          pincode: pincode || '000000',
          email,
          phone,
          status: SocietyStatus.ACTIVE,
          subscriptionPlan,
          subscriptionExpiresAt,
          totalUnits: Number(totalUnits),
          totalTowers: Number(totalTowers),
        },
      });

      await tx.entryPoint.create({
        data: {
          propertyId: property.id,
          name: 'Main Gate',
          type: 'MAIN',
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email: managerEmail,
          phone: managerPhone,
          passwordHash,
          role: Role.MANAGER,
          isEmailVerified: true,
          isActive: true,
        },
      });

      const manager = await tx.manager.create({
        data: {
          userId: user.id,
          propertyId: property.id,
          name: managerName || 'Estate Manager',
        },
      });

      return { property, user, manager };
    });

    if (req.user) {
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: req.user.userId,
          action: 'CREATE_SOCIETY_DIRECT',
          targetType: 'Property',
          targetId: result.property.id,
          metadata: { name, managerEmail },
        },
      });
    }

    return sendSuccess(res, 201, 'Society created successfully', {
      society: result.property,
      manager: result.manager,
      credentials: {
        email: managerEmail,
        temporaryPassword: rawPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSocietyStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!Object.values(SocietyStatus).includes(status)) {
      return next(new AppError('Invalid society status', 400));
    }

    const updated = await prisma.property.update({
      where: { id },
      data: { status: status as SocietyStatus },
    });

    if (req.user) {
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: req.user.userId,
          action: 'UPDATE_SOCIETY_STATUS',
          targetType: 'Property',
          targetId: id,
          metadata: { status },
        },
      });
    }

    return sendSuccess(res, 200, `Society status updated to ${status}`, updated);
  } catch (error) {
    next(error);
  }
};

export const updateSociety = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const {
      name,
      address,
      city,
      pincode,
      email,
      phone,
      totalUnits,
      totalTowers,
      subscriptionPlan,
      subscriptionExpiresAt,
    } = req.body;

    const updated = await prisma.property.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(address ? { address } : {}),
        ...(city ? { city } : {}),
        ...(pincode ? { pincode } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(totalUnits !== undefined ? { totalUnits: Number(totalUnits) } : {}),
        ...(totalTowers !== undefined ? { totalTowers: Number(totalTowers) } : {}),
        ...(subscriptionPlan ? { subscriptionPlan } : {}),
        ...(subscriptionExpiresAt ? { subscriptionExpiresAt: new Date(subscriptionExpiresAt) } : {}),
      },
    });

    if (req.user) {
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: req.user.userId,
          action: 'UPDATE_SOCIETY_DETAILS',
          targetType: 'Property',
          targetId: id,
          metadata: req.body,
        },
      });
    }

    return sendSuccess(res, 200, 'Society updated successfully', updated);
  } catch (error) {
    next(error);
  }
};

export const getAllManagers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;

    const where: any = {};
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
        { property: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const managers = await prisma.manager.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, phone: true, isActive: true, lastLoginAt: true },
        },
        property: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });

    return sendSuccess(res, 200, 'Managers retrieved successfully', managers);
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.platformAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sendSuccess(res, 200, 'Platform audit logs retrieved', logs);
  } catch (error) {
    next(error);
  }
};

// ponytail: Fetch real subscription plans with live counts and tenant lists from DB
export const getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const properties = await prisma.property.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        subscriptionPlan: true,
        totalUnits: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    const tierDefinitions = [
      {
        id: 'STARTER',
        name: 'Starter Tier',
        price: '₹2,999',
        monthlyCost: 2999,
        billing: '/ month per society',
        unitLimit: 'Up to 100 Units',
        color: '#6366F1',
        features: [
          'Resident Mobile App (iOS & Android)',
          'Guard Tablet Check-in & Gate App',
          'Visitor QR Codes & Pass Generation',
          'Domestic Staff & Maid Tracking',
          'Standard Email & Push Notifications',
        ],
      },
      {
        id: 'STANDARD',
        name: 'Standard Pro',
        price: '₹5,999',
        monthlyCost: 5999,
        billing: '/ month per society',
        unitLimit: 'Up to 300 Units',
        isPopular: true,
        color: '#8B5CF6',
        features: [
          'Everything in Starter Tier',
          'Online Maintenance Billing & Ledger',
          'CCTV RTSP Grid & Camera Integration',
          'Committee Decision & Polls Portal',
          'Priority SMS Gateway & WhatsApp Alerts',
          'Dedicated Phone Support',
        ],
      },
      {
        id: 'ENTERPRISE',
        name: 'Enterprise Matrix',
        price: '₹12,499',
        monthlyCost: 12499,
        billing: '/ month per society',
        unitLimit: 'Unlimited Units & Multi-Gate',
        color: '#10B981',
        features: [
          'Everything in Standard Pro',
          'Automated ANPR Number Plate Recognition',
          'FastTag Gate Barrier Integration',
          'Custom Society Subdomain & Branding',
          'Dedicated Account Manager & SLA 99.9%',
          'On-premise / Local Cloud Backup Sync',
        ],
      },
    ];

    const plansWithLiveStats = tierDefinitions.map((tier) => {
      const matchingProps = properties.filter(
        (p) => (p.subscriptionPlan || 'STANDARD').toUpperCase() === tier.id
      );
      const activeCount = matchingProps.filter((p) => p.status === SocietyStatus.ACTIVE).length;
      const totalUnits = matchingProps.reduce((sum, p) => sum + (p.totalUnits || 0), 0);
      const estimatedRevenue = activeCount * tier.monthlyCost;

      return {
        ...tier,
        activeSocietiesCount: activeCount,
        totalSocietiesCount: matchingProps.length,
        totalManagedUnits: totalUnits,
        monthlyRevenue: estimatedRevenue,
        societies: matchingProps,
      };
    });

    return sendSuccess(res, 200, 'Subscription plans retrieved', plansWithLiveStats);
  } catch (error) {
    next(error);
  }
};

// ponytail: Real platform settings fetched from PlatformSetting table
export const getPlatformSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.platformSetting.findMany();
    const settingsMap: Record<string, any> = {
      smtpHost: 'smtp.sendgrid.net',
      smtpPort: '587',
      smtpUser: 'apikey',
      smsGateway: 'FAST2SMS',
      waApiKey: 'wa_live_sec_prod_key_7792',
      platformMaintenance: false,
    };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return sendSuccess(res, 200, 'Platform settings retrieved', settingsMap);
  } catch (error) {
    next(error);
  }
};

// ponytail: Upsert platform settings into PlatformSetting table
export const updatePlatformSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;

    const updates = Object.entries(payload).map(([key, value]) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: value as any },
        update: { value: value as any },
      })
    );

    await Promise.all(updates);

    if (req.user) {
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: req.user.userId,
          action: 'UPDATE_PLATFORM_SETTINGS',
          targetType: 'PlatformSetting',
          metadata: { keys: Object.keys(payload) },
        },
      });
    }

    return sendSuccess(res, 200, 'Platform settings updated successfully', payload);
  } catch (error) {
    next(error);
  }
};

