import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AdminLayout } from './components/layout/AdminLayout';
import { MemberLayout } from './components/layout/MemberLayout';
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminMembers } from './pages/admin/Members';
import { AdminTeeSheet } from './pages/admin/TeeSheet';
import { AdminCompetitions, AdminCompetitionDetail } from './pages/admin/Competitions';
import { AdminBilling } from './pages/admin/Billing';
import { AdminCommunications } from './pages/admin/Communications';
import { AdminSettings } from './pages/admin/Settings';
import { MemberHome } from './pages/member/Home';
import { MemberTeeSheet } from './pages/member/TeeSheet';
import { MemberCompetitions } from './pages/member/Competitions';
import { MemberProfile } from './pages/member/Profile';
import { MemberNews } from './pages/member/News';
import { Login, AuthCallback } from './pages/auth/Login';
import { MobileScorecard } from './pages/score/MobileScorecard';
import { ClubSetup } from './pages/onboarding/ClubSetup';
import { PageSpinner } from './components/ui/Spinner';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (!['admin', 'super_admin', 'comp_admin'].includes(profile.role)) return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

function MemberGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/score/:entryId" element={<MobileScorecard />} />

        {/* Onboarding */}
        <Route path="/setup" element={<MemberGuard><ClubSetup /></MemberGuard>} />

        {/* Admin */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="members" element={<AdminMembers />} />
          <Route path="tee-sheet" element={<AdminTeeSheet />} />
          <Route path="competitions" element={<AdminCompetitions />} />
          <Route path="competitions/:id" element={<AdminCompetitionDetail />} />
          <Route path="billing" element={<AdminBilling />} />
          <Route path="communications" element={<AdminCommunications />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Member Portal */}
        <Route path="/portal" element={<MemberGuard><MemberLayout /></MemberGuard>}>
          <Route index element={<MemberHome />} />
          <Route path="tee-sheet" element={<MemberTeeSheet />} />
          <Route path="competitions" element={<MemberCompetitions />} />
          <Route path="profile" element={<MemberProfile />} />
          <Route path="news" element={<MemberNews />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
