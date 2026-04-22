import { NavLink } from 'react-router-dom';
import { Home, Calendar, Trophy, User, Newspaper } from 'lucide-react';

const navItems = [
  { to: '/portal', label: 'Home', icon: Home, end: true },
  { to: '/portal/tee-sheet', label: 'Tee Sheet', icon: Calendar },
  { to: '/portal/competitions', label: 'Comps', icon: Trophy },
  { to: '/portal/news', label: 'News', icon: Newspaper },
  { to: '/portal/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom">
      <div className="flex items-stretch max-w-screen-sm mx-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-[var(--club-primary,#16a34a)]'
                  : 'text-gray-500'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
