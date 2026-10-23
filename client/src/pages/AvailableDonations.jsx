import { useCallback, useEffect, useState } from 'react';
import { Search, SlidersHorizontal, UtensilsCrossed } from 'lucide-react';
import DonationCard from '../components/DonationCard';
import Pagination from '../components/Pagination';
import { LoadingBlock, EmptyState, ErrorNotice } from '../components/ui';
import { donationsAPI, statsAPI, getApiErrorMessage } from '../services/api';

const SORT_OPTIONS = [
  { value: 'deadline', label: 'Earliest deadline' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'quantity', label: 'Largest quantity' },
  { value: 'name', label: 'Name (A–Z)' },
];

/** Public browse page: search, filters, sorting and pagination from the API. */
export default function AvailableDonations() {
  const [donations, setDonations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 9 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [meta, setMeta] = useState({ foodCategories: [], units: [] });

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    city: '',
    sort: 'deadline',
    page: 1,
  });
  // Text inputs are debounced before hitting the API.
  const [searchDraft, setSearchDraft] = useState('');

  useEffect(() => {
    statsAPI.meta().then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => ({ ...f, search: searchDraft, page: 1 })), 400);
    return () => clearTimeout(id);
  }, [searchDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: filters.page, limit: 9, sort: filters.sort };
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.city) params.city = filters.city;
      const res = await donationsAPI.list(params);
      setDonations(res.data.donations);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load donations.'));
      setDonations([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: 'page' in patch ? patch.page : 1 }));

  return (
    <div className="shell py-10">
      <div className="max-w-3xl">
        <span className="eyebrow">Available donations</span>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Surplus food waiting for a home</h1>
        <p className="muted mt-3">
          Listings are shown while their safe-consumption deadline is in the future. Donor identities and
          contact details are only revealed to authorised users after an NGO accepts a donation.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 md:p-5 mt-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search food or city…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              aria-label="Search donations"
            />
          </div>
          <select
            className="select"
            value={filters.category}
            onChange={(e) => update({ category: e.target.value })}
            aria-label="Filter by food category"
          >
            <option value="">All categories</option>
            {meta.foodCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="City (e.g. Pune)"
            value={filters.city}
            onChange={(e) => update({ city: e.target.value })}
            aria-label="Filter by city"
          />
          <div className="relative">
            <SlidersHorizontal size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              className="select pl-9"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value })}
              aria-label="Sort donations"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
          <span>
            {loading ? 'Loading…' : `${pagination.total} donation${pagination.total === 1 ? '' : 's'} found`}
          </span>
          {filters.search || filters.category || filters.city ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setSearchDraft('');
                setFilters({ search: '', category: '', city: '', sort: filters.sort, page: 1 });
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="mt-5"><ErrorNotice message={error} onRetry={load} /></div> : null}

      {loading ? (
        <LoadingBlock label="Loading available donations…" />
      ) : donations.length === 0 && !error ? (
        <EmptyState
          icon={<UtensilsCrossed size={28} />}
          title="No donations match your search"
          description="Try removing a filter — new surplus food is added by donors throughout the day."
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            {donations.map((d) => (
              <DonationCard key={d._id} donation={d} />
            ))}
          </div>
          <Pagination pagination={pagination} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}
    </div>
  );
}