import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../hooks/useAuth';
import { useClub } from '../../hooks/useClub';
import { PageSpinner } from '../ui/Spinner';

export function MemberLayout() {
  const { profile, loading } = useAuth();
  const { club } = useClub(profile?.club_id);

  if (loading) return <PageSpinner />;
  if (!profile) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Club header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-sm mx-auto px-4 py-3 flex items-center gap-3">
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: club?.primary_colour ?? '#16a34a' }}
            >
              {club?.name?.[0] ?? 'C'}
            </div>
          )}
          <p className="font-semibold text-gray-900 text-sm">{club?.name ?? 'Golf Club'}</p>
        </div>
      </header>

      <main className="max-w-screen-sm mx-auto">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
