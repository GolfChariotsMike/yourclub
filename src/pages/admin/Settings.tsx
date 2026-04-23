import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Globe, CreditCard, Wifi } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import type { Club, MembershipType, TeeSheetConfig, Course, CourseTee } from '../../types';

export function AdminSettings() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('club');
  const [club, setClub] = useState<Club | null>(null);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [teeConfigs, setTeeConfigs] = useState<TeeSheetConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.club_id) {
      fetchAll(profile.club_id);
    }
  }, [profile?.club_id]);

  async function fetchAll(clubId: string) {
    const [clubRes, typesRes, teesRes] = await Promise.all([
      supabase.from('clubs').select('*').eq('id', clubId).single(),
      supabase.from('membership_types').select('*').eq('club_id', clubId).order('sort_order'),
      supabase.from('tee_sheet_configs').select('*').eq('club_id', clubId),
    ]);
    setClub(clubRes.data);
    setMembershipTypes(typesRes.data ?? []);
    setTeeConfigs(teesRes.data ?? []);
  }

  const tabs = [
    { id: 'club', label: 'Club Profile' },
    { id: 'membership', label: 'Membership Types' },
    { id: 'teesheet', label: 'Tee Sheet' },
    { id: 'integrations', label: 'Integrations' },
  ];

  if (!profile?.club_id) return (<div className="p-6 flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-[var(--club-primary,#16a34a)] text-[var(--club-primary,#16a34a)]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'club' && club && (
        <ClubProfileSettings
          club={club}
          onSave={async (updates) => {
            setSaving(true);
            await supabase.from('clubs').update(updates).eq('id', club.id);
            setClub({ ...club, ...updates });
            setSaving(false);
          }}
          saving={saving}
        />
      )}

      {activeTab === 'membership' && (
        <MembershipTypeSettings
          clubId={profile!.club_id!}
          types={membershipTypes}
          onRefresh={() => fetchAll(profile!.club_id!)}
        />
      )}

      {activeTab === 'teesheet' && (
        <TeeSheetSettings
          clubId={profile!.club_id!}
          configs={teeConfigs}
          onRefresh={() => fetchAll(profile!.club_id!)}
        />
      )}

      {activeTab === 'integrations' && club && (
        <IntegrationsSettings
          club={club}
          onSave={async (updates) => {
            setSaving(true);
            await supabase.from('clubs').update(updates).eq('id', club.id);
            setClub({ ...club, ...updates });
            setSaving(false);
          }}
          saving={saving}
        />
      )}
    </div>
  );
}

function ClubProfileSettings({ club, onSave, saving }: { club: Club; onSave: (u: Partial<Club>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    name: club.name,
    primary_colour: club.primary_colour,
    address: club.address ?? '',
    suburb: club.suburb ?? '',
    state: club.state ?? '',
    postcode: club.postcode ?? '',
    phone: club.phone ?? '',
    email: club.email ?? '',
    website: club.website ?? '',
    abn: club.abn ?? '',
    gst_registered: club.gst_registered,
    financial_year_start: club.financial_year_start,
    welcome_message: club.welcome_message ?? '',
  });

  return (
    <Card>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Club Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="col-span-2" />
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700">Primary Colour (member portal branding)</label>
          <div className="flex items-center gap-3 mt-1">
            <input type="color" value={form.primary_colour} onChange={e => setForm(f => ({ ...f, primary_colour: e.target.value }))} className="h-10 w-20 rounded cursor-pointer" />
            <Input value={form.primary_colour} onChange={e => setForm(f => ({ ...f, primary_colour: e.target.value }))} className="w-32" />
            <div className="w-10 h-10 rounded-lg border" style={{ backgroundColor: form.primary_colour }} />
          </div>
        </div>
        <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="col-span-2" />
        <Input label="Suburb" value={form.suburb} onChange={e => setForm(f => ({ ...f, suburb: e.target.value }))} />
        <Input label="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
        <Input label="Postcode" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} />
        <Input label="Website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
        <Input label="ABN" value={form.abn} onChange={e => setForm(f => ({ ...f, abn: e.target.value }))} />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="gst" checked={form.gst_registered} onChange={e => setForm(f => ({ ...f, gst_registered: e.target.checked }))} />
          <label htmlFor="gst" className="text-sm font-medium text-gray-700">GST Registered</label>
        </div>
        <Textarea label="Member Portal Welcome Message" value={form.welcome_message} onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))} className="col-span-2" />
      </div>
      <div className="flex justify-end mt-4">
        <Button loading={saving} icon={<Save className="w-4 h-4" />} onClick={() => onSave(form)}>Save Changes</Button>
      </div>
    </Card>
  );
}

