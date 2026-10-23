import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck, Smile } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import { LoadingBlock, ErrorNotice, EmptyState } from '../../components/ui';
import { ngoAPI, getApiErrorMessage } from '../../services/api';
import { formatDateTime, formatDate } from '../../utils/format';

const HISTORY_STATUSES = ['COMPLETED', 'DISTRIBUTED'];
const ALL_TIME = ['COMPLETED', 'DISTRIBUTED', 'CANCELLED', 'REJECTED'];

/** NGO: distribution history (completed first, optionally including closed/cancelled). */
export default function NgoHistory() {
  const [donations, setDonations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [statuses, setStatuses] = useState('COMPLETED,DISTRIBUTED');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The backend accepts a single status per request; we fetch the primary
      // history status here and keep the filter simple for students to follow.
      const res = await ngoAPI.accepted({
        page,
        limit: 10,
        ...(statuses === 'COMPLETED,DISTRIBUTED' ? { status: 'COMPLETED' } : statuses === 'ALL' ? {} : { status: statuses }),
      });
      const rows = statuses === 'ALL'
        ? res.data.donations.filter((d) => ALL_TIME.includes(d.status))
        : statuses === 'COMPLETED,DISTRIBUTED'
          ? res.data.donations.filter((d) => HISTORY_STATUSES.includes(d.status))
          : res.data.donations;
      setDonations(rows);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load distribution history.'));
    } finally {
      setLoading(false);
    }
  }, [page, statuses]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = donations.filter((d) => d.status === 'COMPLETED');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 m-0">Distribution History</h2>
          <p className="text-sm text-slate-500 m-0">Completed and closed donations handled by your NGO.</p>
        </div>
        <select
          className="select"
          value={statuses}
          onChange={(e) => {
            setStatuses(e.target.value);
            setPage(1);
          }}
          aria-label="History filter"
        >
          <option value="COMPLETED,DISTRIBUTED">Active + completed</option>
          <option value="COMPLETED">Completed only</option>
          <option value="ALL">All closed records</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock label="Loading distribution history…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : donations.length === 0 ? (
        <EmptyState
          icon={<PackageCheck size={28} />}
          title="No distributions yet"
          description="Once a volunteer delivers food and you confirm the handover, the record appears here."
          action={
            <Link to="/ngo/browse" className="btn btn-primary no-underline">Browse Donations</Link>
          }
        />
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Food</th>
                <th>Quantity</th>
                <th>City</th>
                <th>Donor registered</th>
                <th>Last updated</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d._id}>
                  <td className="font-semibold text-slate-800">{d.foodName}</td>
                  <td>{d.quantity} {d.unit}</td>
                  <td>{d.city}</td>
                  <td className="text-sm text-slate-500">{formatDate(d.createdAt)}</td>
                  <td className="text-sm text-slate-500">{formatDateTime(d.statusUpdatedAt)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>
                    <Link to={`/donations/${d._id}`} className="link no-underline text-sm">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} />

      <div className="alert alert-success flex gap-2 items-center">
        <Smile size={17} className="shrink-0" />
        <p className="m-0 text-sm">
          {totals.length > 0
            ? `${totals.length} completed distribution${totals.length === 1 ? '' : 's'} on this page — thank you for coordinating the handover.`
            : 'Completed distributions will be summarised here.'}
        </p>
      </div>
    </div>
  );
}