import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HandHeart,
  Search,
  Truck,
  Users,
  Building2,
  Bike,
  ArrowRight,
  Leaf,
  Recycle,
  ShieldCheck,
  MapPin,
  UtensilsCrossed,
  Sprout,
  HeartHandshake,
} from 'lucide-react';
import { statsAPI, getApiErrorMessage } from '../services/api';

const STEPS = [
  { icon: HandHeart, title: 'Donate surplus food', text: 'Households, restaurants, canteens and event organisers register their surplus food with quantity and a safe-consumption deadline.' },
  { icon: Search, title: 'Connect with an NGO', text: 'Verified NGOs browse available donations by category, city and deadline, then accept the ones they can distribute.' },
  { icon: Truck, title: 'Arrange pickup', text: 'The NGO requests a volunteer. The volunteer accepts the task, collects the food and records the collection time.' },
  { icon: Users, title: 'Distribute food', text: 'The food is delivered to the distribution point, the NGO confirms the handover and the donation is marked completed.' },
];

const ROLES = [
  {
    icon: HandHeart,
    tone: 'green',
    title: 'Food Donors',
    text: 'Households, restaurants, hotels, hostels, canteens, caterers and event organisers can register surplus food in under a minute.',
    link: '/register?role=DONOR',
    cta: 'Donate food',
  },
  {
    icon: Building2,
    tone: 'blue',
    title: 'NGOs',
    text: 'Organisations discover suitable donations, accept them, request volunteers and confirm every distribution transparently.',
    link: '/register?role=NGO',
    cta: 'Register NGO',
  },
  {
    icon: Bike,
    tone: 'amber',
    title: 'Volunteers',
    text: 'Pick up food from donors and deliver it to NGOs, updating collection and delivery status from your own dashboard.',
    link: '/register?role=VOLUNTEER',
    cta: 'Volunteer now',
  },
];

