import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { Competition, CompetitionEntry, CompetitionResult, Scorecard, Member } from '../../types';

export function MemberCompetitions() {
  const { profile } = useAuth();
  const [upcoming, setUpcoming] = useState<Competition[]>([]);
  const [past, setPast] = useState<(Competition & { myEntry?: CompetitionEntry & { result?: CompetitionResult; scorecard?: Scorecard } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'results'>('upcoming');

  useEffect(() => {
    if (profile?.club_id && profile?.member_id) fetchData();
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    const [upRes, pastRes] = await Promise.all([
      supabase.from('competitions').select('*').eq('club_id', profile!.club_id!).gte('date', today).in('status', ['draft', 'entries_open', 'in_progress']).order('date').limit(10),
      supabase.from('competitions').select(`
        *,
        entries:competition_entries!inner(
          *,
          scorecard:scorecards(*),
          result:competition_results(*)
        )
      `).eq('club_id', profile!.club_id!).lt('date', today).eq('competition_entries.member_id', profile!.member_id!).order('date', { ascending: false }).limit(20),
    ]);

    setUpcoming(upRes.data ?? []);

    const pastComps = (pastRes.data ?? []).map((comp: Competition & { entries: CompetitionEntry[] }) => ({
      ...comp,
      myEntry: comp.entries?.[0],
    }));
    setPast(pastComps);
    setLoading(false);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Competitions</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {['upcoming', 'results'].map(t => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${tab === t ? 'border-[var(--club-primary,#16a34a)] text-[var(--club-primary,#16a34a)]' : 'border-transparent text-gray-500'}`}
            onClick={() => setTab(t as typeof tab)}
          >
            {t === 'upcoming' ? 'Upcoming' : 'My Results'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--club-primary,#16a34a)]" /></div>
      ) : tab === 'upcoming' ? (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No upcoming competitions</div>
          ) : upcoming.map(comp => (
            <Card key={comp.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{comp.name}</p>
                  <p className="text-sm text-gray-500">{format(new Date(comp.date), 'EEEE d MMMM yyyy')}</p>
                  <p className="text-sm text-gray-400 capitalize">{comp.format} · {comp.handicap_allowance_pct}% allowance</p>
                </div>
                <Badge variant={comp.status === 'entries_open' ? 'success' : 'gray'}>{comp.status.replace('_', ' ')}</Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {past.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No competition history yet</div>
          ) : past.map(comp => {
            const entry = comp.myEntry;
            const sc = Array.isArray(entry?.scorecard) ? entry?.scorecard?.[0] : entry?.scorecard;
            const result = Array.isArray(entry?.result) ? entry?.result?.[0] : entry?.result;
            return (
              <Card key={comp.id} className="border-l-4 border-l-[var(--club-primary,#16a34a)]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{comp.name}</p>
                    <p className="text-sm text-gray-500">{format(new Date(comp.date), 'EEE d MMM yyyy')}</p>
                    {entry?.division && <span className="text-xs text-gray-400">{entry.division} Grade</span>}
                  </div>
                  {result && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--club-primary,#16a34a)]">
                        {comp.format === 'stableford' ? `${(sc as Scorecard | undefined)?.total_points ?? '?'} pts` : `Net ${(sc as Scorecard | undefined)?.total_net ?? '?'}`}
                      </p>
                      {result.points_position && (
                        <p className="text-xs text-gray-500">
                          {result.points_position === 1 ? '🥇' : result.points_position === 2 ? '🥈' : result.points_position === 3 ? '🥉' : `${result.points_position}th`}
                          {result.division ? ` ${result.division} Grade` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {sc && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
                    {(sc as Scorecard | undefined)?.total_gross && <span>Gross: {(sc as Scorecard).total_gross}</span>}
                    {(sc as Scorecard | undefined)?.total_net && <span>Net: {(sc as Scorecard).total_net}</span>}
                    {(sc as Scorecard | undefined)?.total_points !== undefined && <span>Points: {(sc as Scorecard).total_points}</span>}
                    {result?.prize_description && <span className="text-purple-600 font-medium">{result.prize_description}</span>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
