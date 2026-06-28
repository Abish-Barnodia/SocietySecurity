import { AlertPriority, Role } from '@prisma/client';
interface TriggerAlertParams {
    priority: AlertPriority;
    title: string;
    body: string;
    targetUserIds?: string[];
    targetRoles?: Role[];
    entryId?: string;
    incidentId?: string;
    propertyId: string;
}
export declare const triggerAlert: (params: TriggerAlertParams) => Promise<{
    id: string;
    createdAt: Date;
    propertyId: string;
    status: import("@prisma/client").$Enums.AlertStatus;
    title: string;
    body: string;
    entryId: string | null;
    incidentId: string | null;
    priority: import("@prisma/client").$Enums.AlertPriority;
    targetRoles: import("@prisma/client").$Enums.Role[];
    targetUserIds: string[];
    channel: import("@prisma/client").$Enums.AlertChannel;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
    escalatedAt: Date | null;
    resolvedAt: Date | null;
}>;
export declare const acknowledgeAlert: (alertId: string, userId: string) => Promise<{
    id: string;
    createdAt: Date;
    propertyId: string;
    status: import("@prisma/client").$Enums.AlertStatus;
    title: string;
    body: string;
    entryId: string | null;
    incidentId: string | null;
    priority: import("@prisma/client").$Enums.AlertPriority;
    targetRoles: import("@prisma/client").$Enums.Role[];
    targetUserIds: string[];
    channel: import("@prisma/client").$Enums.AlertChannel;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
    escalatedAt: Date | null;
    resolvedAt: Date | null;
}>;
export {};
//# sourceMappingURL=alert.util.d.ts.map