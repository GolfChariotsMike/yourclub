import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Lock, Unlock, Users } from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import type { TeeTimeSlot, Booking, BookingPlayer, Member, TeeSheetConfig, Competition } from '../../types';

interface SlotWithBookings extends TeeTimeSlot {
  bookings: (Booking & { players: (BookingPlayer & { member?: Member })[] })[];
}

export function AdminTeeSheet() {
  const { profile } = useAuth();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<SlotWithBookings[]>([]);
  const [configs, setConfigs] = useState<TeeSheetConfig[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithBookings | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (profile?.club_id) {
      fetchConfigs();
      fetchCompetitions();
    }
  }, [profile?.club_id]);

  useEffect(() => {
    if (selectedConfig || configs.length > 0) {
      fetchSlots();
    }
  }, [date, selectedConfig, configs]);

  async function fetchConfigs() {
    const { data } = await supabase
      .from('tee_sheet_configs')
      .select('*')
      .eq('club_id', profile!.club_id!)
      .eq('is_active', true);
    setConfigs(data ?? []);
    if (data && data.length > 0) setSelectedConfig(data[0].id);
  }

  async function fetchCompetitions() {
    const { data } = await supabase
      .from('competitions')
      .select('*')
      .eq('club_id', profile!.club_id!)
      .in('status', ['draft', 'entries_open']);
    setCompetitions(data ?? []);
  }

  async function fetchSlots() {
    setLoading(true);
    const configId = selectedConfig || configs[0]?.id;
    if (!configId) { setLoading(false); return; }

    const { data: slotsData } = await supabase
      .from('tee_time_slots')
      .select(`
        *,
        bookings:bookings(
          *,
          players:booking_players(
            *,
            member:members(first_name, last_name, handicap, status)
          )
        )
      `)
      .eq('tee_sheet_config_id', configId)
      .eq('date', date)
      .order('time');

    setSlots(slotsData ?? []);
    setLoading(false);
  }

  async function generateSlots() {
    const config = configs.find(c => c.id === selectedConfig);
    if (!config) return;
    setGenerating(true);

    // Generate time slots from open_time to close_time
    const slots: { club_id: string; tee_sheet_config_id: string; date: string; time: string; status: string }[] = [];
    const [openH, openM] = config.open_time.split(':').map(Number);
    const [closeH, closeM] = config.close_time.split(':').map(Number);
    let current = openH * 60 + openM;
    const end = closeH * 60 + closeM;

    while (current <= end) {
      const h = Math.floor(current / 60).toString().padStart(2, '0');
      const m = (current % 60).toString().padStart(2, '0');
      slots.push({
        club_id: profile!.club_id!,
        tee_sheet_config_id: config.id,
        date,
        time: `${h}:${m}:00`,
        status: 'open',
      });
      current += config.slot_interval_minutes;
    }

    await supabase.from('tee_time_slots').upsert(slots, { onConflict: 'tee_sheet_config_id,date,time', ignoreDuplicates: true });
    await fetchSlots();
    setGenerating(false);
  }

  const config = configs.find(c => c.id === selectedConfig);

  if (!profile?.club_id) return (<div className="p-6 flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Tee Sheet</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {configs.length > 1 && (
            <select
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              value={selectedConfig}
              onChange={e => setSelectedConfig(e.target.value)}
            >
              {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg">
            <button className="p-2 hover:bg-gray-50 rounded-l-lg" onClick={() => setDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-sm font-medium px-3 py-2 border-x border-gray-200 focus:outline-none"
            />
            <button className="p-2 hover:bg-gray-50 rounded-r-lg" onClick={() => setDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Button size="sm" variant="outline" loading={generating} onClick={generateSlots}>
            Generate Slots
          </Button>
        </div>
      </div>

      {/* Date header */}
      <div className="text-center py-2">
        <p className="text-lg font-semibold text-gray-800">{format(parseISO(date), 'EEEE, d MMMM yyyy')}</p>
        {config && <p className="text-sm text-gray-500">{config.name} · {config.slot_interval_minutes} min intervals · Max {config.max_players_per_slot}/slot</p>}
      </div>

      {/* Slots Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--club-primary,#16a34a)]" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No slots for this date.</p>
          <Button className="mt-4" size="sm" loading={generating} onClick={generateSlots}>Generate Slots</Button>
        </div>
      ) : (
        <div className="space-y-1">
          {slots.map(slot => {
            const activeBooking = (slot.bookings ?? []).find(b => !b.cancelled_at);
            const players = activeBooking?.players ?? [];
            const maxPlayers = config?.max_players_per_slot ?? 4;
            const isFull = players.length >= maxPlayers;

            const slotColors: Record<string, string> = {
              open: isFull ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-300',
              blocked: 'bg-gray-100 border-gray-200',
              competition: 'bg-green-50 border-green-200',
            };

            return (
              <div
                key={slot.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${slotColors[slot.status]}`}
                onClick={() => { setSelectedSlot(slot); setShowBookingModal(true); }}
              >
                {/* Time */}
                <div className="w-16 text-sm font-mono font-medium text-gray-600">
                  {slot.time.slice(0, 5)}
                </div>

                {/* Status indicator */}
                <div className="w-24 flex-shrink-0">
                  {slot.status === 'blocked' ? (
                    <Badge variant="gray">Blocked</Badge>
                  ) : slot.status === 'competition' ? (
                    <Badge variant="success">Comp</Badge>
                  ) : isFull ? (
                    <Badge variant="info">Full</Badge>
                  ) : (
                    <Badge variant="gray">Open</Badge>
                  )}
                </div>

                {/* Players */}
                <div className="flex-1">
                  {slot.status === 'blocked' ? (
                    <span className="text-sm text-gray-500 italic">{slot.block_reason ?? 'Blocked'}</span>
                  ) : players.length === 0 ? (
                    <span className="text-sm text-gray-400">No bookings</span>
                  ) : (
                    <div className="flex gap-3 flex-wrap">
                      {players.map(p => (
                        <span key={p.id} className="text-sm text-gray-700">
                          {p.member ? `${p.member.first_name} ${p.member.last_name}` : p.guest_name}
                          {!p.member_id && <span className="text-xs text-gray-400 ml-1">(guest)</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Count */}
                <div className="text-sm text-gray-400 flex-shrink-0">
                  <Users className="w-3 h-3 inline mr-1" />
                  {players.length}/{maxPlayers}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedSlot && (
        <SlotModal
          slot={selectedSlot}
          clubId={profile!.club_id!}
          config={config}
          competitions={competitions}
          onClose={() => { setShowBookingModal(false); setSelectedSlot(null); }}
          onSave={fetchSlots}
        />
      )}
    </div>
  );
}

// ─── Slot Modal ───────────────────────────────────────────────────────────────
function SlotModal({
  slot,
  clubId,
  config,
  competitions,
  onClose,
  onSave,
}: {
  slot: SlotWithBookings;
  clubId: string;
  config?: TeeSheetConfig;
  competitions: Competition[];
  onClose: () => void;
  onSave: () => void;
}) {
  const activeBooking = slot.bookings?.find(b => !b.cancelled_at);
  const [action, setAction] = useState<'view' | 'book' | 'block' | 'edit'>('view');
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<{ member?: Member; guest_name?: string }[]>(
    activeBooking?.players?.map(p => ({ member: p.member, guest_name: p.guest_name })) ?? []
  );
  const [guestName, setGuestName] = useState('');
  const [blockReason, setBlockReason] = useState(slot.block_reason ?? '');
  const [compId, setCompId] = useState(slot.competition_id ?? '');
  const [saving, setSaving] = useState(false);

  async function searchMembers(q: string) {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('members')
      .select('id, first_name, last_name, handicap, status')
      .eq('club_id', clubId)
      .ilike('last_name', `%${q}%`)
      .eq('status', 'active')
      .limit(8);
    setSearchResults((data as Member[] | null) ?? []);
  }

  async function handleBlock() {
    setSaving(true);
    await supabase.from('tee_time_slots').update({
      status: slot.status === 'blocked' ? 'open' : 'blocked',
      block_reason: slot.status !== 'blocked' ? blockReason : null,
    }).eq('id', slot.id);
    onSave();
    onClose();
    setSaving(false);
  }

  async function handleBooking() {
    if (selectedPlayers.length === 0) return;
    setSaving(true);

    // Find lead member (first one)
    const lead = selectedPlayers[0].member;
    if (!lead) { setSaving(false); return; }

    // Create or update booking
    let bookingId = activeBooking?.id;
    if (!bookingId) {
      const { data } = await supabase.from('bookings').insert({
        club_id: clubId,
        slot_id: slot.id,
        booked_by_member_id: lead.id,
        credits_deducted: config?.booking_cost_credits ? config.booking_cost_credits * selectedPlayers.length : 0,
      }).select().single();
      bookingId = data?.id;
    }

    if (bookingId) {
      // Replace players
      await supabase.from('booking_players').delete().eq('booking_id', bookingId);
      await supabase.from('booking_players').insert(
        selectedPlayers.map((p, i) => ({
          booking_id: bookingId,
          member_id: p.member?.id ?? null,
          guest_name: p.guest_name ?? null,
          position: i + 1,
        }))
      );
    }

    onSave();
    onClose();
    setSaving(false);
  }

  async function handleCancelBooking() {
    if (!activeBooking) return;
    setSaving(true);
    await supabase.from('bookings').update({ cancelled_at: new Date().toISOString() }).eq('id', activeBooking.id);
    onSave();
    onClose();
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={`${slot.time.slice(0, 5)} — ${slot.status}`} size="md">
      <div className="space-y-4">
        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {slot.status !== 'blocked' && (
            <Button size="sm" variant={action === 'book' ? 'primary' : 'outline'} onClick={() => setAction('book')}>
              Book
            </Button>
          )}
          <Button
            size="sm"
            variant={slot.status === 'blocked' ? 'primary' : 'outline'}
            icon={slot.status === 'blocked' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            onClick={slot.status === 'blocked' ? handleBlock : () => setAction('block')}
            loading={saving && action === 'block'}
          >
            {slot.status === 'blocked' ? 'Unblock' : 'Block'}
          </Button>
          {activeBooking && (
            <Button size="sm" variant="danger" loading={saving} onClick={handleCancelBooking}>
              Cancel Booking
            </Button>
          )}
        </div>

        {/* Book form */}
        {action === 'book' && (
          <div className="space-y-3">
            <div>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Search members by last name..."
                value={memberSearch}
                onChange={e => { setMemberSearch(e.target.value); searchMembers(e.target.value); }}
              />
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg mt-1 overflow-hidden">
                  {searchResults.map(m => (
                    <div
                      key={m.id}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => {
                        setSelectedPlayers(p => [...p, { member: m }]);
                        setMemberSearch('');
                        setSearchResults([]);
                      }}
                    >
                      {m.first_name} {m.last_name} {m.handicap ? `(${m.handicap})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add guest */}
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Guest name..."
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => { if (guestName) { setSelectedPlayers(p => [...p, { guest_name: guestName }]); setGuestName(''); } }}
              >
                Add Guest
              </Button>
            </div>

            {/* Selected players */}
            {selectedPlayers.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 font-medium">Players ({selectedPlayers.length}/{config?.max_players_per_slot ?? 4})</p>
                {selectedPlayers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                    <span className="text-sm">{p.member ? `${p.member.first_name} ${p.member.last_name}` : p.guest_name} {!p.member && '(guest)'}</span>
                    <button className="text-red-400 hover:text-red-600" onClick={() => setSelectedPlayers(ps => ps.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <Button loading={saving} onClick={handleBooking} disabled={selectedPlayers.length === 0}>
              Confirm Booking
            </Button>
          </div>
        )}

        {/* Block form */}
        {action === 'block' && (
          <div className="space-y-3">
            <Input
              label="Block Reason (optional)"
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="e.g. Course maintenance, Private function"
            />
            <Button loading={saving} onClick={handleBlock}>Block This Slot</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Missing import workaround
function Calendar({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}
