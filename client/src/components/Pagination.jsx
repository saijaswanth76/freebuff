import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Pagination control backed by the backend's pagination object. */
export default function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
      <p className="text-sm text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of {pages} · {total} record{total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={15} /> Prev
        </button>
        <button type="button" className="btn btn-sm btn-outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
