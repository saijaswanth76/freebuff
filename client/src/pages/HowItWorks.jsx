import { Link } from 'react-router-dom';
import {
  HandHeart,
  ClipboardCheck,
  Search,
  Handshake,
  Bike,
  PackageCheck,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

const STEPS = [
  {
    icon: HandHeart,
    title: 'Register surplus food',
    who: 'Donor',
    text: 'The donor describes the food, quantity, pickup address and — critically — the safe-consumption deadline. A food-safety notice reminds donors that only food fit for consumption may be listed.',
    status: 'AVAILABLE',
  },
  {
    icon: ClipboardCheck,
    title: 'Verification',
    who: 'Admin / System',
    text: 'Input validation checks every field, and administrators can reject unsuitable listings. Expired listings are automatically hidden and can no longer be accepted.',
    status: 'AVAILABLE → REJECTED',
  },
  {
    icon: Handshake,
    title: 'NGO accepts the donation',
    who: 'NGO',
    text: 'NGOs browse available donations with filters and accept the ones they can handle. The backend guarantees only one NGO can win the acceptance.',
    status: 'ACCEPTED',
  },
  {
    icon: Search,
    title: 'Request a volunteer',
    who: 'NGO',
    text: 'The NGO opens a pickup task (open for any volunteer) or assigns a specific volunteer directly. Pickup and delivery addresses are recorded.',
    status: 'PICKUP_ASSIGNED',
  },
  {
    icon: Bike,
    title: 'Food collection',
    who: 'Volunteer',
    text: 'The volunteer accepts the task, picks up the food from the donor and presses "Confirm collection". The collection time is stored.',
    status: 'COLLECTED',
  },
  {
    icon: PackageCheck,
    title: 'Delivery to the NGO',
    who: 'Volunteer',
    text: 'The volunteer delivers the food to the distribution point, adds delivery notes and confirms the delivery.',
    status: 'DISTRIBUTED',
  },
  {
    icon: CheckCircle2,
    title: 'Confirm distribution',
    who: 'NGO',
    text: 'The NGO verifies the handover and confirms the distribution, moving the donation to its final state.',
    status: 'COMPLETED',
  },
  {
    icon: ShieldCheck,
    title: 'Full audit trail',
    who: 'Everyone',
    text: 'Donors see the updated status, NGOs track their distributions, volunteers keep their task history, and administrators inspect the complete history of every donation.',
    status: 'History logged',
  },
];

/** Step-by-step workflow page with statuses and role responsibilities. */
export default function HowItWorks() {
  return (
    <>
      <section className="bg-white border-b border-line">
        <div className="shell py-14 max-w-3xl">
          <span className="eyebrow">How it works</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">
            From surplus food to a served meal
          </h1>
          <p className="text-slate-600 mt-4 leading-relaxed">
            Every donation follows the same lifecycle. Each transition below maps to a validated backend
            endpoint — invalid jumps (for example confirming a delivery before collection) are rejected by
            the server.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link to="/register?role=DONOR" className="btn btn-primary no-underline">Donate food</Link>
            <Link to="/donations" className="btn btn-outline no-underline">See available donations</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <ol className="list-none p-0 m-0 grid gap-5 md:grid-cols-2">
            {STEPS.map((step, idx) => (
              <li key={step.title} className="card p-5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <span className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold">
                      {idx + 1}
                    </span>
                    {idx < STEPS.length - 1 ? (
                      <span className="hidden md:block w-px flex-1 bg-line mt-2" aria-hidden="true" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 m-0">{step.title}</h3>
                      <span className="badge badge-neutral">{step.who}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{step.text}</p>
                    <p className="mt-3">
                      <span className="badge badge-success">{step.status}</span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Status legend */}
          <div className="card p-6 mt-8">
            <h2 className="text-lg font-bold text-slate-900 m-0">Donation status legend</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
              {[
                ['AVAILABLE', 'Listed and visible to NGOs', 'badge-available'],
                ['ACCEPTED', 'Claimed by one NGO', 'badge-accepted'],
                ['PICKUP_ASSIGNED', 'A volunteer has the task', 'badge-assigned'],
                ['COLLECTED', 'Food collected from donor', 'badge-collected'],
                ['DISTRIBUTED', 'Delivered to the NGO', 'badge-progress'],
                ['COMPLETED', 'Distribution confirmed', 'badge-completed'],
                ['CANCELLED', 'Withdrawn by the donor', 'badge-cancelled'],
                ['REJECTED', 'Rejected as unsuitable', 'badge-rejected'],
              ].map(([label, text, cls]) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span className={`badge ${cls} shrink-0`}>{label}</span>
                  <span className="text-xs text-slate-500">{text}</span>
                </div>
              ))}
            </div>
            <hr className="divider" />
            <p className="text-sm text-slate-500 m-0">
              Roles: <strong>Donors</strong> create and cancel donations · <strong>NGOs</strong> accept,
              request volunteers and confirm distributions · <strong>Volunteers</strong> accept tasks and
              confirm collection/delivery · <strong>Administrators</strong> verify users and monitor the
              entire platform.
            </p>
          </div>

          <div className="text-center mt-10">
            <Link to="/register" className="btn btn-primary btn-lg no-underline">
              Get started <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}