import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Trophy, CreditCard,
  MessageSquare, Settings, LogOut
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Club } from '../../types';

// Fallback icon since lucide might not have GolfIcon
function ClubIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/tee-sheet', label: 'Tee Sheet', icon: Calendar },
  { to: '/admin/competitions', label: 'Competitions', icon: Trophy },
  { to: '/admin/billing', label: 'Billing', icon: CreditCard },
  { to: '/admin/communications', label: 'Communications', icon: MessageSquare },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  club?: Club | null;
}

export function Sidebar({ club }: SidebarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        {club?.logo_url ? (
          <img src={club.logo_url} alt={club.name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--club-primary,#16a34a)] flex items-center justify-center">
            <ClubIcon />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{club?.name ?? 'YourClub'}</p>
          <p className="text-xs text-gray-400">Admin Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--club-primary,#16a34a)] text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
