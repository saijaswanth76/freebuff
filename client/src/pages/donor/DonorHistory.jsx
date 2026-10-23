import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, ShieldCheck } from 'lucide-react';
import Pagination from '../../components/Pagination';
import { LoadingBlock, ErrorNotice, EmptyState } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import { donationsAPI, getApiErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';

/**
 * Donor: donation history. Lists every donation (newest first) — completed,
 * cancelled and rejected records stay visible for transparency.
 */
export default function DonorHistory() {
  const [donations, setDonations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    donationsAPI
      .my({ page, limit: 10, sort: 'newest' })
      .then((res) => {
        if (!active) return;
        setDonations(res.data.donations);
        setPagination(res.data.pagination);
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, 'Could not load your history.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page]);

  const pastStatuses = new Set(['COMPLETED', 'CANCELLED', 'REJECTED']);
  const historyRows = donations.filter((d) => pastStatuses.has(d.status));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 m-0">Donation History</h2>
        <p className="text-sm text-slate-500 m-0">
          Every donation you have ever registered, including its final outcome.
        </p>
      </div>

      {loading ? (
        <LoadingBlock label="Loading history…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={() => setPage(1)} />
      ) : historyRows.length === 0 ? (
        <EmptyState
          icon={<History size={28} />}
          title="No completed donations yet"
          description="Finished, cancelled and rejected donations will be archived here automatically."
          action={
            <Link to="/donor/donations" className="btn btn-outline no-underline">
              View my active donations
            </Link>
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
                <th>Registered</th>
                <th>Last updated</th>
                <th>Outcome</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((d) => (
                <tr key={d._id}>
                  <td className="font-semibold text-slate-800">{d.foodName}</td>
                  <td>{d.quantity} {d.unit}</td>
                  <td>{d.city}</td>
                  <td className="text-sm text-slate-500">{formatDateTime(d.createdAt)}</td>
                  <td className="text-sm text-slate-500">{formatDateTime(d.statusUpdatedAt || d.updatedAt)}</td>
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

      <div className="alert alert-info flex gap-2">
        <ShieldCheck size={17} className="shrink-0 mt-0.5" />
        <p className="m-0 text-sm">
          Each status change is stored with a timestamp and the responsible user — open any donation to see
          its complete audit trail.
        </p>
      </div>
    </div>
  );
}