import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Trophy, TrendingDown, TrendingUp, Minus, ArrowRight, Newspaper } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import type { Member, MemberAccount, Competition, NoticeboardPost, Booking } from '../../types';

export function MemberHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [account, setAccount] = useState<MemberAccount | null>(null);
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [upcomingComps, setUpcomingComps] = useState<Competition[]>([]);
  const [latestPost, setLatestPost] = useState<NoticeboardPost | null>(null);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    if (profile?.member_id && profile?.club_id) {
      fetchData();
    }
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const [memberRes, accountRes, bookingRes, compsRes, newsRes] = await Promise.all([
      supabase.from('members').select('*').eq('id', profile!.member_id!).single(),
      supabase.from('member_accounts').select('*').eq('member_id', profile!.member_id!).single(),
      supabase.from('bookings')
        .select('*, slot:tee_time_slots(date, time), players:booking_players(member:members(first_name, last_name), guest_name)')
        .eq('booked_by_member_id', profile!.member_id!)
        .is('cancelled_at', null)
        .gte('created_at', today)
        .order('created_at')
        .limit(1),
      supabase.from('competitions')
        .select('*')
        .eq('club_id', profile!.club_id!)
        .gte('date', today)
        .in('status', ['entries_open', 'draft'])
        .order('date')
        .limit(3),
      supabase.from('noticeboard_posts')
        .select('*')
        .eq('club_id', profile!.club_id!)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    setMember(memberRes.data);
    setAccount(accountRes.data);
    setNextBooking(bookingRes.data?.[0] ?? null);
    setUpcomingComps(compsRes.data ?? []);
    setLatestPost(newsRes.data);
    setLoading(false);
  }

  if (loading) return <div className="p-4 flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--club-primary,#16a34a)]" /></div>;

  return (
    <div className="p-4 space-y-4">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-gray-900">{greeting}, {member?.first_name ?? 'there'} 👋</h1>
        {member?.status === 'suspended' && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700 font-medium">Your membership is currently suspended. Contact the club to resolve.</p>
          </div>
        )}
      </div>

      {/* Handicap card */}
      <Card className="bg-gradient-to-br from-[var(--club-primary,#16a34a)] to-[#14532d] text-white border-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Handicap Index</p>
            <p className="text-4xl font-bold">{member?.handicap?.toFixed(1) ?? '—'}</p>
            {member?.handicap_updated_at && (
              <p className="text-xs opacity-70 mt-1">Updated {format(new Date(member.handicap_updated_at), 'd MMM yyyy')}</p>
            )}
          </div>
          <div className="text-right">
            <TrendingDown className="w-8 h-8 opacity-40" />
          </div>
        </div>
      </Card>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-blue-50 border-blue-100">
          <p className="text-xs text-blue-600 font-medium">Credit Balance</p>
          <p className="text-2xl font-bold text-blue-800">${(account?.credit_balance ?? 0).toFixed(2)}</p>
          <p className="text-xs text-blue-500 mt-1">For bookings</p>
          <button className="text-xs text-blue-700 font-medium mt-2 hover:underline">Top Up →</button>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <p className="text-xs text-purple-600 font-medium">Prize Balance</p>
          <p className="text-2xl font-bold text-purple-800">${(account?.prize_balance ?? 0).toFixed(2)}</p>
          <p className="text-xs text-purple-500 mt-1">Shop credits</p>
        </Card>
      </div>

      {/* Next booking */}
      <Card onClick={() => navigate('/portal/tee-sheet')}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-medium">Next Booking</p>
            {nextBooking ? (
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {(nextBooking.slot as { date: string; time: string } | undefined)?.time?.slice(0, 5)} · {(nextBooking.slot as { date: string; time: string } | undefined)?.date ? format(new Date((nextBooking.slot as { date: string }).date), 'EEE d MMM') : '—'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No upcoming bookings</p>
            )}
          </div>
          {!nextBooking && (
            <Button size="sm" variant="ghost" className="text-[var(--club-primary,#16a34a)]">Book Now</Button>
          )}
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </div>
      </Card>

      {/* Upcoming comps */}
      {upcomingComps.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Upcoming Competitions</p>
            <button className="text-xs text-[var(--club-primary,#16a34a)]" onClick={() => navigate('/portal/competitions')}>View all</button>
          </div>
          <div className="space-y-2">
            {upcomingComps.map(comp => (
              <div key={comp.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{comp.name}</p>
                  <p className="text-xs text-gray-400">{format(new Date(comp.date), 'EEE d MMM')} · {comp.format}</p>
                </div>
                <Trophy className="w-4 h-4 text-gray-300" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Latest news */}
      {latestPost && (
        <Card onClick={() => navigate('/portal/news')}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Newspaper className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-medium">Latest News</p>
              <p className="text-sm font-medium text-gray-900 truncate">{latestPost.title}</p>
              <p className="text-xs text-gray-400">{format(new Date(latestPost.published_at), 'd MMM yyyy')}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 mt-2" />
          </div>
        </Card>
      )}
    </div>
  );
}
