import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, HandHeart, Pencil, XCircle, History, Eye } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { LoadingBlock, ErrorNotice, EmptyState, Spinner } from '../../components/ui';
import { donationsAPI, getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, isPast } from '../../utils/format';

/** Donor: full list of my donations with status filter, edit and cancel actions. */
export default function MyDonations() {
  const toast = useToast();

  const [donations, setDonations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10, sort: 'newest' };
      if (statusFilter) params.status = statusFilter;
      const res = await donationsAPI.my(params);
      setDonations(res.data.donations);
      setPagination(res.data.pagination);
      setSummary(res.data.summary);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your donations.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const cancelDonation = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await donationsAPI.cancel(cancelTarget._id, 'Cancelled by donor');
      toast.success(`"${cancelTarget.foodName}" has been cancelled.`);
      setCancelTarget(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not cancel this donation.'));
      setCancelTarget(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const canCancel = (d) =>
    ['AVAILABLE', 'ACCEPTED', 'PICKUP_ASSIGNED'].includes(d.status);
  const canEdit = (d) => d.status === 'AVAILABLE' && !isPast(d.safeConsumptionDeadline);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 m-0">My Donations</h2>
          {summary ? (
            <p className="text-sm text-slate-500 m-0">
              {summary.total} total · {summary.AVAILABLE} available · {summary.COMPLETED} completed
            </p>
          ) : null}
        </div>
        <Link to="/donor/donations/new" className="btn btn-primary no-underline">
          <PlusCircle size={17} /> Add New Donation
        </Link>
      </div>

      {/* Status filter */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 px-1">Filter:</span>
        {[['', 'All'], ['AVAILABLE', 'Available'], ['ACCEPTED', 'Accepted'], ['PICKUP_ASSIGNED', 'Pickup assigned'], ['COLLECTED', 'Collected'], ['DISTRIBUTED', 'Distributed'], ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled'], ['REJECTED', 'Rejected']].map(
          ([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              className={`btn btn-sm ${statusFilter === value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          )
        )}
      </div>

      {loading ? (
        <LoadingBlock label="Loading your donations…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : donations.length === 0 ? (
        <EmptyState
          icon={<HandHeart size={28} />}
          title={statusFilter ? 'No donations with this status' : 'You have not created any donations yet'}
          description={statusFilter ? 'Try a different status filter.' : 'Register your surplus food so NGOs can find it.'}
          action={
            statusFilter ? null : (
              <Link to="/donor/donations/new" className="btn btn-primary no-underline">
                <PlusCircle size={17} /> Add New Donation
              </Link>
            )
          }
        />
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Food</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>City</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d._id}>
                  <td className="font-semibold text-slate-800">
                    {d.foodName}
                    {d.isExpired ? <span className="badge badge-danger ml-2">Expired</span> : null}
                  </td>
                  <td>{d.category}</td>
                  <td>{d.quantity} {d.unit}</td>
                  <td>{d.city}</td>
                  <td className="text-sm text-slate-500">{formatDateTime(d.safeConsumptionDeadline)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="text-sm text-slate-500">{formatDateTime(d.statusUpdatedAt || d.updatedAt || d.createdAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <Link to={`/donations/${d._id}`} className="btn btn-sm btn-outline no-underline" title="View details">
                        <Eye size={14} />
                      </Link>
                      <Link
                        to={`/donor/donations/${d._id}/edit`}
                        className={`btn btn-sm btn-outline no-underline ${canEdit(d) ? '' : 'opacity-40 pointer-events-none'}`}
                        title={canEdit(d) ? 'Edit donation' : 'Only available donations can be edited'}
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        type="button"
                        className={`btn btn-sm btn-outline ${canCancel(d) ? 'text-danger' : 'opacity-40'}`}
                        disabled={!canCancel(d)}
                        onClick={() => setCancelTarget(d)}
                        title={canCancel(d) ? 'Cancel donation' : 'This donation can no longer be cancelled'}
                      >
                        <XCircle size={14} />
                      </button>
                      <Link to={`/donations/${d._id}`} className="btn btn-sm btn-outline no-underline" title="View status history">
                        <History size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this donation?"
        message={
          cancelTarget
            ? `"${cancelTarget.foodName}" will stop being visible to NGOs and any open pickup task will be closed. This cannot be undone.`
            : ''
        }
        confirmLabel={busy ? 'Cancelling…' : 'Cancel donation'}
        cancelLabel="Keep donation"
        busy={busy}
        onConfirm={cancelDonation}
        onCancel={() => setCancelTarget(null)}
      />

      {busy ? <Spinner small label="" /> : null}
    </div>
  );
}