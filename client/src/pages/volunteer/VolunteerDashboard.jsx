import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Handshake, PackageCheck, ClipboardList, MapPin, ArrowRight } from 'lucide-react';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { LoadingBlock, ErrorNotice, EmptyState } from '../../components/ui';
import { volunteerAPI, getApiErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';

/** Volunteer dashboard: open tasks, my assignments, completed deliveries. */
export default function VolunteerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await volunteerAPI.dashboard();
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading your volunteer dashboard…" />;
  if (error) return <ErrorNotice message={error} onRetry={load} />;

  const s = data.stats;

  return (
    <div className="space-y-6">
      <div className="card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 m-0">Ready to pick up food?</h2>
          <p className="text-sm text-slate-500 m-0">Open tasks are shared by every NGO on the platform — accept one to get started.</p>
        </div>
        <Link to="/volunteer/tasks" className="btn btn-primary no-underline">
          <Bike size={17} /> View Available Tasks
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Handshake} label="Available pickup tasks" value={s.availablePickupTasks} tone="blue" hint="Open for any volunteer" />
        <StatCard icon={ClipboardList} label="My active tasks" value={s.assignedTasks} tone="amber" />
        <StatCard icon={Bike} label="Pending pickups" value={s.pendingPickups} tone="red" />
        <StatCard icon={PackageCheck} label="Completed deliveries" value={s.completedDeliveries} tone="green" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/volunteer/tasks" className="btn btn-outline-primary no-underline">
          <Bike size={17} /> Available pickup tasks
        </Link>
        <Link to="/volunteer/my-tasks" className="btn btn-outline no-underline">
          <ClipboardList size={17} /> My task history
        </Link>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900 m-0">Recent tasks</h2>
          <Link to="/volunteer/my-tasks" className="link no-underline text-sm flex items-center gap-1">
            Open my assignments <ArrowRight size={15} />
          </Link>
        </div>

        {data.recentTasks.length === 0 ? (
          <EmptyState
            icon={<Bike size={28} />}
            title="No tasks yet"
            description="When you accept a pickup task it appears here with its status buttons."
            action={
              <Link to="/volunteer/tasks" className="btn btn-primary no-underline">
                <Bike size={17} /> Find a pickup task
              </Link>
            }
          />
        ) : (
          <div className="table-shell mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Pickup city</th>
                  <th>Task status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTasks.map((t) => (
                  <tr key={t._id}>
                    <td className="font-semibold text-slate-800">{t.donation?.foodName || '—'}</td>
                    <td className="text-sm">{t.pickupAddress}</td>
                    <td><StatusBadge status={t.status} kind="pickup" /></td>
                    <td className="text-sm text-slate-500">{formatDateTime(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-bold text-slate-900 m-0 mb-3">Your workflow</h2>
        <ol className="list-none p-0 m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            ['Accept an eligible task', 'Only open tasks can be claimed'],
            ['Confirm collection', 'Records when you picked up the food'],
            ['Confirm delivery', 'Marks the food as delivered to the NGO'],
            ['NGO completes it', 'Distribution confirmed → donation completed'],
          ].map(([title, text], idx) => (
            <li key={title} className="flex gap-2.5">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800 m-0">{title}</p>
                <p className="text-xs text-slate-500 m-0">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
          <MapPin size={14} className="text-primary" />
          Locations are address-based in this version (GPS tracking is a listed future enhancement).
        </div>
      </div>
    </div>
  );
}