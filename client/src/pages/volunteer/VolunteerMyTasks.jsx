import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, ClipboardList, PackageCheck, MapPin, Clock, NotebookPen } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { LoadingBlock, EmptyState, ErrorNotice, Spinner } from '../../components/ui';
import { volunteerAPI, getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, formatQuantity } from '../../utils/format';

/**
 * Volunteer: my assigned tasks with status buttons.
 * ASSIGNED -> confirm collection -> CONFIRM (as NGO) uses COLLECTED -> confirm delivery.
 */
export default function VolunteerMyTasks() {
  const toast = useToast();

  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [demoOnly, setDemoOnly] = useState('ALL');

  // Dialog state: { type: 'collect' | 'deliver', task }
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await volunteerAPI.myTasks({ page, limit: 10 });
      setTasks(res.data.tasks);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your tasks.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const openAction = (type, task) => {
    setNote('');
    setAction({ type, task });
  };

  const submitAction = async () => {
    if (!action || busy) return;
    setBusy(true);
    try {
      if (action.type === 'collect') {
        await volunteerAPI.collect(action.task._id, note);
        toast.success('Collection confirmed — the NGO and donor were notified.');
      } else {
        await volunteerAPI.deliver(action.task._id, note);
        toast.success('Delivery confirmed — waiting for the NGO to confirm the distribution.');
      }
      setAction(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the task status.'));
      setAction(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const visibleTasks = tasks.filter((t) => (demoOnly === 'ALL' ? true : t.status === demoOnly));

  const nextStepFor = (status) => {
    switch (status) {
      case 'ASSIGNED':
        return { label: 'Confirm collection', type: 'collect', icon: PackageCheck };
      case 'COLLECTED':
        return { label: 'Confirm delivery', type: 'deliver', icon: MapPin };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 m-0">My Assignments</h2>
        <p className="text-sm text-slate-500 m-0">
          Tasks assigned to you only — other volunteers cannot see or update them.
        </p>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 px-1">Filter:</span>
        {[['ALL', 'All'], ['ASSIGNED', 'Assigned'], ['COLLECTED', 'Collected'], ['DELIVERED', 'Delivered'], ['CONFIRMED', 'Confirmed']].map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm ${demoOnly === value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setDemoOnly(value)}
            >
              {label}
            </button>
          )
        )}
      </div>

      {loading ? (
        <LoadingBlock label="Loading your tasks…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="No tasks in this view"
          description={
            demoOnly === 'ALL'
              ? 'Accept an open pickup task and it will appear here with its status buttons.'
              : 'No tasks currently have this status.'
          }
          action={
            <Link to="/volunteer/tasks" className="btn btn-primary no-underline">
              <Bike size={17} /> Browse available tasks
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleTasks.map((task) => {
            const d = task.donation;
            const step = nextStepFor(task.status);
            const finished = ['DELIVERED', 'CONFIRMED'].includes(task.status);

            return (
              <div key={task._id} className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 m-0">{d?.foodName || 'Food pickup'}</h3>
                      <StatusBadge status={task.status} kind="pickup" />
                      {d?.status ? <StatusBadge status={d.status} /> : null}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 m-0">
                      {d ? `${d.category} · ${formatQuantity(d.quantity, d.unit)} · deadline ${formatDateTime(d.safeConsumptionDeadline)}` : 'Donation details unavailable'}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-sm text-slate-600">
                  <p className="flex items-start gap-2 m-0">
                    <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                    <span><strong className="text-slate-800">Pickup:</strong> {task.pickupAddress}</span>
                  </p>
                  <p className="flex items-start gap-2 m-0">
                    <MapPin size={15} className="text-accent shrink-0 mt-0.5" />
                    <span><strong className="text-slate-800">Delivery:</strong> {task.deliveryAddress}</span>
                  </p>
                  {task.scheduledPickupTime ? (
                    <p className="flex items-center gap-2 m-0">
                      <Clock size={15} className="text-primary" />
                      Scheduled: {formatDateTime(task.scheduledPickupTime)}
                    </p>
                  ) : null}
                  <p className="flex items-center gap-2 m-0">
                    <Clock size={15} className="text-slate-400" />
                    Assigned: {formatDateTime(task.assignmentDate)}
                  </p>
                  {task.collectedAt ? (
                    <p className="flex items-center gap-2 m-0 text-green-700">
                      <PackageCheck size={15} />
                      Collected: {formatDateTime(task.collectedAt)}
                    </p>
                  ) : null}
                  {task.deliveredAt ? (
                    <p className="flex items-center gap-2 m-0 text-green-700">
                      <MapPin size={15} />
                      Delivered: {formatDateTime(task.deliveredAt)}
                    </p>
                  ) : null}
                </div>

                {task.notes ? (
                  <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5">
                    <NotebookPen size={14} className="shrink-0 mt-0.5 text-amber-500" />
                    <span>Notes: {task.notes}</span>
                  </p>
                ) : null}
                {task.deliveryNotes ? (
                  <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                    <NotebookPen size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                    <span>Delivery note: {task.deliveryNotes}</span>
                  </p>
                ) : null}

                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 flex-wrap">
                  <Link to={`/donations/${task.donationId}`} className="link no-underline text-sm">
                    View donation details
                  </Link>
                  <div className="flex gap-2">
                    {step ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => openAction(step.type, task)}>
                        <step.icon size={15} /> {step.label}
                      </button>
                    ) : null}
                    {finished ? (
                      <span className="badge badge-success">
                        {task.status === 'CONFIRMED' ? 'Distribution confirmed' : 'Delivered — awaiting NGO confirmation'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} />

      {/* Collect / deliver dialog */}
      {action ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3 className="text-lg font-bold text-slate-900 m-0">
              {action.type === 'collect' ? 'Confirm food collection' : 'Confirm delivery'}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {action.type === 'collect'
                ? 'Confirm only after you physically collected the food from the donor. The timestamp is recorded.'
                : 'Confirm only after you handed the food to the NGO or distribution point.'}
            </p>
            <div className="mt-4">
              <label className="field-label" htmlFor="taskNote">
                {action.type === 'collect' ? 'Collection notes (optional)' : 'Delivery notes (optional)'}
              </label>
              <textarea
                id="taskNote"
                className="textarea"
                placeholder={
                  action.type === 'collect'
                    ? 'e.g. Picked up in 3 sealed containers at 6:10 PM'
                    : 'e.g. Handed over to the kitchen in-charge, 6:45 PM'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn btn-outline" onClick={() => setAction(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={submitAction} disabled={busy}>
                {busy ? 'Saving…' : action.type === 'collect' ? 'Confirm collection' : 'Confirm delivery'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {busy ? <Spinner small label="" /> : null}
    </div>
  );
}