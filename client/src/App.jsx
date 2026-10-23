import { Routes, Route, Navigate } from 'react-router-dom';

/* Layouts & guards */
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ProtectedRoute, PublicOnly } from './components/guards';
import { HOME_BY_ROLE } from './context/AuthContext';

/* Public pages */
import Home from './pages/Home';
import About from './pages/About';
import HowItWorks from './pages/HowItWorks';
import AvailableDonations from './pages/AvailableDonations';
import DonationDetail from './pages/DonationDetail';
import Login from './pages/Login';
import Register from './pages/Register';

/* Donor pages */
import DonorDashboard from './pages/donor/DonorDashboard';
import MyDonations from './pages/donor/MyDonations';
import AddDonation from './pages/donor/AddDonation';
import EditDonation from './pages/donor/EditDonation';
import DonorHistory from './pages/donor/DonorHistory';

/* NGO pages */
import NgoDashboard from './pages/ngo/NgoDashboard';
import NgoBrowse from './pages/ngo/NgoBrowse';
import NgoAccepted from './pages/ngo/NgoAccepted';
import NgoHistory from './pages/ngo/NgoHistory';

/* Volunteer pages */
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard';
import VolunteerTasks from './pages/volunteer/VolunteerTasks';
import VolunteerMyTasks from './pages/volunteer/VolunteerMyTasks';

/* Admin pages */
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDonations from './pages/admin/AdminDonations';
import AdminReports from './pages/admin/AdminReports';

import { HandHeart, Handshake, Bike, ShieldCheck } from 'lucide-react';

/** Sidebar definitions per role (used by the shared DashboardLayout). */
const donorLinks = [
  { to: '/donor', label: 'Dashboard', icon: HandHeart, end: true },
  { to: '/donor/donations/new', label: 'Add Donation', icon: HandHeart },
  { to: '/donor/donations', label: 'My Donations', icon: Handshake },
  { to: '/donor/history', label: 'Donation History', icon: ShieldCheck },
];

const ngoLinks = [
  { to: '/ngo', label: 'Dashboard', icon: Handshake, end: true },
  { to: '/ngo/browse', label: 'Browse Donations', icon: Handshake },
  { to: '/ngo/accepted', label: 'Accepted Donations', icon: Bike },
  { to: '/ngo/history', label: 'Distribution History', icon: ShieldCheck },
];

const volunteerLinks = [
  { to: '/volunteer', label: 'Dashboard', icon: Bike, end: true },
  { to: '/volunteer/tasks', label: 'Available Tasks', icon: Handshake },
  { to: '/volunteer/my-tasks', label: 'My Assignments', icon: ShieldCheck },
];

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: ShieldCheck, end: true },
  { to: '/admin/users', label: 'User Management', icon: Handshake },
  { to: '/admin/donations', label: 'Donations', icon: HandHeart },
  { to: '/admin/reports', label: 'Reports & Charts', icon: Bike },
];

export default function App() {
  return (
    <Routes>
      {/* ------------------------------ Public ------------------------------ */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/donations" element={<AvailableDonations />} />
        <Route path="/donations/:id" element={<DonationDetail />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <Register />
            </PublicOnly>
          }
        />
      </Route>

      {/* ------------------------------- Donor ------------------------------ */}
      <Route
        path="/donor"
        element={
          <ProtectedRoute roles={['DONOR']}>
            <DashboardLayout
              title="Donor Dashboard"
              subtitle="Register surplus food, track its status and manage your donation history."
              links={donorLinks}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<DonorDashboard />} />
        <Route path="donations/new" element={<AddDonation />} />
        <Route path="donations" element={<MyDonations />} />
        <Route path="donations/:id/edit" element={<EditDonation />} />
        <Route path="history" element={<DonorHistory />} />
      </Route>

      {/* -------------------------------- NGO ------------------------------- */}
      <Route
        path="/ngo"
        element={
          <ProtectedRoute roles={['NGO']}>
            <DashboardLayout
              title="NGO Dashboard"
              subtitle="Find surplus food, coordinate pickups and confirm distributions."
              links={ngoLinks}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<NgoDashboard />} />
        <Route path="browse" element={<NgoBrowse />} />
        <Route path="accepted" element={<NgoAccepted />} />
        <Route path="history" element={<NgoHistory />} />
      </Route>

      {/* ----------------------------- Volunteer ---------------------------- */}
      <Route
        path="/volunteer"
        element={
          <ProtectedRoute roles={['VOLUNTEER']}>
            <DashboardLayout
              title="Volunteer Dashboard"
              subtitle="Accept pickup tasks, confirm collection and delivery, and track your activity."
              links={volunteerLinks}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<VolunteerDashboard />} />
        <Route path="tasks" element={<VolunteerTasks />} />
        <Route path="my-tasks" element={<VolunteerMyTasks />} />
      </Route>

      {/* ------------------------------ Admin ------------------------------- */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <DashboardLayout
              title="Administrator Dashboard"
              subtitle="Monitor users, donations and platform activity across the whole system."
              links={adminLinks}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="donations" element={<AdminDonations />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>

      {/* ------------------------------- Fallback --------------------------- */}
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}