import { Link } from 'react-router-dom';
import { Leaf, Mail, Phone, MapPin } from 'lucide-react';

/** Public footer with navigation and contact information. */
export default function Footer() {
  return (
    <footer className="bg-white border-t border-line mt-auto">
      <div className="shell py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
              <Leaf size={19} />
            </span>
            <span className="font-extrabold text-slate-900">FoodShare Community</span>
          </div>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            A community platform that connects people and organisations with surplus food to NGOs and
            volunteers who can distribute it to people in need.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm list-none p-0 m-0">
            {[
              { to: '/', label: 'Home' },
              { to: '/about', label: 'About Us' },
              { to: '/how-it-works', label: 'How It Works' },
              { to: '/donations', label: 'Available Donations' },
            ].map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-slate-600 hover:text-primary-dark no-underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Participate</h4>
          <ul className="mt-3 space-y-2 text-sm list-none p-0 m-0">
            <li>
              <Link to="/register?role=DONOR" className="text-slate-600 hover:text-primary-dark no-underline">
                Donate surplus food
              </Link>
            </li>
            <li>
              <Link to="/register?role=NGO" className="text-slate-600 hover:text-primary-dark no-underline">
                Register your NGO
              </Link>
            </li>
            <li>
              <Link to="/register?role=VOLUNTEER" className="text-slate-600 hover:text-primary-dark no-underline">
                Volunteer for pickups
              </Link>
            </li>
            <li>
              <Link to="/login" className="text-slate-600 hover:text-primary-dark no-underline">
                Sign in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm list-none p-0 m-0 text-slate-600">
            <li className="flex items-center gap-2">
              <Mail size={15} className="text-primary" /> support@foodshare.community
            </li>
            <li className="flex items-center gap-2">
              <Phone size={15} className="text-primary" /> +91 9848016636
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={15} className="text-primary" /> Food donation community Benz Circle,Vijayawada.
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="shell py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p className="m-0">
            © {new Date().getFullYear()} FoodShare Community
          </p>
          <p className="m-0">Aligned with SDG 2 · SDG 11 · SDG 12</p>
        </div>
      </div>
    </footer>
  );
}
