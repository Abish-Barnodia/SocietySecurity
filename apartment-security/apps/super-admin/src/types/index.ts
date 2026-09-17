export type SocietyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
export type DemoRequestStatus = 'PENDING' | 'CONTACTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

export interface ManagerUser {
  id: string;
  email: string;
  phone: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface Manager {
  id: string;
  userId: string;
  propertyId: string;
  name: string;
  createdAt: string;
  user?: ManagerUser;
  property?: {
    id: string;
    name: string;
    slug: string;
    status: SocietyStatus;
  };
}

export interface Society {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  pincode: string;
  email: string | null;
  phone: string | null;
  status: SocietyStatus;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
  totalUnits: number;
  totalTowers: number;
  createdAt: string;
  updatedAt: string;
  managers?: Manager[];
  _count?: {
    units: number;
    guards: number;
    entryPoints: number;
    invoices: number;
    complaints: number;
    amenities?: number;
    incidents?: number;
  };
}

export interface DemoRequest {
  id: string;
  contactName: string;
  email: string;
  phone: string;
  societyName: string;
  city: string | null;
  numberOfUnits: number | null;
  message: string | null;
  status: DemoRequestStatus;
  notes: string | null;
  createdPropertyId: string | null;
  createdProperty?: {
    id: string;
    name: string;
    slug: string;
    status: SocietyStatus;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformMetrics {
  totalSocieties: number;
  activeSocieties: number;
  suspendedSocieties: number;
  pendingDemos: number;
  totalUnits: number;
  totalResidents: number;
  totalGuards: number;
  totalManagers: number;
  todayEntries: number;
  todayAlerts: number;
  estimatedMRR: number;
}

export interface ChartPoint {
  day: string;
  val: number;
}

export interface PlatformTelemetry {
  traffic: ChartPoint[];
  revenue: ChartPoint[];
  units: ChartPoint[];
}

export interface PlatformStatsResponse {
  metrics: PlatformMetrics;
  telemetry?: PlatformTelemetry;
  recentDemos: DemoRequest[];
  recentSocieties: Society[];
}

export interface SubscriptionPlanItem {
  id: string;
  name: string;
  price: string;
  monthlyCost: number;
  billing: string;
  unitLimit: string;
  isPopular?: boolean;
  color: string;
  features: string[];
  activeSocietiesCount: number;
  totalSocietiesCount: number;
  totalManagedUnits: number;
  monthlyRevenue: number;
  societies: {
    id: string;
    name: string;
    slug: string;
    status: SocietyStatus;
    totalUnits: number;
    createdAt: string;
  }[];
}

export interface PlatformSettingsMap {
  smtpHost: string;
  smtpPort: string;
  smtpUser?: string;
  smsGateway: string;
  waApiKey: string;
  platformMaintenance?: boolean;
  [key: string]: any;
}

export interface PlatformAuditLog {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: any;
  createdAt: string;
}

export interface AuthState {
  token: string | null;
  user: {
    id: string;
    email: string;
    role: string;
  } | null;
}

