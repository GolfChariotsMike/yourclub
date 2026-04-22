import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useClub } from '../../hooks/useClub';

export function AdminLayout() {
  const { profile } = useAuth();
  const { club } = useClub(profile?.club_id);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar club={club} />
      <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
