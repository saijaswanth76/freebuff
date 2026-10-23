import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Handshake, Bike, Search, PackageCheck, MapPin, User, XCircle } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import { LoadingBlock, EmptyState, ErrorNotice, Spinner } from '../../components/ui';
import { ngoAPI, getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, statusMeta } from '../../utils/format';

/** NGO: manage accepted donations — request volunteers and confirm distributions. */
export default function NgoAccepted() {
  const toast = useToast();

  const [donations, setDonations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Request-volunteer modal state
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestForm, setRequestForm] = useState({ scheduledPickupTime: '', notes: '' });
  // Confirm-distribution modal state
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [distributionNote, setDistributionNote] = useState('');
  // Release-volunteer state
  const [releaseTarget, setReleaseTarget] = useState(null);

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      const res = await ngoAPI.accepted(params);
      setDonations(res.data.donations);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load accepted donations.'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openRequest = (d) => {
    setRequestForm({ scheduledPickupTime: '', notes: '' });
    setRequestTarget(d);
  };

  const submitRequest = async () => {
    if (!requestTarget || busy) return;
    setBusy(true);
    try {
      const payload = {};
      if (requestForm.scheduledPickupTime) payload.scheduledPickupTime = new Date(requestForm.scheduledPickupTime).toISOString();
      if (requestForm.notes) payload.notes = requestForm.notes;
      await ngoAPI.requestVolunteer(requestTarget._id, payload);
      toast.success('Volunteer requested — the task is now open for volunteers.');
      setRequestTarget(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not request a volunteer.'));
      setRequestTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const submitConfirmation = async () => {
    if (!confirmTarget || busy) return;
    setBusy(true);
    try {
      await ngoAPI.confirmDistribution(confirmTarget._id, { distributionNote });
      toast.success('Distribution confirmed — the donation is now completed.');
      setConfirmTarget(null);
      setDistributionNote('');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not confirm the distribution.'));
      setConfirmTarget(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const submitRelease = async () => {
    if (!releaseTarget || busy) return;
    setBusy(true);
    try {
      await ngoAPI.releaseVolunteer(releaseTarget._id);
      toast.success('Volunteer assignment withdrawn — the pickup task is open again.');
      setReleaseTarget(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not withdraw the assignment.'));
      setReleaseTarget(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 m-0">Accepted Donations</h2>
        <p className="text-sm text-slate-500 m-0">
          Request a volunteer, follow pickup & delivery, then confirm the distribution.
        </p>
      </div>

      {/* Status filter */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 px-1">Filter:</span>
        {[['', 'All'], ['ACCEPTED', 'Accepted'], ['PICKUP_ASSIGNED', 'Pickup assigned'], ['COLLECTED', 'Collected'], ['DISTRIBUTED', 'Delivered'], ['COMPLETED', 'Completed']].map(
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
        <LoadingBlock label="Loading accepted donations…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : donations.length === 0 ? (
        <EmptyState
          icon={<Handshake size={28} />}
          title="No accepted donations match"
          description={statusFilter ? 'Try another status filter.' : 'Browse available donations and accept the ones your NGO can distribute.'}
          action={
            <Link to="/ngo/browse" className="btn btn-primary no-underline">
              <Search size={17} /> Browse Donations
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {donations.map((d) => {
            const pickup = d.pickup;
            const assigned = pickup && pickup.volunteerId;
            return (
              <div key={d._id} className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 m-0">{d.foodName}</h3>
                      <StatusBadge status={d.status} />
                      <span className="badge badge-neutral">{d.category}</span>
                      {d.isExpired ? <span className="badge badge-danger">Deadline passed</span> : null}
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5"><MapPin size={14} className="text-primary" /> {d.city}</span>
                      <span className="flex items-center gap-1.5"><Bike size={14} className="text-primary" /> {d.quantity} {d.unit}</span>
                      <span className="flex items-center gap-1.5">
                        <Handshake size={14} className="text-primary" /> Handover: {formatDateTime(d.statusUpdatedAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        Deadline: {formatDateTime(d.safeConsumptionDeadline)}
                      </span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Pickup: {d.pickupAddress}
                      {d.locationDescription ? ` (${d.locationDescription})` : ''}
                    </p>
                  </div>
                  <Link to={`/donations/${d._id}`} className="btn btn-sm btn-outline no-underline">
                    View details
                  </Link>
                </div>

                {/* Pickup dot-line */}
                <div className="flex items-center gap-2 mt-3 flex-wrap text-xs">
                  {['ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DISTRIBUTED', 'COMPLETED'].map((st, idx, arr) => {
                    const reached = arr.indexOf(d.status) >= idx;
                    return (
                      <span key={st} className="flex items-center gap-2">
                        <span className={`badge ${reached ? statusMeta(st).badge : 'badge-neutral'} ${reached ? '' : 'opacity-50'}`}>
                          {statusMeta(st).label}
                        </span>
                        {idx < arr.length - 1 ? <span className="w-4 h-px bg-line" /> : null}
                      </span>
                    );
                  })}
                </div>

                {/* Volunteer info + actions */}
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-slate-600 m-0 flex items-center gap-1.5">
                    <User size={15} className="text-primary" />
                    {assigned
                      ? `Volunteer: ${typeof pickup.volunteerId === 'object' ? pickup.volunteerId.name : 'Assigned'} · task ${statusMeta(pickup.status === 'OPEN' ? 'OPEN' : pickup.status, 'pickup').label}`
                      : pickup
                        ? 'Waiting for a volunteer to accept the pickup task'
                        : 'No pickup task yet'}
                    {pickup?.scheduledPickupTime ? ` · scheduled ${formatDateTime(pickup.scheduledPickupTime)}` : ''}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {d.status === 'ACCEPTED' && !pickup ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => openRequest(d)}>
                        <Bike size={15} /> Request Volunteer
                      </button>
                    ) : null}

                    {d.status === 'ACCEPTED' && pickup && !assigned ? (
                      <span className="btn btn-sm btn-outline" aria-disabled="true">
                        Waiting for a volunteer…
                      </span>
                    ) : null}

                    {d.status === 'PICKUP_ASSIGNED' ? (
                      <>
                        <span className="btn btn-sm btn-outline" aria-disabled="true">Volunteer assigned</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setReleaseTarget(d)}
                          title="Withdraw the assignment and reopen the task"
                        >
                          <XCircle size={15} /> Withdraw
                        </button>
                      </>
                    ) : null}

                    {d.status !== 'ACCEPTED' && d.status !== 'PICKUP_ASSIGNED' && assigned ? (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        {pickup.collectedAt ? `Collected ${formatDateTime(pickup.collectedAt)}` : ''}
                        {pickup.deliveredAt ? ` · Delivered ${formatDateTime(pickup.deliveredAt)}` : ''}
                      </span>
                    ) : null}

                    {d.status === 'DISTRIBUTED' ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => setConfirmTarget(d)}>
                        <PackageCheck size={15} /> Confirm Distribution
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} />

      {/* Request volunteer dialog (extended: pickup time + notes) */}
      {requestTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 m-0">Request a volunteer</h3>
                <p className="text-sm text-slate-600 mt-1 mb-0">{requestTarget.foodName} · {requestTarget.city}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="field-label" htmlFor="scheduledPickupTime">Scheduled pickup time (optional)</label>
                <input
                  id="scheduledPickupTime"
                  type="datetime-local"
                  className="input"
                  value={requestForm.scheduledPickupTime}
                  onChange={(e) => setRequestForm((f) => ({ ...f, scheduledPickupTime: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="requestNotes">Notes for the volunteer (optional)</label>
                <textarea
                  id="requestNotes"
                  className="textarea"
                  placeholder="e.g. Collect from the rear gate, ask for the kitchen in-charge"
                  value={requestForm.notes}
                  onChange={(e) => setRequestForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn btn-outline" onClick={() => setRequestTarget(null)} disabled={busy}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={submitRequest} disabled={busy}>
                {busy ? 'Requesting…' : 'Create pickup task'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm distribution dialog */}
      {confirmTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
          <h3 className="text-lg font-bold text-slate-900 m-0">Confirm distribution</h3>
          <p className="text-sm text-slate-600 mt-1">
            Confirm that "{confirmTarget?.foodName}" reached its recipients. This marks the donation as
            <strong> completed</strong>.
          </p>
          <div className="mt-4">
            <label className="field-label" htmlFor="distributionNote">Distribution note (optional)</label>
            <textarea
              id="distributionNote"
              className="textarea"
              placeholder="e.g. Distributed to 40 families at the community centre"
              value={distributionNote}
              onChange={(e) => setDistributionNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmTarget(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={submitConfirmation} disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm distribution'}
            </button>
          </div>
        </div>
      </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(releaseTarget)}
        title="Withdraw the volunteer assignment?"
        message="The pickup task will be cancelled and the donation returns to ACCEPTED so a new volunteer can be requested."
        confirmLabel={busy ? 'Withdrawing…' : 'Withdraw assignment'}
        cancelLabel="Keep assignment"
        busy={busy}
        onConfirm={submitRelease}
        onCancel={() => setReleaseTarget(null)}
      />

      {busy ? <Spinner small label="" /> : null}
    </div>
  );
}