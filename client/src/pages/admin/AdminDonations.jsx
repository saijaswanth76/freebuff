import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HandHeart, Search } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import { LoadingBlock, EmptyState, ErrorNotice } from '../../components/ui';
import { adminAPI, statsAPI, getApiErrorMessage } from '../../services/api';
import { formatDateTime, formatDate } from '../../utils/format';

const STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['AVAILABLE', 'Available'],
  ['ACCEPTED', 'Accepted'],
  ['PICKUP_ASSIGNED', 'Pickup assigned'],
  ['COLLECTED', 'Collected'],
  ['DISTRIBUTED', 'Distributed'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
  ['REJECTED', 'Rejected'],
];

/** Admin: monitor every donation with search, status/city/sort filters. */
export default function AdminDonations() {
  const [donations, setDonations] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ foodCategories: [] });

  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    city: '',
    fromDate: '',
    toDate: '',
    sort: 'newest',
    page: 1,
  });

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
      const query = { page: filters.page, limit: 15, sort: filters.sort, includeExpired: 'true' };
      ['status', 'category', 'city', 'search', 'fromDate', 'toDate'].forEach((key) => {
        if (filters[key]) query[key] = filters[key];
      });
      const res = await adminAPI.donations(query);
      setDonations(res.data.donations);
      setPagination(res.data.pagination);
      setStatusCounts(res.data.statusCounts);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load donations.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch, page: 'page' in patch ? patch.page : 1 }));

  const clearFilters = () => {
    setSearchDraft('');
    setFilters({ search: '', status: '', category: '', city: '', fromDate: '', toDate: '', sort: 'newest', page: 1 });
  };

  const hasFilters = filters.search || filters.status || filters.category || filters.city || filters.fromDate || filters.toDate;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 m-0">Donation Management</h2>
        <p className="text-sm text-slate-500 m-0">Monitor every donation on the platform, including expired and cancelled ones.</p>
      </div>

      {/* Status chips with live counts */}
      {Object.keys(statusCounts).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.filter(([value]) => value).map(([value, label]) => (
            <span key={value} className="badge badge-neutral">
              {label}: {statusCounts[value] || 0}
            </span>
          ))}
        </div>
      ) : null}

      <div className="card p-4 md:p-5 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search food name, description or city…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search donations"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select className="select" value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status filter">
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value || 'all'} value={value}>{label}</option>
            ))}
          </select>
          <select className="select" value={filters.category} onChange={(e) => update({ category: e.target.value })} aria-label="Category filter">
            <option value="">All categories</option>
            {meta.foodCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="input" placeholder="City" value={filters.city} onChange={(e) => update({ city: e.target.value })} aria-label="City filter" />
          <select className="select" value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="deadline">Earliest deadline</option>
            <option value="quantity">Largest quantity</option>
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 items-end">
          <div>
            <label className="field-label" htmlFor="fromDate">From date</label>
            <input id="fromDate" type="date" className="input" value={filters.fromDate} onChange={(e) => update({ fromDate: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="toDate">To date</label>
            <input id="toDate" type="date" className="input" value={filters.toDate} onChange={(e) => update({ toDate: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" onClick={clearFilters} disabled={!hasFilters}>
              Clear filters
            </button>
            <span className="text-sm text-slate-500 self-center">
              {loading ? '' : `${pagination.total} record${pagination.total === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading donations…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : donations.length === 0 ? (
        <EmptyState icon={<HandHeart size={28} />} title="No donations match these filters" description="Adjust or clear the filters to see more records." />
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Food</th>
                <th>Donor</th>
                <th>NGO</th>
                <th>Volunteer</th>
                <th>City</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d._id}>
                  <td>
                    <Link to={`/donations/${d._id}`} className="link no-underline font-semibold">{d.foodName}</Link>
                    <p className="text-xs text-slate-500 m-0">{d.category} · {d.quantity} {d.unit}</p>
                  </td>
                  <td className="text-sm">{d.donorId?.name || '—'}</td>
                  <td className="text-sm">{d.acceptedByNgoId?.organizationName || d.acceptedByNgoId?.name || '—'}</td>
                  <td className="text-sm">{d.assignedVolunteerId?.name || '—'}</td>
                  <td className="text-sm">{d.city}</td>
                  <td className="text-sm text-slate-500">{formatDate(d.safeConsumptionDeadline)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="text-sm text-slate-500">{formatDateTime(d.statusUpdatedAt || d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={(page) => update({ page })} />

      <div className="alert alert-info">
        <p className="m-0 text-sm">
          Administrators monitor and report on donations. Status changes to run through the standard state
          machine: donors cancel, accepted NGOs confirm distributions, volunteers confirm pickup and delivery.
          Unsuitable listings can be rejected while they are still <strong>AVAILABLE</strong>.
        </p>
      </div>
    </div>
  );
}