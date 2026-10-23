import { Link } from 'react-router-dom';
import { MapPin, Clock, Boxes, Eye, Leaf, UtensilsCrossed } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatQuantity, timeLeft, isPast } from '../utils/format';

/**
 * Donation card used by the public "Available Donations" page and the NGO
 * browse page. It only renders fields that the API returned for the current
 * viewer - private donor details never reach this component for anonymous users.
 */
export default function DonationCard({ donation, action = null, footer = null }) {
  const expired = donation.isExpired || isPast(donation.safeConsumptionDeadline);

  return (
    <article className="card card-hover overflow-hidden flex flex-col">
      <div className="h-28 bg-gradient-to-br from-primary-soft to-accent-soft flex items-center justify-between px-4">
        <span className="w-12 h-12 rounded-xl bg-white/85 text-primary-dark flex items-center justify-center">
          {donation.category === 'Cooked Meals' || donation.category === 'Bakery Products' ? (
            <UtensilsCrossed size={22} />
          ) : (
            <Leaf size={22} />
          )}
        </span>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={donation.status} />
          {expired ? <span className="badge badge-danger">Expired</span> : null}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 leading-snug m-0">{donation.foodName}</h3>
          <span className="badge badge-neutral shrink-0">{donation.category}</span>
        </div>

        {donation.description ? (
          <p className="text-sm text-slate-600 m-0 line-clamp-2">{donation.description}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-1.5 text-sm text-slate-600 mt-1">
          <p className="flex items-center gap-2 m-0">
            <Boxes size={15} className="text-primary" />
            <strong className="text-slate-800">{formatQuantity(donation.quantity, donation.unit)}</strong>
            {donation.foodClassification ? (
              <span className="text-xs text-slate-400">
                {donation.foodClassification === 'VEG' ? 'Vegetarian' : donation.foodClassification === 'NON_VEG' ? 'Non-vegetarian' : 'Veg + Non-veg'}
              </span>
            ) : null}
          </p>
          <p className="flex items-center gap-2 m-0">
            <MapPin size={15} className="text-primary" />
            {donation.city}
            {donation.locationDescription ? <span className="text-xs text-slate-400 truncate">· {donation.locationDescription}</span> : null}
          </p>
          <p className="flex items-center gap-2 m-0">
            <Clock size={15} className={expired ? 'text-red-500' : 'text-primary'} />
            <span className={expired ? 'text-red-600 font-semibold' : ''}>
              {expired ? 'Deadline passed' : `Safe until ${timeLeft(donation.safeConsumptionDeadline)}`}
            </span>
          </p>
        </div>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-line">
          <span className="text-xs text-slate-400">
            {donation.availableFrom ? `From ${new Date(donation.availableFrom).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Available now'}
          </span>
          {action || (
            <Link to={`/donations/${donation._id}`} className="btn btn-sm btn-outline-primary no-underline">
              <Eye size={15} /> View details
            </Link>
          )}
        </div>
        {footer}
      </div>
    </article>
  );
}
