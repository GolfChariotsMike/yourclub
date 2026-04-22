import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, Flag, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CompetitionEntry, Competition, CourseTee, CourseHole, Member, HoleScore, Scorecard } from '../../types';

interface EntryWithDetails extends CompetitionEntry {
  competition: Competition & { course_tee?: CourseTee & { course_holes?: CourseHole[] } };
  member?: Member;
  scorecard?: Scorecard;
}

export function MobileScorecard() {
  const { entryId } = useParams<{ entryId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [entry, setEntry] = useState<EntryWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentHole, setCurrentHole] = useState(1);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [ntpHoles, setNtpHoles] = useState<Set<number>>(new Set());
  const [ldHoles, setLdHoles] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [markerConfirm, setMarkerConfirm] = useState(false);

  useEffect(() => {
    if (entryId && token) fetchEntry();
  }, [entryId, token]);

  async function fetchEntry() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('competition_entries')
      .select(`
        *,
        competition:competitions(*, course_tee:course_tees(*, course_holes:course_holes(*))),
        member:members(first_name, last_name),
        scorecard:scorecards(*)
      `)
      .eq('id', entryId!)
      .eq('scorecard_token', token!)
      .single();

    if (err || !data) {
      setError('Invalid scorecard link. Please check your link and try again.');
      setLoading(false);
      return;
    }

    setEntry(data as EntryWithDetails);

    // Load existing scores
    const existingSc = Array.isArray(data.scorecard) ? data.scorecard[0] : data.scorecard;
    if (existingSc?.hole_scores) {
      const existingScores: Record<number, number> = {};
      (existingSc.hole_scores as HoleScore[]).forEach(h => {
        if (h.gross !== null) existingScores[h.hole] = h.gross;
      });
      setScores(existingScores);
      setNtpHoles(new Set(existingSc.ntp_holes ?? []));
      setLdHoles(new Set(existingSc.ld_holes ?? []));
    }

    setLoading(false);
  }

  function calcHoleResult(hole: number, par: number, si: number, gross: number) {
    const hcp = entry?.playing_handicap ?? 0;
    const strokes = Math.floor(hcp / 18) + (si <= (hcp % 18) ? 1 : 0);
    const net = gross - strokes;
    const diff = net - par;
    let points = 0;
    if (entry?.competition?.format === 'stableford') {
      if (diff <= -2) points = 4;
      else if (diff === -1) points = 3;
      else if (diff === 0) points = 2;
      else if (diff === 1) points = 1;
    }
    return { net, points };
  }

  async function saveProgress() {
    if (!entry) return;
    const holes = getHoles();
    const holeScores: HoleScore[] = holes.map(h => {
      const gross = scores[h.hole_number] ?? null;
      if (gross === null) return { hole: h.hole_number, par: h.par, stroke_index: h.stroke_index ?? h.hole_number, gross: null };
      const { net, points } = calcHoleResult(h.hole_number, h.par, h.stroke_index ?? h.hole_number, gross);
      return { hole: h.hole_number, par: h.par, stroke_index: h.stroke_index ?? h.hole_number, gross, net, points, ntp: ntpHoles.has(h.hole_number), ld: ldHoles.has(h.hole_number) };
    });

    const totalGross = holeScores.reduce((s, h) => s + (h.gross ?? 0), 0);
    const totalNet = holeScores.reduce((s, h) => s + (h.net ?? 0), 0);
    const totalPoints = holeScores.reduce((s, h) => s + (h.points ?? 0), 0);

    const existingSc = Array.isArray(entry.scorecard) ? (entry.scorecard as Scorecard[])[0] : entry.scorecard as Scorecard | null;

    if (existingSc?.id) {
      await supabase.from('scorecards').update({
        hole_scores: holeScores,
        total_gross: totalGross,
        total_net: totalNet,
        total_points: totalPoints,
        ntp_holes: Array.from(ntpHoles),
        ld_holes: Array.from(ldHoles),
      }).eq('id', existingSc.id);
    } else {
      const { data } = await supabase.from('scorecards').insert({
        entry_id: entry.id,
        club_id: entry.club_id,
        hole_scores: holeScores,
        total_gross: totalGross,
        total_net: totalNet,
        total_points: totalPoints,
        ntp_holes: Array.from(ntpHoles),
        ld_holes: Array.from(ldHoles),
      }).select().single();
      if (data) setEntry(e => e ? { ...e, scorecard: data } : e);
    }
  }

  async function submitScorecard() {
    setSubmitting(true);
    await saveProgress();
    const existingSc = Array.isArray(entry?.scorecard) ? (entry?.scorecard as Scorecard[])[0] : entry?.scorecard as Scorecard | null;
    const scId = existingSc?.id;
    if (scId) {
      await supabase.from('scorecards').update({ submitted_at: new Date().toISOString(), verified: true }).eq('id', scId);
    }
    setSubmitting(false);
    setSubmitted(true);
  }

  function getHoles(): CourseHole[] {
    const holes = entry?.competition?.course_tee?.course_holes;
    if (holes && holes.length > 0) return holes.sort((a, b) => a.hole_number - b.hole_number);
    return Array.from({ length: 18 }, (_, i) => ({ id: `${i}`, course_tee_id: '', hole_number: i + 1, par: 4, stroke_index: i + 1 }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 text-center max-w-sm">
          <div className="text-4xl mb-3">⛳</div>
          <p className="font-semibold text-gray-800">Invalid Scorecard</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Scorecard Submitted!</h2>
          <p className="text-sm text-gray-500 mt-2">Your round has been recorded.</p>
          {entry && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Total Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {Object.values(scores).reduce((a, b) => a + b, 0)} gross
              </p>
              {entry.competition?.format === 'stableford' && (
                <p className="text-lg font-semibold text-green-700 mt-1">
                  {getHoles().reduce((sum, h) => {
                    const g = scores[h.hole_number];
                    if (!g) return sum;
                    return sum + calcHoleResult(h.hole_number, h.par, h.stroke_index ?? h.hole_number, g).points;
                  }, 0)} Stableford points
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (markerConfirm) {
    const totalGross = Object.values(scores).reduce((a, b) => a + b, 0);
    const totalPoints = getHoles().reduce((sum, h) => {
      const g = scores[h.hole_number];
      if (!g) return sum;
      return sum + calcHoleResult(h.hole_number, h.par, h.stroke_index ?? h.hole_number, g).points;
    }, 0);

    return (
      <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Marker Confirmation</h2>
          <p className="text-sm text-gray-500 mb-4">Please confirm the scores for:</p>
          <div className="text-center py-4 bg-gray-50 rounded-xl mb-4">
            <p className="font-bold text-xl text-gray-900">{entry?.member?.first_name} {entry?.member?.last_name}</p>
            <p className="text-3xl font-bold mt-2">{totalGross}</p>
            <p className="text-sm text-gray-500">Gross Score</p>
            {entry?.competition?.format === 'stableford' && (
              <p className="text-xl font-bold text-green-700 mt-1">{totalPoints} pts</p>
            )}
          </div>
          <div className="space-y-2">
            <button
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50"
              disabled={submitting}
              onClick={submitScorecard}
            >
              {submitting ? 'Submitting...' : '✓ I Confirm These Scores'}
            </button>
            <button
              className="w-full py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50"
              onClick={() => setMarkerConfirm(false)}
            >
              Back to Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  const holes = getHoles();
  const hole = holes.find(h => h.hole_number === currentHole)!;
  const gross = scores[currentHole];
  const result = gross !== undefined ? calcHoleResult(currentHole, hole?.par ?? 4, hole?.stroke_index ?? currentHole, gross) : null;
  const runningPoints = holes.reduce((sum, h) => {
    const g = scores[h.hole_number];
    if (!g) return sum;
    return sum + calcHoleResult(h.hole_number, h.par, h.stroke_index ?? h.hole_number, g).points;
  }, 0);
  const enteredHoles = Object.keys(scores).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-[var(--club-primary,#16a34a)] text-white px-4 pt-8 pb-4">
        <p className="text-sm opacity-80">{entry?.competition?.name}</p>
        <div className="flex items-baseline justify-between">
          <p className="text-xl font-bold">{entry?.member?.first_name} {entry?.member?.last_name}</p>
          <div className="text-right">
            <p className="text-sm opacity-80">Running</p>
            <p className="text-2xl font-bold">{entry?.competition?.format === 'stableford' ? `${runningPoints} pts` : Object.values(scores).reduce((a, b) => a + b, 0)}</p>
          </div>
        </div>
        <p className="text-xs opacity-60 mt-1">Handicap {entry?.playing_handicap ?? '?'} · {enteredHoles}/18 holes</p>
      </div>

      {/* Hole grid */}
      <div className="p-4">
        <div className="grid grid-cols-9 gap-1 mb-4">
          {holes.map(h => (
            <button
              key={h.hole_number}
              className={`aspect-square rounded-lg text-sm font-bold flex items-center justify-center transition-all ${
                h.hole_number === currentHole ? 'bg-[var(--club-primary,#16a34a)] text-white' :
                scores[h.hole_number] !== undefined ? 'bg-white text-gray-700 border-2 border-green-200' :
                'bg-white text-gray-400 border border-gray-200'
              }`}
              onClick={() => setCurrentHole(h.hole_number)}
            >
              {h.hole_number}
            </button>
          ))}
        </div>
      </div>

      {/* Current hole */}
      <div className="px-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-4xl font-black text-gray-900">Hole {currentHole}</p>
              <div className="flex gap-3 mt-1 text-sm text-gray-500">
                <span>Par {hole?.par ?? 4}</span>
                <span>SI {hole?.stroke_index ?? currentHole}</span>
                {hole?.distance_metres && <span>{hole.distance_metres}m</span>}
              </div>
            </div>
            {result && (
              <div className="text-right">
                <p className={`text-2xl font-bold ${result.points >= 3 ? 'text-green-600' : result.points === 2 ? 'text-blue-600' : result.points === 1 ? 'text-gray-700' : 'text-red-500'}`}>
                  {entry?.competition?.format === 'stableford' ? `${result.points} pts` : `Net ${result.net}`}
                </p>
              </div>
            )}
          </div>

          {/* Score input */}
          <div className="flex items-center justify-center gap-4 my-6">
            <button
              className="w-14 h-14 rounded-full border-2 border-gray-300 text-2xl font-bold hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setScores(s => { const v = (s[currentHole] ?? (hole?.par ?? 4)) - 1; if (v < 1) return s; return { ...s, [currentHole]: v }; })}
            >
              −
            </button>
            <div className="w-20 h-20 rounded-2xl bg-gray-900 flex items-center justify-center">
              <span className="text-4xl font-black text-white">{gross ?? '—'}</span>
            </div>
            <button
              className="w-14 h-14 rounded-full border-2 border-gray-300 text-2xl font-bold hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setScores(s => ({ ...s, [currentHole]: (s[currentHole] ?? (hole?.par ?? 4)) + 1 }))}
            >
              +
            </button>
          </div>

          {/* NTP / LD flags */}
          {((entry?.competition?.ntp_holes ?? []).includes(currentHole) || (entry?.competition?.ld_holes ?? []).includes(currentHole)) && (
            <div className="flex gap-2 justify-center mb-4">
              {(entry?.competition?.ntp_holes ?? []).includes(currentHole) && (
                <button
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${ntpHoles.has(currentHole) ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-100 text-gray-600'}`}
                  onClick={() => setNtpHoles(s => { const n = new Set(s); if (n.has(currentHole)) n.delete(currentHole); else n.add(currentHole); return n; })}
                >
                  <Target className="w-3 h-3" /> NTP
                </button>
              )}
              {(entry?.competition?.ld_holes ?? []).includes(currentHole) && (
                <button
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${ldHoles.has(currentHole) ? 'bg-blue-400 text-blue-900' : 'bg-gray-100 text-gray-600'}`}
                  onClick={() => setLdHoles(s => { const n = new Set(s); if (n.has(currentHole)) n.delete(currentHole); else n.add(currentHole); return n; })}
                >
                  <Flag className="w-3 h-3" /> LD
                </button>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2">
            {currentHole > 1 && (
              <button
                className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
                onClick={() => { saveProgress(); setCurrentHole(h => h - 1); }}
              >
                ← Prev
              </button>
            )}
            {currentHole < 18 ? (
              <button
                className="flex-1 py-3 bg-[var(--club-primary,#16a34a)] text-white rounded-xl hover:opacity-90 font-medium"
                onClick={() => { saveProgress(); setCurrentHole(h => h + 1); }}
              >
                Next →
              </button>
            ) : (
              <button
                className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium"
                onClick={() => { saveProgress(); setMarkerConfirm(true); }}
                disabled={enteredHoles < 18}
              >
                {enteredHoles < 18 ? `${18 - enteredHoles} holes remaining` : 'Submit Card →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
