import { Link } from 'react-router-dom';
import {
  Target,
  AlertTriangle,
  Globe2,
  Building2,
  Users,
  Leaf,
  Recycle,
  HandHeart,
  ArrowRight,
} from 'lucide-react';

const OBJECTIVES = [
  'Reduce edible food wastage by connecting surplus generators with organisations that distribute food.',
  'Give donors a simple, one-minute way to register surplus food with accurate timing information.',
  'Help NGOs discover suitable donations quickly and coordinate pickups without phone tag.',
  'Provide volunteers with clear pickup and delivery tasks and status buttons.',
  'Record every status change so the whole chain is transparent and accountable.',
  'Prevent expired or unsafe listings from being presented as eligible for distribution.',
];

const SDGS = [
  {
    code: 'SDG 2',
    title: 'Zero Hunger',
    icon: HandHeart,
    color: '#DDA63A',
    text: 'The project aims to move surplus food towards people who need regular access to meals.',
  },
  {
    code: 'SDG 11',
    title: 'Sustainable Cities and Communities',
    icon: Building2,
    color: '#FD9D24',
    text: 'Local, address-based redistribution keeps community support networks resilient and close to home.',
  },
  {
    code: 'SDG 12',
    title: 'Responsible Consumption and Production',
    icon: Recycle,
    color: '#BF8B2E',
    text: 'Extending the useful life of produced food is a direct application of responsible consumption.',
  },
];

/** About page: background, problem, mission, objectives, impact goals, SDG alignment. */
export default function About() {
  return (
    <>
      {/* Header */}
      <section className="bg-white border-b border-line">
        <div className="shell py-14 max-w-3xl">
          <span className="eyebrow">About us</span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">
            A community platform against food wastage
          </h1>
          <p className="text-slate-600 mt-4 leading-relaxed">
            FoodShare Community is a B.Tech Computer Science Engineering Community Service Project that
            builds a working full-stack system for coordinating surplus food redistribution in local
            communities.
          </p>
        </div>
      </section>

      {/* Background + problem */}
      <section className="section">
        <div className="shell grid gap-8 lg:grid-cols-2">
          <div className="card p-6">
            <span className="stat-icon mb-4" style={{ background: '#fff0e6', color: '#c2410c' }}>
              <Target size={20} />
            </span>
            <h2 className="text-xl font-bold text-slate-900 m-0">Project background</h2>
            <div className="prose-grid mt-3 text-sm">
              <p>
                Food is wasted at every stage of the supply chain — and a large share of it is edible food
                discarded by households, restaurants, hostels, canteens and events shortly after
                preparation. At the same time, NGOs and community kitchens work every day to serve meals
                to people in need, often struggling to find usable surplus at the right time and place.
              </p>
              <p>
                The problem is rarely a shortage of good intentions; it is a coordination gap. Donors do
                not know which NGO can collect, NGOs do not see what is available, and volunteers have no
                shared record of pickups. This project closes that gap with a single platform where
                surplus is registered, offered, accepted, collected and confirmed with a visible audit
                trail.
              </p>
            </div>
          </div>

          <div className="card p-6">
            <span className="stat-icon mb-4" style={{ background: '#fdecec', color: '#b02a37' }}>
              <AlertTriangle size={20} />
            </span>
            <h2 className="text-xl font-bold text-slate-900 m-0">The problem of food wastage</h2>
            <div className="prose-grid mt-3 text-sm">
              <p>
                Large volumes of cooked and packaged food are discarded while still fit for consumption,
                simply because no timely channel exists to move it. Waste also carries an environmental
                cost — water, energy and land already spent on producing the food.
              </p>
              <p>
                Meanwhile, community organisations face unpredictable supply: one day there is more than
                they can handle, another day nothing is available. Without visibility into what exists,
                where it is, and by when it must be consumed, coordination remains informal and
                unreliable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission + objectives */}
      <section className="section bg-white border-y border-line">
        <div className="shell grid gap-8 lg:grid-cols-2">
          <div>
            <span className="eyebrow">Our mission</span>
            <h2 className="section-title mt-2">What this project sets out to do</h2>
            <p className="muted mt-4 leading-relaxed">
              Improve coordination, transparency, accessibility and accountability in community food
              redistribution — reducing wastage by connecting people and organisations with surplus food
              to NGOs and volunteers who can collect and distribute it to people in need.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              {['Coordination', 'Transparency', 'Accessibility', 'Accountability'].map((t) => (
                <span key={t} className="badge badge-success">{t}</span>
              ))}
            </div>
            <Link to="/register" className="btn btn-primary no-underline mt-6">
              Take part <ArrowRight size={16} />
            </Link>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900 m-0">Project objectives</h3>
            <ol className="mt-4 space-y-3 pl-5 text-sm text-slate-700">
              {OBJECTIVES.map((o) => (
                <li key={o} className="leading-relaxed">{o}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Community impact */}
      <section className="section">
        <div className="shell">
          <div className="text-center max-w-2xl mx-auto">
            <span className="eyebrow">Community impact</span>
            <h2 className="section-title mt-2">What the platform is designed to achieve</h2>
            <p className="alert alert-info mt-5">
              These are the goals and intended outcomes of the project — measured indicators will only be
              reported from actual platform data, not as proven claims.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-8">
            {[
              { icon: Leaf, title: 'Less food waste', text: 'Surplus is redirected before its safe-consumption deadline instead of being discarded.' },
              { icon: Users, title: 'Stronger local networks', text: 'Donors, NGOs and volunteers coordinate in one place with shared status visibility.' },
              { icon: Globe2, title: 'Responsible communities', text: 'Redistribution aligns daily community action with global sustainability goals.' },
              { icon: Building2, title: 'Verified organisations', text: 'Administrator verification keeps NGO participation accountable.' },
              { icon: Recycle, title: 'Traceable distribution', text: 'Every status change is timestamped and attributable in the history log.' },
              { icon: HandHeart, title: 'Safe handling', text: 'Deadlines, storage information and food-safety notices are part of every listing.' },
            ].map((item) => (
              <div key={item.title} className="card card-hover p-5">
                <span className="stat-icon mb-3" style={{ background: '#e7f1ff', color: '#0d6efd' }}>
                  <item.icon size={20} />
                </span>
                <h3 className="text-base font-bold text-slate-900 m-0">{item.title}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sustainability goals */}
      <section className="section bg-white border-t border-line">
        <div className="shell">
          <div className="text-center max-w-2xl mx-auto">
            <span className="eyebrow">Sustainability goals</span>
            <h2 className="section-title mt-2">Aligned with the UN Sustainable Development Goals</h2>
            <p className="muted mt-3">
              The project contributes to the following goals. This alignment describes the project's
              design intent, not audited outcomes.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3 mt-8">
            {SDGS.map((sdg) => (
              <div key={sdg.code} className="card card-hover p-6 border-t-4" style={{ borderTopColor: sdg.color }}>
                <span className="stat-icon mb-3" style={{ background: `${sdg.color}22`, color: sdg.color }}>
                  <sdg.icon size={20} />
                </span>
                <span className="badge badge-neutral">{sdg.code}</span>
                <h3 className="text-base font-bold text-slate-900 mt-2 m-0">{sdg.title}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{sdg.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}