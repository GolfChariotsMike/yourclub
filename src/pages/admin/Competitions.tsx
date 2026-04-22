import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trophy, ChevronRight, FileText, Users, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge, CompStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import type {
  Competition, CompetitionEntry, CompetitionFormat, CourseTee,
  Course, Scorecard, HoleScore, CompetitionResult, Member, DivisionConfig
} from '../../types';

export function AdminCompetitions() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    if (profile?.club_id) fetchCompetitions();
  }, [profile?.club_id]);

  async function fetchCompetitions() {
    setLoading(true);
    const { data } = await supabase
      .from('competitions')
      .select('*, course:courses(name), entry_count:competition_entries(count)')
      .eq('club_id', profile!.club_id!)
      .order('date', { ascending: false });
    setCompetitions(data ?? []);
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Competitions</h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowNewModal(true)}>New Competition</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--club-primary,#16a34a)]" />
        </div>
      ) : competitions.length === 0 ? (
        <Card className="text-center py-16">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No competitions yet</p>
          <Button className="mt-4" onClick={() => setShowNewModal(true)}>Create First Competition</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {competitions.map(comp => (
            <div
              key={comp.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all"
              onClick={() => navigate(`/admin/competitions/${comp.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{comp.name}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(comp.date), 'EEE d MMM yyyy')} · {comp.format} · {(comp.course as Course | undefined)?.name ?? 'No course'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {(comp as any).entry_count?.[0]?.count ?? 0} entries
                </div>
                <CompStatusBadge status={comp.status} />
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <CompetitionFormModal
          clubId={profile!.club_id!}
          onClose={() => setShowNewModal(false)}
          onSave={(id) => { setShowNewModal(false); fetchCompetitions(); navigate(`/admin/competitions/${id}`); }}
        />
      )}
    </div>
  );
}

// ─── Competition Detail Page ──────────────────────────────────────────────────
export function AdminCompetitionDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [comp, setComp] = useState<Competition | null>(null);
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'scores' | 'results'>('entries');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (id) fetchComp(id);
  }, [id]);

  async function fetchComp(compId: string) {
    setLoading(true);
    const [compRes, entriesRes, resultsRes] = await Promise.all([
      supabase.from('competitions').select('*, course:courses(*), course_tee:course_tees(*)').eq('id', compId).single(),
      supabase.from('competition_entries').select('*, member:members(first_name, last_name, handicap, golf_id), scorecard:scorecards(*)').eq('competition_id', compId).order('starting_time'),
      supabase.from('competition_results').select('*, entry:competition_entries(member:members(first_name, last_name))').eq('competition_id', compId).order('points_position'),
    ]);
    setComp(compRes.data);
    setEntries(entriesRes.data ?? []);
    setResults(resultsRes.data ?? []);
    setLoading(false);
  }

  async function calculateResults() {
    if (!comp) return;

    // Collect all scorecards
    const scoredEntries = entries.filter(e => {
      const sc = e.scorecard as Scorecard[] | Scorecard | null | undefined;
      const scorecard = Array.isArray(sc) ? sc[0] : sc;
      return scorecard && (scorecard.total_points !== null || scorecard.total_gross !== null);
    });

    if (scoredEntries.length === 0) { alert('No scores entered yet'); return; }

    // Sort by points (stableford) or net (stroke)
    const sorted = [...scoredEntries].sort((a, b) => {
      const getSc = (e: CompetitionEntry) => {
        const sc = e.scorecard as Scorecard[] | Scorecard | null | undefined;
        return Array.isArray(sc) ? sc[0] : sc;
      };
      const sca = getSc(a), scb = getSc(b);
      if (comp.format === 'stableford') return (scb?.total_points ?? 0) - (sca?.total_points ?? 0);
      return (sca?.total_net ?? 0) - (scb?.total_net ?? 0);
    });

    // Group by division if enabled
    const insertResults = [];
    if (comp.divisions_enabled) {
      const divGroups: Record<string, CompetitionEntry[]> = {};
      sorted.forEach(e => {
        const div = e.division ?? 'A';
        if (!divGroups[div]) divGroups[div] = [];
        divGroups[div].push(e);
      });
      for (const [div, divEntries] of Object.entries(divGroups)) {
        divEntries.forEach((e, i) => {
          const sc = Array.isArray(e.scorecard) ? (e.scorecard as Scorecard[])[0] : e.scorecard as Scorecard;
          insertResults.push({
            competition_id: comp.id,
            entry_id: e.id,
            club_id: comp.club_id,
            division: div,
            points_position: i + 1,
            gross_position: i + 1,
            net_position: i + 1,
          });
        });
      }
    } else {
      sorted.forEach((e, i) => {
        insertResults.push({
          competition_id: comp.id,
          entry_id: e.id,
          club_id: comp.club_id,
          points_position: i + 1,
          gross_position: i + 1,
          net_position: i + 1,
        });
      });
    }

    // Upsert results
    await supabase.from('competition_results').upsert(insertResults, { onConflict: 'competition_id,entry_id' });

    // Update comp status
    await supabase.from('competitions').update({ status: 'results_pending' }).eq('id', comp.id);
    await fetchComp(comp.id);
    setActiveTab('results');
  }

  async function publishResults() {
    if (!comp) return;
    setPublishing(true);
    await supabase.from('competitions').update({ status: 'finalised', results_published_at: new Date().toISOString() }).eq('id', comp.id);

    // Auto-post to noticeboard
    const top3 = results.slice(0, 3).map(r => {
      const entry = r.entry as CompetitionEntry & { member: Member } | undefined;
      const member = entry?.member;
      return `${r.points_position}. ${member ? `${member.first_name} ${member.last_name}` : 'Unknown'}`;
    }).join('\n');

    await supabase.from('noticeboard_posts').insert({
      club_id: comp.club_id,
      title: `Results: ${comp.name}`,
      body: `Competition results for ${comp.name} on ${format(new Date(comp.date), 'd MMMM yyyy')}.\n\n**Top Scores:**\n${top3}\n\nView full results in the competitions section.`,
      post_type: 'results',
      competition_id: comp.id,
    });

    await fetchComp(comp.id);
    setPublishing(false);
  }

  // Apply prize auto-payout
  async function applyPrizes() {
    if (!comp?.prize_template_id) { alert('No prize template set'); return; }
    const { data: template } = await supabase.from('prize_templates').select('*').eq('id', comp.prize_template_id).single();
    if (!template) return;

    const prizes = template.prizes as { position: number; division: string | null; amount: number; description: string }[];
    for (const prize of prizes) {
      // Find matching result
      const matching = results.find(r =>
        r.points_position === prize.position && (prize.division === null || r.division === prize.division)
      );
      if (!matching) continue;

      const entry = matching.entry as CompetitionEntry | undefined;
      if (!entry?.member_id) continue;

      // Credit prize balance
      await supabase.from('member_account_transactions').insert({
        member_id: entry.member_id,
        club_id: comp.club_id,
        balance_type: 'prize',
        type: 'credit',
        category: 'prize_award',
        amount: prize.amount,
        description: `${prize.description} — ${comp.name}`,
        reference_id: comp.id,
      });

      // Update prize balance
      const { data: acc } = await supabase.from('member_accounts').select('prize_balance').eq('member_id', entry.member_id).single();
      if (acc) {
        await supabase.from('member_accounts').update({ prize_balance: acc.prize_balance + prize.amount }).eq('member_id', entry.member_id);
      }

      // Update result
      await supabase.from('competition_results').update({ prize_description: prize.description, prize_amount: prize.amount, prize_paid: true }).eq('id', matching.id);
    }

    await fetchComp(comp!.id);
    alert('Prizes applied to winner accounts!');
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-60"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  if (!comp) return <div className="p-6">Competition not found</div>;

  const tabs = [
    { id: 'entries', label: `Entries (${entries.length})` },
    { id: 'scores', label: 'Score Entry' },
    { id: 'results', label: `Results (${results.length})` },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button className="text-sm text-gray-500 hover:text-gray-700 mb-1" onClick={() => navigate('/admin/competitions')}>
            ← All Competitions
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{comp.name}</h1>
          <p className="text-sm text-gray-500">
            {format(new Date(comp.date), 'EEEE d MMMM yyyy')} · {comp.format} · {(comp.course as Course | undefined)?.name ?? 'No course'} · Handicap allowance: {comp.handicap_allowance_pct}%
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CompStatusBadge status={comp.status} />
          {comp.status === 'in_progress' && (
            <Button size="sm" onClick={calculateResults}>Calculate Results</Button>
          )}
          {comp.status === 'results_pending' && (
            <>
              <Button size="sm" variant="secondary" onClick={applyPrizes}>Apply Prizes</Button>
              <Button size="sm" loading={publishing} onClick={publishResults}>
                <CheckCircle className="w-4 h-4 mr-1" />Publish Results
              </Button>
            </>
          )}
          {comp.status === 'draft' && (
            <Button size="sm" onClick={async () => {
              await supabase.from('competitions').update({ status: 'in_progress' }).eq('id', comp.id);
              fetchComp(comp.id);
            }}>Start Competition</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-[var(--club-primary,#16a34a)] text-[var(--club-primary,#16a34a)]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Entries Tab */}
      {activeTab === 'entries' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{entries.length} entries</p>
            <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddEntry(true)}>Add Entry</Button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Player', 'Handicap', 'Division', 'Starting Time', 'Group', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(entry => {
                  const member = entry.member as Member | undefined;
                  return (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{member ? `${member.first_name} ${member.last_name}` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.playing_handicap ?? member?.handicap ?? '—'}</td>
                      <td className="px-4 py-3 text-sm"><Badge>{entry.division ?? '—'}</Badge></td>
                      <td className="px-4 py-3 text-sm font-mono">{entry.starting_time?.slice(0, 5) ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">{entry.group_number ?? '—'}</td>
                      <td className="px-4 py-3 text-sm"><Badge>{entry.status}</Badge></td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scores Tab */}
      {activeTab === 'scores' && (
        <ScoreEntry comp={comp} entries={entries} onSave={() => fetchComp(comp.id)} />
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <ResultsView comp={comp} results={results} entries={entries} />
      )}

      {/* Add Entry Modal */}
      {showAddEntry && (
        <AddEntryModal
          comp={comp}
          clubId={profile!.club_id!}
          onClose={() => setShowAddEntry(false)}
          onSave={() => { setShowAddEntry(false); fetchComp(comp.id); }}
        />
      )}
    </div>
  );
}

// ─── Score Entry Component ────────────────────────────────────────────────────
function ScoreEntry({ comp, entries, onSave }: { comp: Competition; entries: CompetitionEntry[]; onSave: () => void }) {
  const [selectedEntry, setSelectedEntry] = useState<CompetitionEntry | null>(null);
  const [grossInput, setGrossInput] = useState('');
  const [holeScores, setHoleScores] = useState<HoleScore[]>([]);
  const [mode, setMode] = useState<'total' | 'hole'>('total');
  const [saving, setSaving] = useState(false);

  async function saveScore() {
    if (!selectedEntry) return;
    setSaving(true);

    let totalGross = 0, totalNet = 0, totalPoints = 0;
    const finalHoles = holeScores;

    if (mode === 'total' && grossInput) {
      totalGross = parseInt(grossInput);
      const playingHcp = selectedEntry.playing_handicap ?? 0;
      totalNet = totalGross - playingHcp;
      // Estimate stableford points
      const tee = comp.course_tee as CourseTee | undefined;
      const par = tee?.par ?? 72;
      totalPoints = Math.max(0, (par + playingHcp) - totalGross + (comp.format === 'stableford' ? 36 : 0));
    } else {
      totalGross = finalHoles.reduce((s, h) => s + (h.gross ?? 0), 0);
      totalNet = finalHoles.reduce((s, h) => s + (h.net ?? 0), 0);
      totalPoints = finalHoles.reduce((s, h) => s + (h.points ?? 0), 0);
    }

    const existing = Array.isArray(selectedEntry.scorecard) ? (selectedEntry.scorecard as Scorecard[])[0] : selectedEntry.scorecard as Scorecard | null;

    if (existing?.id) {
      await supabase.from('scorecards').update({
        total_gross: totalGross,
        total_net: totalNet,
        total_points: totalPoints,
        hole_scores: finalHoles,
        submitted_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('scorecards').insert({
        entry_id: selectedEntry.id,
        club_id: comp.club_id,
        total_gross: totalGross,
        total_net: totalNet,
        total_points: totalPoints,
        hole_scores: finalHoles,
        submitted_at: new Date().toISOString(),
      });
    }

    setSaving(false);
    setSelectedEntry(null);
    setGrossInput('');
    onSave();
  }

  const enteredCount = entries.filter(e => {
    const sc = Array.isArray(e.scorecard) ? (e.scorecard as Scorecard[])[0] : e.scorecard as Scorecard | null;
    return sc?.total_gross !== null && sc?.total_gross !== undefined;
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{enteredCount}/{entries.length} scores entered</p>
        <div className="flex gap-2">
          <Button size="sm" variant={mode === 'total' ? 'primary' : 'outline'} onClick={() => setMode('total')}>Total Score</Button>
          <Button size="sm" variant={mode === 'hole' ? 'primary' : 'outline'} onClick={() => setMode('hole')}>Hole by Hole</Button>
        </div>
      </div>

      <div className="grid gap-2">
        {entries.map(entry => {
          const member = entry.member as Member | undefined;
          const sc = Array.isArray(entry.scorecard) ? (entry.scorecard as Scorecard[])[0] : entry.scorecard as Scorecard | null;
          const hasScore = sc?.total_gross !== null && sc?.total_gross !== undefined;
          const isSelected = selectedEntry?.id === entry.id;

          return (
            <div key={entry.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${isSelected ? 'border-[var(--club-primary,#16a34a)]' : 'border-gray-200'}`}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => { setSelectedEntry(isSelected ? null : entry); setGrossInput(sc?.total_gross?.toString() ?? ''); }}
              >
                <div>
                  <p className="font-medium text-sm">{member?.first_name} {member?.last_name}</p>
                  <p className="text-xs text-gray-400">Hcp {entry.playing_handicap ?? '—'} · {entry.division ?? 'No div'} · {entry.starting_time?.slice(0, 5) ?? '?'}</p>
                </div>
                {hasScore ? (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">
                      {comp.format === 'stableford' ? `${sc?.total_points} pts` : `Net ${sc?.total_net}`}
                    </p>
                    <p className="text-xs text-gray-400">Gross {sc?.total_gross}</p>
                  </div>
                ) : (
                  <Badge variant="warning">No Score</Badge>
                )}
              </div>

              {isSelected && (
                <div className="border-t p-4 bg-gray-50 space-y-3">
                  {mode === 'total' ? (
                    <div className="flex gap-3">
                      <Input
                        label="Total Gross Score"
                        type="number"
                        value={grossInput}
                        onChange={e => setGrossInput(e.target.value)}
                        placeholder="e.g. 89"
                      />
                    </div>
                  ) : (
                    <HoleByHoleEntry
                      playing_handicap={entry.playing_handicap ?? 0}
                      format={comp.format}
                      courseTee={comp.course_tee as CourseTee | undefined}
                      onChange={setHoleScores}
                      existing={sc?.hole_scores ?? []}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" loading={saving} onClick={saveScore}>Save Score</Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      setSaving(true);
                      await supabase.from('competition_entries').update({ status: 'dnf' }).eq('id', entry.id);
                      setSaving(false);
                      setSelectedEntry(null);
                      onSave();
                    }}>Mark DNF</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hole by Hole Entry ───────────────────────────────────────────────────────
function HoleByHoleEntry({
  playing_handicap,
  format: compFormat,
  courseTee,
  onChange,
  existing,
}: {
  playing_handicap: number;
  format: CompetitionFormat;
  courseTee?: CourseTee;
  onChange: (scores: HoleScore[]) => void;
  existing: HoleScore[];
}) {
  const holes = courseTee?.course_holes ?? Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, stroke_index: i + 1 }));
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    existing.forEach(h => { if (h.gross !== null) init[h.hole] = h.gross; });
    return init;
  });

  function calc(hole: number, par: number, si: number, gross: number): HoleScore {
    const strokes = Math.floor(playing_handicap / 18) + (si <= (playing_handicap % 18) ? 1 : 0);
    const net = gross - strokes;
    const diff = net - par;
    let points = 0;
    if (compFormat === 'stableford') {
      if (diff <= -2) points = 4;
      else if (diff === -1) points = 3;
      else if (diff === 0) points = 2;
      else if (diff === 1) points = 1;
    }
    return { hole, par, stroke_index: si, gross, net, points };
  }

  function handleChange(holeNum: number, par: number, si: number, value: string) {
    const g = parseInt(value);
    if (isNaN(g)) return;
    const updated = { ...scores, [holeNum]: g };
    setScores(updated);
    const holeScores = (holes as { hole_number: number; par: number; stroke_index?: number }[]).map(h => {
      const g2 = updated[h.hole_number];
      if (g2 === undefined) return { hole: h.hole_number, par: h.par, stroke_index: h.stroke_index ?? h.hole_number, gross: null };
      return calc(h.hole_number, h.par, h.stroke_index ?? h.hole_number, g2);
    });
    onChange(holeScores);
  }

  const runningPoints = (holes as { hole_number: number; par: number; stroke_index?: number }[]).reduce((sum, h) => {
    const g = scores[h.hole_number];
    if (g === undefined) return sum;
    return sum + calc(h.hole_number, h.par, h.stroke_index ?? h.hole_number, g).points;
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500 font-medium mb-2">
        <span>Running Points: {runningPoints}</span>
        <span>Entered: {Object.keys(scores).length}/18</span>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {(holes as { hole_number: number; par: number; stroke_index?: number }[]).map(h => (
          <div key={h.hole_number} className="text-center">
            <div className="text-xs text-gray-400 mb-0.5">H{h.hole_number}<br/><span className="text-gray-300">P{h.par}</span></div>
            <input
              type="number"
              value={scores[h.hole_number] ?? ''}
              onChange={e => handleChange(h.hole_number, h.par, h.stroke_index ?? h.hole_number, e.target.value)}
              className="w-full text-center px-1 py-1 text-sm border border-gray-300 rounded"
              placeholder="—"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────────
function ResultsView({ comp, results, entries }: { comp: Competition; results: CompetitionResult[]; entries: CompetitionEntry[] }) {
  const divisions = comp.divisions_enabled
    ? [...new Set(results.map(r => r.division).filter(Boolean))]
    : [null];

  return (
    <div className="space-y-4">
      {divisions.map(div => (
        <div key={div ?? 'all'}>
          {div && <h3 className="font-semibold text-gray-700 mb-2">{div} Grade</h3>}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Pos', 'Player', 'Handicap', 'Gross', 'Net', 'Points', 'Prize'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results
                  .filter(r => div === null || r.division === div)
                  .map(r => {
                    const entry = entries.find(e => e.id === r.entry_id);
                    const member = entry?.member as Member | undefined;
                    const sc = Array.isArray(entry?.scorecard) ? (entry?.scorecard as Scorecard[])[0] : entry?.scorecard as Scorecard | null;
                    return (
                      <tr key={r.id} className={r.points_position === 1 ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-3 text-sm font-bold">
                          {r.points_position === 1 ? '🥇' : r.points_position === 2 ? '🥈' : r.points_position === 3 ? '🥉' : r.points_position}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{member ? `${member.first_name} ${member.last_name}` : '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{entry?.playing_handicap ?? '—'}</td>
                        <td className="px-4 py-3 text-sm">{sc?.total_gross ?? '—'}</td>
                        <td className="px-4 py-3 text-sm">{sc?.total_net ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-700">{sc?.total_points ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-purple-700">{r.prize_description ?? '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── New Competition Form ─────────────────────────────────────────────────────
function CompetitionFormModal({
  clubId,
  onClose,
  onSave,
}: {
  clubId: string;
  onClose: () => void;
  onSave: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    format: 'stableford' as CompetitionFormat,
    handicap_allowance_pct: 100,
    divisions_enabled: false,
    notes: '',
    course_id: '',
    course_tee_id: '',
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [tees, setTees] = useState<CourseTee[]>([]);
  const [saving, setSaving] = useState(false);
  const [divisionConfig, setDivisionConfig] = useState<DivisionConfig[]>([
    { name: 'A', handicap_min: 0, handicap_max: 12 },
    { name: 'B', handicap_min: 13, handicap_max: 24 },
    { name: 'C', handicap_min: 25, handicap_max: 54 },
  ]);

  useEffect(() => {
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data ?? []));
  }, []);

  useEffect(() => {
    if (form.course_id) {
      supabase.from('course_tees').select('*').eq('course_id', form.course_id).then(({ data }) => setTees(data ?? []));
    }
  }, [form.course_id]);

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    const { data, error } = await supabase.from('competitions').insert({
      ...form,
      club_id: clubId,
      status: 'draft',
      division_config: form.divisions_enabled ? divisionConfig : [],
    }).select().single();
    if (!error && data) onSave(data.id);
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title="New Competition" size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Competition Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="col-span-2" placeholder="e.g. Saturday Stableford — 26 Apr" />
        <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <Select
          label="Format"
          value={form.format}
          onChange={e => setForm(f => ({ ...f, format: e.target.value as CompetitionFormat }))}
          options={[
            { value: 'stableford', label: 'Stableford' },
            { value: 'stroke', label: 'Stroke Play' },
            { value: 'par', label: 'Par/Bogey' },
          ]}
        />
        <Select
          label="Course"
          value={form.course_id}
          onChange={e => setForm(f => ({ ...f, course_id: e.target.value, course_tee_id: '' }))}
          options={[{ value: '', label: '— Select Course —' }, ...courses.map(c => ({ value: c.id, label: c.name }))]}
        />
        <Select
          label="Tee"
          value={form.course_tee_id}
          onChange={e => setForm(f => ({ ...f, course_tee_id: e.target.value }))}
          options={[{ value: '', label: '— Select Tee —' }, ...tees.map(t => ({ value: t.id, label: `${t.tee_name} (${t.gender === 'M' ? "Men's" : "Ladies'"}, par ${t.par})` }))]}
        />
        <Input
          label="Handicap Allowance %"
          type="number"
          value={form.handicap_allowance_pct}
          onChange={e => setForm(f => ({ ...f, handicap_allowance_pct: parseInt(e.target.value) }))}
        />
        <div className="flex items-center gap-2 col-span-2">
          <input type="checkbox" id="div-enabled" checked={form.divisions_enabled} onChange={e => setForm(f => ({ ...f, divisions_enabled: e.target.checked }))} />
          <label htmlFor="div-enabled" className="text-sm font-medium text-gray-700">Enable Divisions (A/B/C Grade)</label>
        </div>
        {form.divisions_enabled && (
          <div className="col-span-2 space-y-2">
            {divisionConfig.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={d.name} onChange={e => setDivisionConfig(dc => dc.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name" />
                <Input type="number" value={d.handicap_min} onChange={e => setDivisionConfig(dc => dc.map((x, j) => j === i ? { ...x, handicap_min: parseInt(e.target.value) } : x))} placeholder="Min hcp" />
                <span className="text-sm">to</span>
                <Input type="number" value={d.handicap_max} onChange={e => setDivisionConfig(dc => dc.map((x, j) => j === i ? { ...x, handicap_max: parseInt(e.target.value) } : x))} placeholder="Max hcp" />
              </div>
            ))}
          </div>
        )}
        <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="col-span-2" />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={saving} onClick={handleSave}>Create Competition</Button>
      </div>
    </Modal>
  );
}

// ─── Add Entry Modal ──────────────────────────────────────────────────────────
function AddEntryModal({
  comp,
  clubId,
  onClose,
  onSave,
}: {
  comp: Competition;
  clubId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setSearchResults] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [startTime, setStartTime] = useState('');
  const [saving, setSaving] = useState(false);

  async function searchMembers(q: string) {
    if (!q) return;
    const { data } = await supabase.from('members').select('*').eq('club_id', clubId).ilike('last_name', `%${q}%`).limit(8);
    setSearchResults(data ?? []);
  }

  async function addEntry() {
    if (!selected) return;
    setSaving(true);
    const playingHcp = selected.handicap ?? 0;

    // Assign division
    let division = 'A';
    if (comp.divisions_enabled && comp.division_config) {
      const divConf = comp.division_config as DivisionConfig[];
      for (const d of divConf) {
        if (playingHcp >= d.handicap_min && playingHcp <= d.handicap_max) { division = d.name; break; }
      }
    }

    await supabase.from('competition_entries').insert({
      competition_id: comp.id,
      club_id: clubId,
      member_id: selected.id,
      playing_handicap: playingHcp,
      handicap_index_at_entry: playingHcp,
      division: comp.divisions_enabled ? division : null,
      starting_time: startTime || null,
      status: 'entered',
    });
    setSaving(false);
    onSave();
  }

  return (
    <Modal open onClose={onClose} title="Add Entry" size="md">
      <div className="space-y-4">
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="Search member by last name..."
          value={search}
          onChange={e => { setSearch(e.target.value); searchMembers(e.target.value); }}
        />
        {results.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            {results.map(m => (
              <div
                key={m.id}
                className={`px-3 py-2 cursor-pointer text-sm hover:bg-gray-50 ${selected?.id === m.id ? 'bg-green-50' : ''}`}
                onClick={() => setSelected(m)}
              >
                {m.first_name} {m.last_name} — Hcp {m.handicap ?? 'N/A'}
              </div>
            ))}
          </div>
        )}
        {selected && (
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-green-800">Selected: {selected.first_name} {selected.last_name}</p>
            <p className="text-xs text-green-600">Handicap: {selected.handicap ?? 'N/A'}</p>
          </div>
        )}
        <Input label="Starting Time (optional)" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!selected} onClick={addEntry}>Add Entry</Button>
        </div>
      </div>
    </Modal>
  );
}
