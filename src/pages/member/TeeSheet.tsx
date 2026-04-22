import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Users, Check, X } from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import type { TeeTimeSlot, Booking, Member, TeeSheetConfig } from '../../types';

interface SlotWithBookings extends TeeTimeSlot {
  bookings: (Booking & { players: { member?: Member; guest_name?: string }[] })[];
}

export function MemberTeeSheet() {
  const { profile } = useAuth();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<SlotWithBookings[]>([]);
  const [config, setConfig] = useState<TeeSheetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithBookings | null>(null);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [member, setMember] = useState<Member | null>(null);

  useEffect(() => {
    if (profile?.club_id && profile?.member_id) {
      fetchConfig();
      fetchMember();
    }
  }, [profile]);

  useEffect(() => {
    if (config) fetchSlots();
  }, [date, config]);

  async function fetchConfig() {
    const { data } = await supabase.from('tee_sheet_configs').select('*').eq('club_id', profile!.club_id!).eq('is_active', true).limit(1).single();
    setConfig(data);
  }

  async function fetchMember() {
    const { data } = await supabase.from('members').select('*, account:member_accounts(credit_balance)').eq('id', profile!.member_id!).single();
    setMember(data);
  }

  async function fetchSlots() {
    setLoading(true);
    const { data } = await supabase
      .from('tee_time_slots')
      .select('*, bookings:bookings(*, players:booking_players(*, member:members(first_name, last_name)))')
      .eq('tee_sheet_config_id', config!.id)
      .eq('date', date)
      .order('time');

    // Fetch my bookings
    const { data: myBks } = await supabase
      .from('bookings')
      .select('*, slot:tee_time_slots(date, time), players:booking_players(member:members(first_name, last_name), guest_name)')
      .eq('booked_by_member_id', profile!.member_id!)
      .is('cancelled_at', null);

    setSlots(data ?? []);
    setMyBookings(myBks ?? []);
    setLoading(false);
  }

  async function cancelBooking(bookingId: string) {
    await supabase.from('bookings').update({ cancelled_at: new Date().toISOString() }).eq('id', bookingId);
    fetchSlots();
  }

  const isSuspended = member?.status === 'suspended';

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Book a Tee Time</h1>

      {isSuspended && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">Your membership is suspended. Contact the club to restore access.</p>
        </div>
      )}

      {/* My upcoming bookings */}
      {myBookings.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">My Bookings</p>
          {myBookings.slice(0, 3).map(bk => {
            const slot = bk.slot as { date: string; time: string } | undefined;
            return (
              <div key={bk.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{slot?.date ? format(new Date(slot.date), 'EEE d MMM') : '—'} at {slot?.time?.slice(0, 5)}</p>
                  <p className="text-xs text-gray-400">{(bk.players as { member?: Member; guest_name?: string }[])?.map(p => p.member ? `${p.member.first_name} ${p.member.last_name}` : p.guest_name).join(', ')}</p>
                </div>
                <button
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => cancelBooking(bk.id)}
                >
                  Cancel
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Date nav */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-1">
        <button className="p-2 hover:bg-gray-50 rounded-lg" onClick={() => setDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="font-semibold text-sm">{format(parseISO(date), 'EEEE d MMMM')}</p>
        <button className="p-2 hover:bg-gray-50 rounded-lg" onClick={() => setDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Slots */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--club-primary,#16a34a)]" /></div>
      ) : (
        <div className="space-y-2">
          {slots.map(slot => {
            const activeBooking = slot.bookings?.find(b => !b.cancelled_at);
            const players = activeBooking?.players ?? [];
            const maxPlayers = config?.max_players_per_slot ?? 4;
            const isFull = players.length >= maxPlayers;
            const isMyBooking = activeBooking?.booked_by_member_id === profile?.member_id;

            if (slot.status === 'blocked' || slot.status === 'competition') {
              return (
                <div key={slot.id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm font-mono text-gray-400">{slot.time.slice(0, 5)}</span>
                  <span className="text-sm text-gray-400">{slot.status === 'competition' ? '🏆 Competition Day' : `🚫 ${slot.block_reason ?? 'Unavailable'}`}</span>
                </div>
              );
            }

            return (
              <div
                key={slot.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                  isMyBooking ? 'bg-green-50 border-green-200' :
                  isFull ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed' :
                  'bg-white border-gray-200 hover:border-[var(--club-primary,#16a34a)] hover:shadow-sm'
                }`}
                onClick={() => { if (!isFull && !isSuspended && !isMyBooking) setSelectedSlot(slot); }}
              >
                <span className="text-sm font-mono font-medium w-12 flex-shrink-0">{slot.time.slice(0, 5)}</span>
                <div className="flex-1">
                  {players.length === 0 ? (
                    <span className="text-sm text-gray-400">Available</span>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {players.map((p, i) => (
                        <span key={i} className="text-sm text-gray-700">
                          {p.member ? `${(p.member as Member).first_name} ${(p.member as Member).last_name}` : p.guest_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{players.length}/{maxPlayers}</span>
                  {isMyBooking && <span className="text-xs text-green-600 font-medium">My booking</span>}
                  {isFull && !isMyBooking && <span className="text-xs text-gray-400">Full</span>}
                </div>
              </div>
            );
          })}
          {slots.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No tee times available for this date.</p>
            </div>
          )}
        </div>
      )}

      {/* Booking modal */}
      {selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          clubId={profile!.club_id!}
          memberId={profile!.member_id!}
          config={config}
          onClose={() => setSelectedSlot(null)}
          onBooked={() => { setSelectedSlot(null); fetchSlots(); }}
        />
      )}
    </div>
  );
}

function BookingModal({
  slot,
  clubId,
  memberId,
  config,
  onClose,
  onBooked,
}: {
  slot: SlotWithBookings;
  clubId: string;
  memberId: string;
  config: TeeSheetConfig | null;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [partnerSearch, setPartnerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [partners, setPartners] = useState<{ member?: Member; guest_name?: string }[]>([]);
  const [guestName, setGuestName] = useState('');
  const [booking, setBooking] = useState(false);
  const [selfMember, setSelfMember] = useState<Member | null>(null);

  useEffect(() => {
    supabase.from('members').select('id, first_name, last_name').eq('id', memberId).single().then(({ data }) => {
      setSelfMember(data as Member | null);
    });
  }, [memberId]);

  async function searchMembers(q: string) {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from('members').select('id, first_name, last_name, handicap').eq('club_id', clubId).ilike('last_name', `%${q}%`).eq('status', 'active').neq('id', memberId).limit(6);
    setSearchResults((data as Member[] | null) ?? []);
  }

  async function confirmBooking() {
    setBooking(true);
    const costPerPlayer = config?.booking_cost_credits ?? 0;
    const totalPlayers = 1 + partners.length;

    // Create booking
    const { data: bk } = await supabase.from('bookings').insert({
      club_id: clubId,
      slot_id: slot.id,
      booked_by_member_id: memberId,
      credits_deducted: costPerPlayer * totalPlayers,
    }).select().single();

    if (bk) {
      const allPlayers = [{ member: selfMember, position: 1 }, ...partners.map((p, i) => ({ ...p, position: i + 2 }))];
      await supabase.from('booking_players').insert(
        allPlayers.map(p => ({
          booking_id: bk.id,
          member_id: p.member?.id ?? null,
          guest_name: (p as { guest_name?: string }).guest_name ?? null,
          position: p.position,
        }))
      );

      // Deduct credits if needed
      if (costPerPlayer > 0) {
        const { data: acc } = await supabase.from('member_accounts').select('credit_balance').eq('member_id', memberId).single();
        if (acc) {
          await supabase.from('member_accounts').update({ credit_balance: Math.max(0, acc.credit_balance - costPerPlayer * totalPlayers) }).eq('member_id', memberId);
          await supabase.from('member_account_transactions').insert({
            member_id: memberId,
            club_id: clubId,
            balance_type: 'credit',
            type: 'debit',
            category: 'booking',
            amount: costPerPlayer * totalPlayers,
            description: `Tee time booking ${slot.date} ${slot.time.slice(0, 5)}`,
            reference_id: bk.id,
          });
        }
      }
    }

    setBooking(false);
    onBooked();
  }

  const maxPartners = (config?.max_players_per_slot ?? 4) - 1;

  return (
    <Modal open onClose={onClose} title={`Book ${slot.time.slice(0, 5)}`}>
      <div className="space-y-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm font-medium text-gray-700">{format(parseISO(slot.date), 'EEEE d MMMM yyyy')}</p>
          <p className="text-sm text-gray-500">{slot.time.slice(0, 5)} tee time</p>
          {(config?.booking_cost_credits ?? 0) > 0 && (
            <p className="text-xs text-blue-600 mt-1">${config!.booking_cost_credits} credits per player</p>
          )}
        </div>

        {/* You */}
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">{selfMember?.first_name} {selfMember?.last_name} (you)</span>
        </div>

        {/* Add partners */}
        {partners.length < maxPartners && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Add playing partners ({partners.length}/{maxPartners})</p>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Search member by last name..."
              value={partnerSearch}
              onChange={e => { setPartnerSearch(e.target.value); searchMembers(e.target.value); }}
            />
            {searchResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                {searchResults.map(m => (
                  <div key={m.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm" onClick={() => { setPartners(p => [...p, { member: m }]); setPartnerSearch(''); setSearchResults([]); }}>
                    {m.first_name} {m.last_name}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Or add guest by name..." value={guestName} onChange={e => setGuestName(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => { if (guestName) { setPartners(p => [...p, { guest_name: guestName }]); setGuestName(''); } }}>Add</Button>
            </div>
          </div>
        )}

        {/* Partners list */}
        {partners.map((p, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-sm">{p.member ? `${p.member.first_name} ${p.member.last_name}` : p.guest_name} {!p.member && '(guest)'}</span>
            <button className="text-red-400 hover:text-red-600" onClick={() => setPartners(ps => ps.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
          </div>
        ))}

        <Button className="w-full" loading={booking} onClick={confirmBooking}>
          Confirm Booking
        </Button>
      </div>
    </Modal>
  );
}
