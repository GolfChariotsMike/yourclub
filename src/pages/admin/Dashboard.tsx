import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Trophy, AlertCircle, UserPlus, Flag, Megaphone, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { StatCard, Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, MemberStatusBadge, CompStatusBadge } from '../../components/ui/Badge';
import type { DashboardStats, Competition, Invoice, Booking, Member } from '../../types';

export function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingComps, setUpcomingComps] = useState<Competition[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<(Invoice & { member: Member })[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.club_id) fetchDashboard(profile.club_id);
  }, [profile?.club_id]);

  async function fetchDashboard(clubId: string) {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const in30 = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd');
    const weekEnd = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd');

    const [membersRes, expiringRes, compsWeekRes, overdueRes, upcomingCompsRes, todayBookingsRes] = await Promise.all([
      supabase.from('members').select('id, status', { count: 'exact' }).eq('club_id', clubId).eq('status', 'active'),
      supabase.from('members').select('id', { count: 'exact' }).eq('club_id', clubId).gte('renewal_date', today).lte('renewal_date', in30),
      supabase.from('competitions').select('id', { count: 'exact' }).eq('club_id', clubId).gte('date', today).lte('date', weekEnd),
      supabase.from('invoices').select('*, member:members(first_name, last_name, email)').eq('club_id', clubId).eq('status', 'overdue').limit(5),
      supabase.from('competitions').select('*, course:courses(name)').eq('club_id', clubId).gte('date', today).order('date').limit(5),
      supabase.from('bookings').select('*, slot:tee_time_slots(date, time), players:booking_players(*, member:members(first_name, last_name))').eq('club_id', clubId).is('cancelled_at', null).limit(20),
    ]);

    const overdueAmount = (overdueRes.data ?? []).reduce((sum: number, inv: Invoice) => sum + inv.amount, 0);

    setStats({
      total_members: membersRes.count ?? 0,
      active_members: membersRes.count ?? 0,
      expiring_members: expiringRes.count ?? 0,
      comps_this_week: compsWeekRes.count ?? 0,
      outstanding_invoices: overdueRes.data?.length ?? 0,
      outstanding_amount: overdueAmount,
    });

    setOverdueInvoices(overdueRes.data ?? []);
    setUpcomingComps(upcomingCompsRes.data ?? []);

    // Filter today's bookings
    const todayBks = (todayBookingsRes.data ?? []).filter((b: Booking) => {
      const slot = b.slot as TeeTimeSlot | undefined;
      return slot?.date === today;
    });
    setTodayBookings(todayBks);
    setLoading(false);
  }

  if (!profile?.club_id) return (<div className="p-6 flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Members"
          value={loading ? '...' : (stats?.total_members ?? 0)}
          icon={<Users className="w-5 h-5" />}
          color="green"
          onClick={() => navigate('/admin/members')}
        />
        <StatCard
          label="Expiring (30 days)"
          value={loading ? '...' : (stats?.expiring_members ?? 0)}
          icon={<AlertCircle className="w-5 h-5" />}
          color="amber"
          onClick={() => navigate('/admin/members?filter=expiring')}
        />
        <StatCard
          label="Comps This Week"
          value={loading ? '...' : (stats?.comps_this_week ?? 0)}
          icon={<Trophy className="w-5 h-5" />}
          color="blue"
          onClick={() => navigate('/admin/competitions')}
        />
        <StatCard
          label="Overdue Payments"
          value={loading ? '...' : `$${stats?.outstanding_amount?.toFixed(0) ?? 0}`}
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
          onClick={() => navigate('/admin/billing')}
          trend={stats?.outstanding_invoices ? `${stats.outstanding_invoices} invoice${stats.outstanding_invoices > 1 ? 's' : ''}` : undefined}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => navigate('/admin/members?action=add')}>
            Add Member
          </Button>
          <Button variant="secondary" icon={<Trophy className="w-4 h-4" />} onClick={() => navigate('/admin/competitions?action=new')}>
            New Competition
          </Button>
          <Button variant="secondary" icon={<Megaphone className="w-4 h-4" />} onClick={() => navigate('/admin/communications?action=post')}>
            Post Announcement
          </Button>
          <Button variant="secondary" icon={<Calendar className="w-4 h-4" />} onClick={() => navigate('/admin/tee-sheet')}>
            Manage Tee Sheet
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Tee Sheet */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Today's Tee Sheet</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tee-sheet')}>View All</Button>
          </div>
          {todayBookings.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No bookings today
            </div>
          ) : (
            <div className="space-y-2">
              {todayBookings.slice(0, 8).map((booking) => {
                const slot = booking.slot as { time: string } | undefined;
                const players = booking.players as { member?: { first_name: string; last_name: string }; guest_name?: string }[] | undefined;
                return (
                  <div key={booking.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                        {slot?.time?.slice(0, 5) ?? '--:--'}
                      </div>
                      <div className="text-sm text-gray-700">
                        {players?.map(p =>
                          p.member ? `${p.member.first_name} ${p.member.last_name}` : p.guest_name
                        ).join(', ')}
                      </div>
                    </div>
                    <Badge>{players?.length ?? 0} players</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Upcoming Competitions */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Upcoming Competitions</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/competitions')}>View All</Button>
          </div>
          {upcomingComps.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No upcoming competitions
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingComps.map(comp => (
                <div
                  key={comp.id}
                  className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded"
                  onClick={() => navigate(`/admin/competitions/${comp.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{comp.name}</p>
                    <p className="text-xs text-gray-500">{format(new Date(comp.date), 'EEE d MMM')} · {comp.format}</p>
                  </div>
                  <CompStatusBadge status={comp.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Overdue Payments */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Overdue Payments</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/billing')}>View All</Button>
          </div>
          {overdueInvoices.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No overdue payments
            </div>
          ) : (
            <div className="space-y-2">
              {overdueInvoices.map((inv) => {
                const member = inv.member as Member | undefined;
                return (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {member ? `${member.first_name} ${member.last_name}` : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">Due {inv.due_date ? format(new Date(inv.due_date), 'd MMM yyyy') : 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-red-600">${inv.amount.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Needed for type narrowing above
interface TeeTimeSlot { date: string; time: string; }
