import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Handshake, UtensilsCrossed, ShieldAlert } from 'lucide-react';
import DonationCard from '../../components/DonationCard';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { LoadingBlock, EmptyState, ErrorNotice } from '../../components/ui';
import { ngoAPI, statsAPI, getApiErrorMessage } from '../../services/api';
import { FALLBACK_FOOD_CATEGORIES, mergeMeta } from '../../utils/metaFallbacks';
import { useToast } from '../../context/ToastContext';

const SORT_OPTIONS = [
  { value: 'deadline', label: 'Earliest deadline' },
  { value: 'newest', label: 'Newest first' },
  { value: 'quantity', label: 'Largest quantity' },
  { value: 'name', label: 'Name (A–Z)' },
];

/** NGO: browse + accept available donations with search/filter/sort. */
export default function NgoBrowse() {
  const navigate = useNavigate();
  const toast = useToast();

  const [donations, setDonations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 9 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ foodCategories: FALLBACK_FOOD_CATEGORIES });
  const [verificationStatus, setVerificationStatus] = useState('');

  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState({ search: '', category: '', city: '', sort: 'deadline', page: 1 });
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    statsAPI
      .meta()
      .then((res) => setMeta((prev) => mergeMeta(prev, res.data)))
      .catch(() => {
        /* keep the static fallbacks */
      });
    ngoAPI
      .dashboard()
      .then((res) => setVerificationStatus(res.data.ngo?.verificationStatus ?? ''))
      .catch(() => setVerificationStatus(''));
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
      const res = await ngoAPI.browse(params);
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

  const accept = async () => {
    if (!acceptTarget) return;
    setBusy(true);
    try {
      await ngoAPI.accept(acceptTarget._id);
      toast.success(`"${acceptTarget.foodName}" is now accepted by your NGO.`);
      setAcceptTarget(null);
      navigate('/ngo/accepted');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not accept this donation — it may have been taken already.'));
      setAcceptTarget(null);
      load(); // refresh to show the current state
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {verificationStatus === 'PENDING' ? (
        <div className="alert alert-warning flex gap-3" role="note">
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="m-0 font-semibold text-slate-900">Your NGO registration is awaiting administrator verification</p>
            <p className="m-0 text-sm text-slate-600 mt-1">
              You can browse and accept donations in the meantime. Your account will be fully activated once an
              administrator reviews your organization.
            </p>
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="text-xl font-extrabold text-slate-900 m-0">Browse available donations</h2>
        <p className="text-sm text-slate-500 m-0">
          Only non-expired, unclaimed donations are listed. Accepting one is immediate and exclusive.
        </p>
      </div>

      <div className="card p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search food or city…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              aria-label="Search donations"
            />
          </div>
          <select className="select" value={filters.category} onChange={(e) => update({ category: e.target.value })} aria-label="Category filter">
            <option value="">All categories</option>
            {meta.foodCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="City"
            value={filters.city}
            onChange={(e) => update({ city: e.target.value })}
            aria-label="City filter"
          />
          <div className="relative">
            <SlidersHorizontal size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select className="select pl-9" value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-3 mb-0">
          {loading ? 'Loading…' : `${pagination.total} donation${pagination.total === 1 ? '' : 's'} available`}
        </p>
      </div>

      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      {loading ? (
        <LoadingBlock label="Loading available donations…" />
      ) : donations.length === 0 && !error ? (
        <EmptyState
          icon={<UtensilsCrossed size={28} />}
          title="No available donations right now"
          description="New surplus food appears here as soon as donors register it. Try clearing your filters."
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {donations.map((d) => (
              <DonationCard
                key={d._id}
                donation={d}
                action={
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setAcceptTarget(d)}
                      disabled={d.isExpired}
                    >
                      <Handshake size={15} /> {d.isExpired ? 'Expired' : 'Accept'}
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => navigate(`/donations/${d._id}`)}>
                      Details
                    </button>
                  </div>
                }
              />
            ))}
          </div>
          <Pagination pagination={pagination} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(acceptTarget)}
        title="Accept this donation?"
        message={
          acceptTarget
            ? `Your NGO will own "${acceptTarget.foodName}". Another NGO can no longer accept it.`
            : ''
        }
        confirmLabel={busy ? 'Accepting…' : 'Accept donation'}
        cancelLabel="Not now"
        danger={false}
        busy={busy}
        onConfirm={accept}
        onCancel={() => setAcceptTarget(null)}
      />
    </div>
  );
}