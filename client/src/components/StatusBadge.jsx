import { statusMeta } from '../utils/format';

/** Consistent status pill for donations and pickup tasks. */
export default function StatusBadge({ status, kind = 'donation' }) {
  const meta = statusMeta(status, kind);
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}
