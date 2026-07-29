import { Ionicons } from '@expo/vector-icons';
import { WorkerType, DayOfWeek } from '../context/DomesticWorkersContext';

export const WORKER_TYPE_OPTIONS: { value: WorkerType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'MAID', label: 'Maid', icon: 'home' },
  { value: 'COOK', label: 'Cook', icon: 'restaurant' },
  { value: 'DRIVER', label: 'Driver', icon: 'car' },
  { value: 'NANNY', label: 'Nanny', icon: 'happy' },
  { value: 'ELECTRICIAN', label: 'Electrician', icon: 'flash' },
  { value: 'PLUMBER', label: 'Plumber', icon: 'water' },
  { value: 'GARDENER', label: 'Gardener', icon: 'leaf' },
  { value: 'SECURITY_GUARD', label: 'Security Guard', icon: 'shield-checkmark' },
  { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle' },
];

export const workerTypeMeta = (type: WorkerType) =>
  WORKER_TYPE_OPTIONS.find((t) => t.value === type) ?? WORKER_TYPE_OPTIONS[WORKER_TYPE_OPTIONS.length - 1];

export const DAY_OPTIONS: { value: DayOfWeek; short: string }[] = [
  { value: 'MONDAY', short: 'Mon' },
  { value: 'TUESDAY', short: 'Tue' },
  { value: 'WEDNESDAY', short: 'Wed' },
  { value: 'THURSDAY', short: 'Thu' },
  { value: 'FRIDAY', short: 'Fri' },
  { value: 'SATURDAY', short: 'Sat' },
  { value: 'SUNDAY', short: 'Sun' },
];

export const formatWorkingDays = (days: DayOfWeek[]) => {
  if (days.length === 7) return 'Every day';
  return days.map((d) => DAY_OPTIONS.find((o) => o.value === d)?.short ?? d).join(', ');
};
