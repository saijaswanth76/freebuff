import { AlertTriangle, Inbox } from 'lucide-react';

/** Inline loading indicator with an optional label. */
export function Spinner({ label = 'Loading…', small = false }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted text-sm">
      <span className={small ? 'spinner spinner-sm' : 'spinner'} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Full-area loading block used inside pages and tables. */
export function LoadingBlock({ label = 'Loading data from the server…' }) {
  return (
    <div className="empty-state">
      <span className="spinner" aria-hidden="true" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}

/** Friendly empty state shown when a list has no records. */
export function EmptyState({ icon, title, description, action = null }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon || <Inbox size={28} />}</span>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description ? <p className="text-sm mt-1 max-w-md mx-auto">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Inline error box for failed API calls. */
export function ErrorNotice({ message, onRetry = null }) {
  if (!message) return null;
  return (
    <div className="alert alert-danger flex items-start gap-2" role="alert">
      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold">Something went wrong</p>
        <p className="text-sm">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm btn-outline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