function MembershipTypeSettings({ clubId, types, onRefresh }: { clubId: string; types: MembershipType[]; onRefresh: () => void }) {
  const [editType, setEditType] = useState<MembershipType | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function deleteType(id: string) {
    if (!confirm('Delete this membership type? Members must be reassigned first.')) return;
    await supabase.from('membership_types').delete().eq('id', id);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button icon={<Plus className="w-4 h-4" />} size="sm" onClick={() => setShowNew(true)}>Add Type</Button>
      </div>
      {types.map((t, i) => (
        <Card key={t.id} className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{t.name}</p>
            <p className="text-sm text-gray-500">Annual: ${t.annual_fee} · {t.comp_eligible ? '✓ Comp' : '✗ Comp'} · {t.handicap_eligible ? '✓ Handicap' : '✗ Handicap'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditType(t)}>Edit</Button>
            <Button variant="danger" size="sm" onClick={() => deleteType(t.id)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        </Card>
      ))}

      {(showNew || editType) && (
        <MembershipTypeForm
          clubId={clubId}
          type={editType}
          onClose={() => { setShowNew(false); setEditType(null); }}
          onSave={() => { setShowNew(false); setEditType(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function MembershipTypeForm({ clubId, type, onClose, onSave }: { clubId: string; type: MembershipType | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: type?.name ?? '',
    description: type?.description ?? '',
    annual_fee: type?.annual_fee ?? 0,
    handicap_eligible: type?.handicap_eligible ?? true,
    tee_sheet_access: type?.tee_sheet_access ?? true,
    comp_eligible: type?.comp_eligible ?? true,
    sort_order: type?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    if (type) {
      await supabase.from('membership_types').update(form).eq('id', type.id);
    } else {
      await supabase.from('membership_types').insert({ ...form, club_id: clubId });
    }
    setSaving(false);
    onSave();
  }

  return (
    <Modal open onClose={onClose} title={type ? 'Edit Membership Type' : 'New Membership Type'}>
      <div className="space-y-4">
        <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Full Member, Social, Junior" />
        <Input label="Annual Fee ($)" type="number" value={form.annual_fee} onChange={e => setForm(f => ({ ...f, annual_fee: parseFloat(e.target.value) }))} />
        <div className="space-y-2">
          {[
            { key: 'handicap_eligible', label: 'Handicap eligible' },
            { key: 'tee_sheet_access', label: 'Tee sheet access' },
            { key: 'comp_eligible', label: 'Competition eligible' },
          ].map(opt => (
            <label key={opt.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={(form as Record<string, unknown>)[opt.key] as boolean} onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))} />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function TeeSheetSettings({ clubId, configs, onRefresh }: { clubId: string; configs: TeeSheetConfig[]; onRefresh: () => void }) {
  const [editConfig, setEditConfig] = useState<TeeSheetConfig | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data ?? []));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button icon={<Plus className="w-4 h-4" />} size="sm" onClick={() => setShowNew(true)}>Add Tee Sheet</Button>
      </div>
      {configs.map(c => (
        <Card key={c.id} className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{c.name}</p>
            <p className="text-sm text-gray-500">{c.open_time}–{c.close_time} · {c.slot_interval_minutes}min intervals · {c.max_players_per_slot} max/slot</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditConfig(c)}>Edit</Button>
        </Card>
      ))}

      {(showNew || editConfig) && (
        <TeeSheetConfigForm
          clubId={clubId}
          config={editConfig}
          courses={courses}
          onClose={() => { setShowNew(false); setEditConfig(null); }}
          onSave={() => { setShowNew(false); setEditConfig(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

function TeeSheetConfigForm({ clubId, config, courses, onClose, onSave }: { clubId: string; config: TeeSheetConfig | null; courses: Course[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: config?.name ?? 'Main Course',
    course_id: config?.course_id ?? '',
    open_time: config?.open_time ?? '06:30',
    close_time: config?.close_time ?? '16:00',
    slot_interval_minutes: config?.slot_interval_minutes ?? 10,
    max_players_per_slot: config?.max_players_per_slot ?? 4,
    booking_cost_credits: config?.booking_cost_credits ?? 0,
    advance_booking_days: config?.advance_booking_days ?? 7,
    same_day_cutoff_minutes: config?.same_day_cutoff_minutes ?? 30,
    guests_per_booking: config?.guests_per_booking ?? 2,
    is_active: config?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    if (config) {
      await supabase.from('tee_sheet_configs').update(form).eq('id', config.id);
    } else {
      await supabase.from('tee_sheet_configs').insert({ ...form, club_id: clubId });
    }
    setSaving(false);
    onSave();
  }

  return (
    <Modal open onClose={onClose} title={config ? 'Edit Tee Sheet' : 'New Tee Sheet'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="col-span-2" />
        <Select label="Course" value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))} options={[{ value: '', label: '— Select —' }, ...courses.map(c => ({ value: c.id, label: c.name }))]} className="col-span-2" />
        <Input label="Open Time" type="time" value={form.open_time} onChange={e => setForm(f => ({ ...f, open_time: e.target.value }))} />
        <Input label="Close Time" type="time" value={form.close_time} onChange={e => setForm(f => ({ ...f, close_time: e.target.value }))} />
        <Input label="Slot Interval (minutes)" type="number" value={form.slot_interval_minutes} onChange={e => setForm(f => ({ ...f, slot_interval_minutes: parseInt(e.target.value) }))} />
        <Input label="Max Players/Slot" type="number" value={form.max_players_per_slot} onChange={e => setForm(f => ({ ...f, max_players_per_slot: parseInt(e.target.value) }))} />
        <Input label="Booking Cost (credits)" type="number" value={form.booking_cost_credits} onChange={e => setForm(f => ({ ...f, booking_cost_credits: parseFloat(e.target.value) }))} />
        <Input label="Advance Booking (days)" type="number" value={form.advance_booking_days} onChange={e => setForm(f => ({ ...f, advance_booking_days: parseInt(e.target.value) }))} />
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={saving} onClick={handleSave}>Save</Button>
      </div>
    </Modal>
  );
}

function IntegrationsSettings({ club, onSave, saving }: { club: Club; onSave: (u: Partial<Club>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    ga_connect_api_key: club.ga_connect_api_key ?? '',
    ga_connect_club_id: club.ga_connect_club_id ?? '',
    stripe_publishable_key: club.stripe_publishable_key ?? '',
    stripe_secret_key: club.stripe_secret_key ?? '',
  });

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold">GA CONNECT (Golf Australia)</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Enter your GA CONNECT API credentials to enable handicap sync and score submission. If not configured, manual handicap mode is used.</p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="GA CONNECT API Key" type="password" value={form.ga_connect_api_key} onChange={e => setForm(f => ({ ...f, ga_connect_api_key: e.target.value }))} />
          <Input label="GA Club ID" value={form.ga_connect_club_id} onChange={e => setForm(f => ({ ...f, ga_connect_club_id: e.target.value }))} />
        </div>
        {!club.ga_connect_api_key && (
          <div className="mt-3 p-3 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-700">⚠️ Manual handicap mode — GA CONNECT not configured. Handicaps must be entered manually by admins.</p>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">Stripe (Payments)</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Connect your Stripe account to accept membership payments and tee time fees. All payments go directly to your Stripe account.</p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Stripe Publishable Key" value={form.stripe_publishable_key} onChange={e => setForm(f => ({ ...f, stripe_publishable_key: e.target.value }))} placeholder="pk_live_..." />
          <Input label="Stripe Secret Key" type="password" value={form.stripe_secret_key} onChange={e => setForm(f => ({ ...f, stripe_secret_key: e.target.value }))} placeholder="sk_live_..." />
        </div>
        {!club.stripe_publishable_key && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Stripe not configured — invoice payment links will not work. Admin can still mark invoices as paid manually.</p>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button loading={saving} icon={<Save className="w-4 h-4" />} onClick={() => onSave(form)}>Save Integrations</Button>
      </div>
    </div>
  );
}
