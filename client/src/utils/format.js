/** Shared formatting helpers (kept dependency-free for easy explanation). */

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatQuantity = (quantity, unit) =>
  quantity !== undefined && quantity !== null ? `${quantity} ${unit || ''}`.trim() : '—';

export const isPast = (value) => (value ? new Date(value).getTime() < Date.now() : false);

/** Human readable remaining time until the safe-consumption deadline. */
export const timeLeft = (value) => {
  if (!value) return '';
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return 'Deadline passed';
  const hours = Math.floor(diff / 3600000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(diff / 60000))}m left`;
};

/** Converts an ISO value for datetime-local inputs ("YYYY-MM-DDTHH:mm"). */
export const toDateTimeLocal = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const ROLE_LABELS = {
  DONOR: 'Food Donor',
  NGO: 'NGO',
  VOLUNTEER: 'Volunteer',
  ADMIN: 'Administrator',
};

/** Visual metadata for donation + pickup statuses. */
export const DONATION_STATUS_META = {
  AVAILABLE: { label: 'Available', badge: 'badge-available' },
  ACCEPTED: { label: 'Accepted', badge: 'badge-accepted' },
  PICKUP_ASSIGNED: { label: 'Pickup Assigned', badge: 'badge-assigned' },
  COLLECTED: { label: 'Collected', badge: 'badge-collected' },
  DISTRIBUTED: { label: 'Distributed', badge: 'badge-progress' },
  COMPLETED: { label: 'Completed', badge: 'badge-completed' },
  CANCELLED: { label: 'Cancelled', badge: 'badge-cancelled' },
  REJECTED: { label: 'Rejected', badge: 'badge-rejected' },
};

export const PICKUP_STATUS_META = {
  OPEN: { label: 'Looking for volunteer', badge: 'badge-warning' },
  ASSIGNED: { label: 'Assigned', badge: 'badge-assigned' },
  COLLECTED: { label: 'Collected', badge: 'badge-collected' },
  DELIVERED: { label: 'Delivered', badge: 'badge-progress' },
  CONFIRMED: { label: 'Confirmed', badge: 'badge-completed' },
  CANCELLED: { label: 'Cancelled', badge: 'badge-cancelled' },
};

export const statusMeta = (status, kind = 'donation') =>
  (kind === 'pickup' ? PICKUP_STATUS_META : DONATION_STATUS_META)[status] || {
    label: status || 'Unknown',
    badge: 'badge-neutral',
  };
