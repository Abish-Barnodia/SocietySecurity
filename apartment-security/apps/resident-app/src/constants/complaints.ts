import { Ionicons } from '@expo/vector-icons';
import { ComplaintCategory, ComplaintPriority, ComplaintStatus } from '../context/ComplaintsContext';

export const CATEGORY_OPTIONS: { value: ComplaintCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'MAINTENANCE', label: 'Maintenance', icon: 'build' },
  { value: 'SECURITY', label: 'Security', icon: 'shield-checkmark' },
  { value: 'NOISE', label: 'Noise', icon: 'volume-high' },
  { value: 'PARKING', label: 'Parking', icon: 'car' },
  { value: 'CLEANLINESS', label: 'Cleanliness', icon: 'sparkles' },
  { value: 'BILLING', label: 'Billing', icon: 'receipt' },
  { value: 'STAFF_BEHAVIOR', label: 'Staff Behavior', icon: 'people' },
  { value: 'AMENITY', label: 'Amenity', icon: 'business' },
  { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle' },
];

export const PRIORITY_OPTIONS: { value: ComplaintPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export const categoryMeta = (category: ComplaintCategory) =>
  CATEGORY_OPTIONS.find((c) => c.value === category) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];

export const priorityLabel = (priority: ComplaintPriority) =>
  PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? priority;

export const statusLabel = (status: ComplaintStatus) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;

export const STATUS_COLOR_KEY: Record<ComplaintStatus, 'primary' | 'warning' | 'success' | 'textMuted'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'primary',
  RESOLVED: 'success',
  CLOSED: 'textMuted',
};

export const PRIORITY_COLOR_KEY: Record<ComplaintPriority, 'textMuted' | 'primary' | 'warning' | 'danger'> = {
  LOW: 'textMuted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  URGENT: 'danger',
};
