import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

const STEPS = [
  'Club Details',
  'Membership Types',
  'Tee Sheet',
  'Done',
];

export function ClubSetup() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [clubForm, setClubForm] = useState({
    name: '',
    address: '',
    suburb: '',
    state: 'WA',
    postcode: '',
    phone: '',
    email: '',
    abn: '',
    primary_colour: '#16a34a',
  });

  const [membershipTypes, setMembershipTypes] = useState([
    { name: 'Full Member', annual_fee: 500, handicap_eligible: true, tee_sheet_access: true, comp_eligible: true },
    { name: 'Social Member', annual_fee: 200, handicap_eligible: false, tee_sheet_access: true, comp_eligible: false },
  ]);

  const [teeConfig, setTeeConfig] = useState({
    name: 'Main Course',
    open_time: '06:30',
    close_time: '17:00',
    slot_interval_minutes: 10,
    max_players_per_slot: 4,
    advance_booking_days: 7,
  });

  async function handleClubStep() {
    if (!clubForm.name) return;
    setSaving(true);
    const slug = clubForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (profile?.club_id) {
      await supabase.from('clubs').update({ ...clubForm, slug }).eq('id', profile.club_id);
    } else {
      const { data } = await supabase.from('clubs').insert({ ...clubForm, slug }).select().single();
      if (data) {
        await supabase.from('profiles').update({ club_id: data.id }).eq('id', profile!.id);
      }
    }
    setSaving(false);
    setStep(1);
  }

  async function handleMembershipStep() {
    if (!profile?.club_id) return;
    setSaving(true);
    await supabase.from('membership_types').insert(
      membershipTypes.map((t, i) => ({ ...t, club_id: profile.club_id, sort_order: i }))
    );
    setSaving(false);
    setStep(2);
  }

  async function handleTeeSheetStep() {
    if (!profile?.club_id) return;
    setSaving(true);
    await supabase.from('tee_sheet_configs').insert({ ...teeConfig, club_id: profile.club_id, is_active: true });
    setSaving(false);
    setStep(3);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < step ? 'bg-green-600 text-white' : i === step ? 'bg-[var(--club-primary,#16a34a)] text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`h-1 w-12 mx-1 ${i < step ? 'bg-green-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-gray-400">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>

        {/* Step 0: Club Details */}
        {step === 0 && (
          <Card>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Club Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Club Name *" value={clubForm.name} onChange={e => setClubForm(f => ({ ...f, name: e.target.value }))} className="col-span-2" placeholder="e.g. Royal Perth Golf Club" />
              <Input label="Address" value={clubForm.address} onChange={e => setClubForm(f => ({ ...f, address: e.target.value }))} className="col-span-2" />
              <Input label="Suburb" value={clubForm.suburb} onChange={e => setClubForm(f => ({ ...f, suburb: e.target.value }))} />
              <Input label="State" value={clubForm.state} onChange={e => setClubForm(f => ({ ...f, state: e.target.value }))} />
              <Input label="Phone" value={clubForm.phone} onChange={e => setClubForm(f => ({ ...f, phone: e.target.value }))} />
              <Input label="Email" value={clubForm.email} onChange={e => setClubForm(f => ({ ...f, email: e.target.value }))} />
              <Input label="ABN" value={clubForm.abn} onChange={e => setClubForm(f => ({ ...f, abn: e.target.value }))} />
              <div>
                <label className="text-sm font-medium text-gray-700">Primary Colour</label>
                <div className="flex gap-2 mt-1">
                  <input type="color" value={clubForm.primary_colour} onChange={e => setClubForm(f => ({ ...f, primary_colour: e.target.value }))} className="h-9 w-16 rounded cursor-pointer" />
                  <Input value={clubForm.primary_colour} onChange={e => setClubForm(f => ({ ...f, primary_colour: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button loading={saving} disabled={!clubForm.name} onClick={handleClubStep} icon={<ChevronRight className="w-4 h-4" />}>
                Next
              </Button>
            </div>
          </Card>
        )}

        {/* Step 1: Membership Types */}
        {step === 1 && (
          <Card>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Membership Types</h2>
            <p className="text-sm text-gray-500 mb-4">Set up at least one membership type. You can add more later.</p>
            <div className="space-y-3">
              {membershipTypes.map((t, i) => (
                <div key={i} className="border rounded-xl p-4 space-y-3">
                  <div className="flex gap-3">
                    <Input label="Name" value={t.name} onChange={e => setMembershipTypes(ts => ts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input label="Annual Fee ($)" type="number" value={t.annual_fee} onChange={e => setMembershipTypes(ts => ts.map((x, j) => j === i ? { ...x, annual_fee: parseFloat(e.target.value) } : x))} />
                  </div>
                  <div className="flex gap-4 text-sm">
                    {[['handicap_eligible', 'Handicap'], ['tee_sheet_access', 'Tee Sheet'], ['comp_eligible', 'Competitions']].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1">
                        <input type="checkbox" checked={(t as Record<string, unknown>)[key] as boolean} onChange={e => setMembershipTypes(ts => ts.map((x, j) => j === i ? { ...x, [key]: e.target.checked } : x))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button className="text-sm text-[var(--club-primary,#16a34a)] hover:underline" onClick={() => setMembershipTypes(ts => [...ts, { name: '', annual_fee: 0, handicap_eligible: true, tee_sheet_access: true, comp_eligible: true }])}>
                + Add another type
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <Button loading={saving} onClick={handleMembershipStep} icon={<ChevronRight className="w-4 h-4" />}>Next</Button>
            </div>
          </Card>
        )}

        {/* Step 2: Tee Sheet */}
        {step === 2 && (
          <Card>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Tee Sheet Configuration</h2>
            <p className="text-sm text-gray-500 mb-4">Set your tee sheet hours and booking intervals.</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name" value={teeConfig.name} onChange={e => setTeeConfig(f => ({ ...f, name: e.target.value }))} className="col-span-2" />
              <Input label="Opening Time" type="time" value={teeConfig.open_time} onChange={e => setTeeConfig(f => ({ ...f, open_time: e.target.value }))} />
              <Input label="Closing Time" type="time" value={teeConfig.close_time} onChange={e => setTeeConfig(f => ({ ...f, close_time: e.target.value }))} />
              <Input label="Slot Interval (minutes)" type="number" value={teeConfig.slot_interval_minutes} onChange={e => setTeeConfig(f => ({ ...f, slot_interval_minutes: parseInt(e.target.value) }))} />
              <Input label="Max Players/Slot" type="number" value={teeConfig.max_players_per_slot} onChange={e => setTeeConfig(f => ({ ...f, max_players_per_slot: parseInt(e.target.value) }))} />
              <Input label="Advance Booking (days)" type="number" value={teeConfig.advance_booking_days} onChange={e => setTeeConfig(f => ({ ...f, advance_booking_days: parseInt(e.target.value) }))} />
            </div>
            <div className="flex justify-end mt-6">
              <Button loading={saving} onClick={handleTeeSheetStep} icon={<ChevronRight className="w-4 h-4" />}>Next</Button>
            </div>
          </Card>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <Card className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">You're all set!</h2>
            <p className="text-sm text-gray-500 mt-2">Your club is configured. Next step: import your members.</p>
            <Button className="mt-6" onClick={() => navigate('/admin/members?action=import')}>
              Import Members →
            </Button>
            <button className="block w-full mt-3 text-sm text-gray-400 hover:underline" onClick={() => navigate('/admin')}>
              Skip for now
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
