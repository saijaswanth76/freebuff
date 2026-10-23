import { useCallback, useEffect, useState } from 'react';
import { Bike, Handshake, MapPin, Clock, UtensilsCrossed } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { LoadingBlock, EmptyState, ErrorNotice } from '../../components/ui';
import { volunteerAPI, getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, formatQuantity, isPast } from '../../utils/format';

/**
 * Volunteer: available pickup tasks (OPEN tasks + quick accept).
 * Accepting is concurrency-safe on the backend — a lost race shows a 409 toast.
 */
export default function VolunteerTasks() {
  const toast = useToast();

  const [tasks, setTasks] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await volunteerAPI.tasks({ page, limit: 10 });
      // Show open tasks first: my assigned tasks live on "My Assignments".
      const openTasks = res.data.tasks.filter((t) => t.status === 'OPEN' && !t.volunteerId);
      setTasks(openTasks);
      setOpenCount(res.data.openCount);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load pickup tasks.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async () => {
    if (!acceptTarget || busy) return;
    setBusy(true);
    try {
      await volunteerAPI.acceptTask(acceptTarget._id);
      toast.success('Task accepted — it is now assigned to you. Open "My Assignments" to proceed.');
      setAcceptTarget(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not accept this task — it may already be taken.'));
      setAcceptTarget(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 m-0">Available pickup tasks</h2>
        <p className="text-sm text-slate-500 m-0">
          {openCount > 0
            ? `${openCount} task${openCount === 1 ? '' : 's'} waiting for a volunteer across the platform.`
            : 'All open tasks are currently claimed — check back soon.'}
        </p>
      </div>

      {loading ? (
        <LoadingBlock label="Loading pickup tasks…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<Bike size={28} />}
          title="No open pickup tasks right now"
          description="NGOs open pickup tasks when they accept a donation. You will see them here immediately."
        />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {tasks.map((task) => {
              const d = task.donation;
              const expired = task.donationExpired || (d?.safeConsumptionDeadline && isPast(d.safeConsumptionDeadline));
              return (
                <div key={task._id} className="card card-hover p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 m-0">{d?.foodName || 'Food pickup'}</h3>
                      <p className="text-sm text-slate-500 m-0">
                        {d ? `${d.category} · ${formatQuantity(d.quantity, d.unit)}` : 'Donation details unavailable'}
                      </p>
                    </div>
                    <StatusBadge status={task.status} kind="pickup" />
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                    <p className="flex items-start gap-2 m-0">
                      <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-800">Pick up:</strong> {task.pickupAddress}
                      </span>
                    </p>
                    <p className="flex items-start gap-2 m-0">
                      <MapPin size={15} className="text-accent shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-800">Deliver to:</strong> {task.deliveryAddress}
                      </span>
                    </p>
                    {task.scheduledPickupTime ? (
                      <p className="flex items-center gap-2 m-0">
                        <Clock size={15} className="text-primary" />
                        Scheduled pickup: {formatDateTime(task.scheduledPickupTime)}
                      </p>
                    ) : null}
                    {d?.storageInformation ? (
                      <p className="flex items-center gap-2 m-0 text-xs text-slate-500">
                        <UtensilsCrossed size={15} className="text-amber-500" />
                        Storage: {d.storageInformation}
                      </p>
                    ) : null}
                    {task.notes ? <p className="text-xs text-slate-500 m-0">Notes: {task.notes}</p> : null}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Assigned {formatDateTime(task.assignmentDate)}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setAcceptTarget(task)}
                      disabled={expired}
                    >
                      <Handshake size={15} /> {expired ? 'Donation expired' : 'Accept task'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination pagination={pagination} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(acceptTarget)}
        title="Accept this pickup task?"
        message={`You are committing to collect "${acceptTarget?.donation?.foodName || 'this food'}" from ${acceptTarget?.pickupAddress} and deliver it to ${acceptTarget?.deliveryAddress}.`}
        confirmLabel={busy ? 'Accepting…' : 'Accept task'}
        cancelLabel="Not now"
        danger={false}
        busy={busy}
        onConfirm={accept}
        onCancel={() => setAcceptTarget(null)}
      />
    </div>
  );
}