/** Landing page: hero, live statistics, workflow, role cards, impact, community. */
export default function Home() {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let active = true;
    statsAPI
      .public()
      .then((res) => {
        if (active) setStats(res.data.stats);
      })
      .catch((error) => {
        if (active) setStatsError(getApiErrorMessage(error, 'Statistics are unavailable right now.'));
      });
    return () => {
      active = false;
    };
  }, []);

  // Zeros while loading/failed — numbers are never invented.
  const statCards = [
    { label: 'Total donations', value: stats?.totalDonations ?? 0, icon: HandHeart, tone: 'green' },
    { label: 'Donations completed', value: stats?.completedDonations ?? 0, icon: ShieldCheck, tone: 'blue' },
    { label: 'Registered NGOs', value: stats?.registeredNgos ?? 0, icon: Building2, tone: 'amber' },
    { label: 'Active volunteers', value: stats?.activeVolunteers ?? 0, icon: Bike, tone: 'red' },
  ];

  const tones = {
    green: { background: '#fff0e6', color: '#c2410c' },
    blue: { background: '#e7f1ff', color: '#0d6efd' },
    amber: { background: '#fff4e5', color: '#b45309' },
    red: { background: '#fdecec', color: '#b02a37' },
  };

  return (
    <>
      {/* ------------------------------- Hero ------------------------------- */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-soft via-white to-accent-soft" aria-hidden="true" />
        <div className="shell relative py-16 md:py-24 grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <span className="eyebrow">Community Food Donation &amp; Distribution System</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mt-3">
              Share Food. Reduce Waste.{' '}
              <span className="text-primary-dark">Feed Communities.</span>
            </h1>
            <p className="text-slate-600 text-lg leading-relaxed mt-5 max-w-xl">
              Every day, edible surplus food is thrown away while people nearby go hungry. This platform
              connects households, restaurants and organisations that have surplus food with NGOs and
              volunteers who can collect and distribute it to people in need — with a transparent status
              trail from donation to delivery.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link to="/register?role=DONOR" className="btn btn-primary btn-lg no-underline">
                <HandHeart size={18} /> Donate Food
              </Link>
              <Link to="/donations" className="btn btn-outline-primary btn-lg no-underline">
                <Search size={18} /> Find Food Donations
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Leaf size={15} className="text-primary" /> Free &amp; open-source</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-primary" /> Role-based access</span>
              <span className="flex items-center gap-1.5"><Recycle size={15} className="text-primary" /> Full status tracking</span>
            </div>
          </div>

          {/* Workflow preview card (decorative process diagram, not statistics) */}
          <div className="card p-5 md:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Donation journey</p>
            <ol className="list-none p-0 m-0 space-y-3">
              {[
                ['Donor registers surplus food', 'AVAILABLE'],
                ['NGO verifies & accepts', 'ACCEPTED'],
                ['Volunteer assigned & picks up', 'COLLECTED'],
                ['Delivered to distribution point', 'DISTRIBUTED'],
                ['NGO confirms → completed', 'COMPLETED'],
              ].map(([label, status], idx) => (
                <li key={status} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-slate-700 font-medium flex-1">{label}</span>
                  <span className="badge badge-neutral hidden sm:inline-flex">{status}</span>
                </li>
              ))}
            </ol>
            <hr className="divider" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1.5"><MapPin size={15} className="text-primary" /> Address-based pickup, city-level matching</span>
              <Link to="/how-it-works" className="link no-underline flex items-center gap-1">
                Full workflow <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- Statistics ---------------------------- */}
      <section className="section">
        <div className="shell">
          <div className="text-center max-w-2xl mx-auto">
            <span className="eyebrow">Platform statistics</span>
            <h2 className="section-title mt-2">Numbers from the community</h2>
            <p className="muted mt-3">
              These counters are calculated live from the database — no estimated or fabricated impact figures.
            </p>
          </div>

          {statsError ? (
            <div className="alert alert-warning mt-6 text-center" role="status">
              {statsError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-8">
            {statCards.map((s) => (
              <div key={s.label} className="stat-card">
                <span className="stat-icon" style={tones[s.tone]}>
                  <s.icon size={20} />
                </span>
                <div>
                  <p className="text-3xl font-extrabold text-slate-900 leading-none">
                    {stats ? s.value.toLocaleString('en-IN') : '—'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- How it works --------------------------- */}
      <section className="section bg-white border-y border-line">
        <div className="shell">
          <div className="max-w-2xl">
            <span className="eyebrow">How it works</span>
            <h2 className="section-title mt-2">Four simple steps from surplus to service</h2>
            <p className="muted mt-3">Each step is recorded in the system, so everyone can see exactly where a donation stands.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mt-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="card card-hover p-5 relative">
                <span className="absolute top-4 right-4 text-3xl font-extrabold text-slate-100">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="stat-icon mb-3" style={{ background: '#fff0e6', color: '#c2410c' }}>
                  <step.icon size={20} />
                </span>
                <h3 className="text-base font-bold text-slate-900 m-0">{step.title}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Role cards --------------------------- */}
      <section className="section">
        <div className="shell">
          <div className="text-center max-w-2xl mx-auto">
            <span className="eyebrow">Who can participate</span>
            <h2 className="section-title mt-2">A role for everyone in the community</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3 mt-8">
            {ROLES.map((role) => (
              <div key={role.title} className="card card-hover p-6 flex flex-col">
                <span className="stat-icon mb-4" style={tones[role.tone]}>
                  <role.icon size={22} />
                </span>
                <h3 className="text-lg font-bold text-slate-900 m-0">{role.title}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed flex-1">{role.text}</p>
                <Link to={role.link} className="btn btn-outline-primary no-underline mt-5">
                  {role.cta} <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Impact ------------------------------ */}
      <section className="section bg-white border-y border-line">
        <div className="shell grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <span className="eyebrow">Why it matters</span>
            <h2 className="section-title mt-2">The impact of redirecting surplus food</h2>
            <p className="muted mt-4 leading-relaxed">
              Food that reaches a distribution point instead of a bin reduces waste, saves the resources
              used to produce it, and gives people dependable access to a meal. The project is designed
              around measurable coordination: every handover has a timestamp, an owner and a status.
            </p>
            <ul className="mt-5 space-y-3 list-none p-0">
              {[
                ['Less waste', 'Surplus meals are redirected before their deadline instead of being discarded.'],
                ['Faster coordination', 'Donors, NGOs and volunteers share one status trail instead of phone calls.'],
                ['Accountability', 'Immutable history records who changed each donation status and when.'],
                ['Safety first', 'Expired listings are hidden and cannot be accepted by any NGO.'],
              ].map(([title, text]) => (
                <li key={title} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-soft text-primary-dark flex items-center justify-center shrink-0 mt-0.5">
                    <Sprout size={14} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800 m-0">{title}</p>
                    <p className="text-sm text-slate-600 m-0">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: UtensilsCrossed, title: 'Quantity distributed', value: stats ? `${stats.quantityDistributed ?? 0} units` : '—', hint: 'Sum of completed donations' },
              { icon: Recycle, title: 'Pickups coordinated', value: stats ? (stats.totalPickups ?? 0).toLocaleString('en-IN') : '—', hint: 'Volunteer pickup tasks created' },
              { icon: HeartHandshake, title: 'Donors on board', value: stats ? (stats.totalDonors ?? 0).toLocaleString('en-IN') : '—', hint: 'Registered donor accounts' },
              { icon: Search, title: 'Open right now', value: stats ? (stats.availableDonations ?? 0).toLocaleString('en-IN') : '—', hint: 'Donations awaiting an NGO' },
            ].map((item) => (
              <div key={item.title} className="card p-5">
                <item.icon size={20} className="text-primary" />
                <p className="text-2xl font-extrabold text-slate-900 mt-3 mb-0">{item.value}</p>
                <p className="text-sm font-semibold text-slate-700 m-0">{item.title}</p>
                <p className="text-xs text-slate-400 m-0 mt-1">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------- Community / CTA ------------------------- */}
      <section className="section">
        <div className="shell">
          <div className="card p-8 md:p-10 text-center bg-gradient-to-br from-primary to-primary-dark border-0 text-white">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 mb-4">
              <HeartHandshake size={28} />
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold m-0">Join the food-sharing community</h2>
            <p className="text-white/85 max-w-2xl mx-auto mt-3 leading-relaxed">
              Whether you have surplus food to give, an organisation that distributes it, or an hour to
              lend as a volunteer — your participation keeps edible food out of bins and on plates.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Link to="/register" className="btn btn-lg no-underline bg-white text-primary-dark hover:bg-slate-100">
                Create a free account
              </Link>
              <Link to="/donations" className="btn btn-lg no-underline btn-outline text-white border-white/60 hover:bg-white/10">
                Browse donations
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}