import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Upload, Download, MoreVertical, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge, MemberStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import type { Member, MembershipType, MemberAccount, MemberAccountTransaction } from '../../types';

function MemberList({ members, loading, onEdit, onWallet }: {
  members: Member[];
  loading: boolean;
  onEdit: (m: Member) => void;
  onWallet: (m: Member) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  );

  if (members.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">No members found</div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <span>Name</span>
        <span>GolfLink</span>
        <span>Type</span>
        <span>Status</span>
        <span>Handicap</span>
        <span className="w-6" />
      </div>
      <div className="divide-y divide-gray-100">
        {members.map(m => {
          const isExpanded = expandedId === m.id;
          const acc = m.account as MemberAccount | undefined;
          return (
            <div key={m.id}>
              {/* Main row */}
              <div
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
              >
                <div>
                  <p className="font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-gray-400">{m.email}</p>
                </div>
                <span className="text-sm text-gray-600 font-mono">{m.golf_id ?? '—'}</span>
                <span className="text-sm text-gray-600">{(m.membership_type as MembershipType | undefined)?.name ?? '—'}</span>
                <MemberStatusBadge status={m.status} />
                <span className="text-sm text-gray-600">{m.handicap ?? '—'}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>

              {/* Expanded row */}
              {isExpanded && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                      <p className="text-gray-700">{m.phone ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Date of Birth</p>
                      <p className="text-gray-700">{m.date_of_birth ? format(new Date(m.date_of_birth), 'd MMM yyyy') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Renewal Date</p>
                      <p className="text-gray-700">{m.renewal_date ? format(new Date(m.renewal_date as string), 'd MMM yyyy') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Join Date</p>
                      <p className="text-gray-700">{m.join_date ? format(new Date(m.join_date as string), 'd MMM yyyy') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Address</p>
                      <p className="text-gray-700">{[m.address, m.suburb, m.state, m.postcode].filter(Boolean).join(', ') || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Wallet (Credits / Prize)</p>
                      <button className="text-blue-600 hover:underline" onClick={e => { e.stopPropagation(); onWallet(m); }}>
                        ${(acc?.credit_balance ?? 0).toFixed(2)} / ${(acc?.prize_balance ?? 0).toFixed(2)}
                      </button>
                    </div>
                    {m.notes && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                        <p className="text-gray-700">{m.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                      onClick={e => { e.stopPropagation(); onEdit(m); }}
                    >
                      Edit Member
                    </button>
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

export function AdminMembers() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletMember, setWalletMember] = useState<Member | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<MemberAccountTransaction[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.club_id) {
      fetchMembers();
      fetchMembershipTypes();
    }
    if (searchParams.get('action') === 'add') setShowAddModal(true);
  }, [profile?.club_id]);

  async function fetchMembers() {
    setLoading(true);
    const query = supabase
      .from('members')
      .select('*, membership_type:membership_types(name, annual_fee), account:member_accounts(credit_balance, prize_balance)')
      .eq('club_id', profile!.club_id!)
      .order('last_name');

    const { data } = await query;
    setMembers(data ?? []);
    setLoading(false);
  }

  async function fetchMembershipTypes() {
    const { data } = await supabase
      .from('membership_types')
      .select('*')
      .eq('club_id', profile!.club_id!)
      .order('sort_order');
    setMembershipTypes(data ?? []);
  }

  async function openWallet(member: Member) {
    setWalletMember(member);
    const { data } = await supabase
      .from('member_account_transactions')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setWalletTransactions(data ?? []);
    setShowWalletModal(true);
  }

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const nameMatch = `${m.first_name} ${m.last_name}`.toLowerCase().includes(q);
    const emailMatch = m.email?.toLowerCase().includes(q) ?? false;
    const golfIdMatch = m.golf_id?.toLowerCase().includes(q) ?? false;
    const statusMatch = !statusFilter || m.status === statusFilter;
    return (nameMatch || emailMatch || golfIdMatch) && statusMatch;
  });

  function exportCSV() {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Golf ID', 'Membership Type', 'Status', 'Handicap', 'Renewal Date'];
    const rows = filtered.map(m => [
      m.first_name, m.last_name, m.email ?? '', m.phone ?? '', m.golf_id ?? '',
      (m.membership_type as MembershipType | undefined)?.name ?? '',
      m.status, m.handicap ?? '', m.renewal_date ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'members.csv'; a.click();
  }

  if (!profile?.club_id) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<Upload className="w-4 h-4" />} onClick={() => setShowImportModal(true)}>
            Import CSV
          </Button>
          <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportCSV}>
            Export
          </Button>
          <Button icon={<UserPlus className="w-4 h-4" />} size="sm" onClick={() => setShowAddModal(true)}>
            Add Member
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-primary,#16a34a)]"
              placeholder="Search by name, email, or Golf ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--club-primary,#16a34a)] bg-white"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
            <option value="resigned">Resigned</option>
            <option value="deceased">Deceased</option>
          </select>
          <span className="text-sm text-gray-500 flex items-center">{filtered.length} members</span>
        </div>
      </Card>

      {/* Members List */}
      <MemberList
        members={filtered}
        loading={loading}
        onEdit={m => setSelectedMember(m)}
        onWallet={m => openWallet(m)}
      />

      {/* Member Edit Modal */}
      {selectedMember && (
        <MemberEditModal
          member={selectedMember}
          membershipTypes={membershipTypes}
          clubId={profile!.club_id!}
          onClose={() => setSelectedMember(null)}
          onSave={() => { setSelectedMember(null); fetchMembers(); }}
        />
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <MemberEditModal
          member={null}
          membershipTypes={membershipTypes}
          clubId={profile!.club_id!}
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); fetchMembers(); }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <CSVImportModal
          clubId={profile!.club_id!}
          membershipTypes={membershipTypes}
          onClose={() => setShowImportModal(false)}
          onImport={() => { setShowImportModal(false); fetchMembers(); }}
        />
      )}

      {/* Wallet Modal */}
      {showWalletModal && walletMember && (
        <Modal
          open={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          title={`Wallet — ${walletMember.first_name} ${walletMember.last_name}`}
          size="lg"
        >
          <WalletView member={walletMember} transactions={walletTransactions} clubId={profile!.club_id!} onRefresh={() => openWallet(walletMember)} />
        </Modal>
      )}
    </div>
  );
}

// ─── Member Edit Modal ───────────────────────────────────────────────────────
function MemberEditModal({
  member,
  membershipTypes,
  clubId,
  onClose,
  onSave,
}: {
  member: Member | null;
  membershipTypes: MembershipType[];
  clubId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !member;
  const [form, setForm] = useState({
    first_name: member?.first_name ?? '',
    last_name: member?.last_name ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    date_of_birth: member?.date_of_birth ?? '',
    gender: member?.gender ?? 'M',
    golf_id: member?.golf_id ?? '',
    membership_type_id: member?.membership_type_id ?? '',
    status: member?.status ?? 'active',
    join_date: member?.join_date ?? format(new Date(), 'yyyy-MM-dd'),
    renewal_date: member?.renewal_date ?? '',
    expiry_date: member?.expiry_date ?? '',
    handicap: member?.handicap?.toString() ?? '',
    address: member?.address ?? '',
    suburb: member?.suburb ?? '',
    state: member?.state ?? '',
    postcode: member?.postcode ?? '',
    notes: member?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.first_name || !form.last_name) { setError('First and last name required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      club_id: clubId,
      status: form.status as import('../../types').MemberStatus,
      handicap: form.handicap ? parseFloat(form.handicap) : null,
      date_of_birth: form.date_of_birth || null,
      renewal_date: form.renewal_date || null,
      expiry_date: form.expiry_date || null,
      join_date: form.join_date || null,
      membership_type_id: form.membership_type_id || null,
    };
    const { error: err } = isNew
      ? await supabase.from('members').insert(payload)
      : await supabase.from('members').update(payload).eq('id', member!.id);
    if (err) setError(err.message);
    else onSave();
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add Member' : 'Edit Member'} size="lg">
      {error && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <Input label="First Name *" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
        <Input label="Last Name *" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
        <Select
          label="Gender"
          value={form.gender}
          onChange={e => setForm(f => ({ ...f, gender: e.target.value as 'M' | 'F' | 'O' }))}
          options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }]}
        />
        <Input label="Golf ID (GolfLink)" value={form.golf_id} onChange={e => setForm(f => ({ ...f, golf_id: e.target.value }))} />
        <Input label="Handicap" type="number" step="0.1" value={form.handicap} onChange={e => setForm(f => ({ ...f, handicap: e.target.value }))} />
        <Select
          label="Membership Type"
          value={form.membership_type_id}
          onChange={e => setForm(f => ({ ...f, membership_type_id: e.target.value }))}
          options={[{ value: '', label: '— None —' }, ...membershipTypes.map(t => ({ value: t.id, label: t.name }))]}
        />
        <Select
          label="Status"
          value={form.status}
          onChange={e => setForm(f => ({ ...f, status: e.target.value as import('../../types').MemberStatus }))}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'resigned', label: 'Resigned' },
            { value: 'deceased', label: 'Deceased' },
          ]}
        />
        <Input label="Join Date" type="date" value={form.join_date} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))} />
        <Input label="Renewal Date" type="date" value={form.renewal_date} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))} />
        <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="col-span-2" />
        <Input label="Suburb" value={form.suburb} onChange={e => setForm(f => ({ ...f, suburb: e.target.value }))} />
        <Input label="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
      </div>
      <div className="mt-4">
        <Textarea label="Admin Notes" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={saving} onClick={handleSave}>{isNew ? 'Add Member' : 'Save Changes'}</Button>
      </div>
    </Modal>
  );
}

// ─── CSV Import Modal ────────────────────────────────────────────────────────
function CSVImportModal({
  clubId,
  membershipTypes,
  onClose,
  onImport,
}: {
  clubId: string;
  membershipTypes: MembershipType[];
  onClose: () => void;
  onImport: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const targetFields = [
    { value: '', label: '— Skip —' },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'date_of_birth', label: 'Date of Birth' },
    { value: 'gender', label: 'Gender' },
    { value: 'golf_id', label: 'Golf ID' },
    { value: 'handicap', label: 'Handicap' },
    { value: 'status', label: 'Status' },
    { value: 'join_date', label: 'Join Date' },
    { value: 'renewal_date', label: 'Renewal Date' },
    { value: 'address', label: 'Address' },
    { value: 'suburb', label: 'Suburb' },
    { value: 'state', label: 'State' },
    { value: 'postcode', label: 'Postcode' },
  ];

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const hdrs = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return Object.fromEntries(hdrs.map((h, i) => [h, vals[i] ?? '']));
      });
      setHeaders(hdrs);
      setCsvRows(rows);
      // Auto-map common headers
      const autoMap: Record<string, string> = {};
      hdrs.forEach(h => {
        const lower = h.toLowerCase();
        if (lower.includes('first')) autoMap[h] = 'first_name';
        else if (lower.includes('last')) autoMap[h] = 'last_name';
        else if (lower.includes('email')) autoMap[h] = 'email';
        else if (lower.includes('phone') || lower.includes('mobile')) autoMap[h] = 'phone';
        else if (lower.includes('golf') || lower.includes('golflink') || lower.includes('golfid')) autoMap[h] = 'golf_id';
        else if (lower.includes('handicap') || lower.includes('hcp')) autoMap[h] = 'handicap';
        else if (lower.includes('dob') || lower.includes('birth')) autoMap[h] = 'date_of_birth';
        else autoMap[h] = '';
      });
      setMapping(autoMap);
      setStep('preview');
    };
    reader.readAsText(file);
  }

  async function runImport() {
    setImporting(true);
    let created = 0, skipped = 0;
    const errors: string[] = [];
    const defaultType = membershipTypes[0]?.id;

    for (const row of csvRows.slice(0, 500)) {
      const mapped: Record<string, string | number | null> = { club_id: clubId, status: 'active', membership_type_id: defaultType ?? null };
      for (const [header, field] of Object.entries(mapping)) {
        if (field && row[header] !== undefined) {
          if (field === 'handicap') mapped[field] = row[header] ? parseFloat(row[header]) : null;
          else mapped[field] = row[header] || null;
        }
      }
      if (!mapped.first_name || !mapped.last_name) { skipped++; continue; }
      const { error } = await supabase.from('members').insert(mapped);
      if (error) errors.push(`${mapped.first_name} ${mapped.last_name}: ${error.message}`);
      else created++;
    }

    setImportResult({ created, skipped, errors });
    setStep('done');
    setImporting(false);
  }

  return (
    <Modal open onClose={onClose} title="Import Members from CSV" size="xl">
      {step === 'upload' && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-[var(--club-primary,#16a34a)] transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById('csv-input')?.click()}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-700">Drop your CSV file here or click to browse</p>
          <p className="text-sm text-gray-400 mt-1">Export from MiClub or any spreadsheet</p>
          <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{csvRows.length} rows found. Map columns to fields:</p>
          <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {headers.map(h => (
              <div key={h} className="flex items-center gap-2">
                <span className="text-sm text-gray-600 min-w-[120px] truncate">{h}</span>
                <select
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1"
                  value={mapping[h] ?? ''}
                  onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                >
                  {targetFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            <Button loading={importing} onClick={runImport}>Import {csvRows.length} Members</Button>
          </div>
        </div>
      )}

      {step === 'done' && importResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
              <p className="text-sm text-green-600">Created</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
              <p className="text-sm text-amber-600">Skipped</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{importResult.errors.length}</p>
              <p className="text-sm text-red-600">Errors</p>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              {importResult.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={onImport}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Wallet View ─────────────────────────────────────────────────────────────
function WalletView({
  member,
  transactions,
  clubId,
  onRefresh,
}: {
  member: Member;
  transactions: MemberAccountTransaction[];
  clubId: string;
  onRefresh: () => void;
}) {
  const acc = member.account as MemberAccount | undefined;
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpNote, setTopUpNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleTopUp() {
    if (!topUpAmount || isNaN(parseFloat(topUpAmount))) return;
    setSaving(true);
    const amount = parseFloat(topUpAmount);
    await supabase.from('member_account_transactions').insert({
      member_id: member.id,
      club_id: clubId,
      balance_type: 'credit',
      type: 'credit',
      category: 'manual',
      amount,
      description: topUpNote || 'Manual top-up',
    });
    // Update balance
    const newBalance = (acc?.credit_balance ?? 0) + amount;
    await supabase.from('member_accounts').update({ credit_balance: newBalance }).eq('member_id', member.id);
    setSaving(false);
    setShowTopUp(false);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-600 font-medium">Credit Balance</p>
          <p className="text-3xl font-bold text-blue-800">${(acc?.credit_balance ?? 0).toFixed(2)}</p>
          <p className="text-xs text-blue-500 mt-1">Used for bookings</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-sm text-purple-600 font-medium">Prize Balance</p>
          <p className="text-3xl font-bold text-purple-800">${(acc?.prize_balance ?? 0).toFixed(2)}</p>
          <p className="text-xs text-purple-500 mt-1">Shop credits only</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShowTopUp(!showTopUp)}>Add Credits</Button>
      </div>

      {showTopUp && (
        <div className="bg-gray-50 p-4 rounded-lg flex gap-3">
          <Input placeholder="Amount $" type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} />
          <Input placeholder="Note (optional)" value={topUpNote} onChange={e => setTopUpNote(e.target.value)} />
          <Button loading={saving} onClick={handleTopUp} size="sm">Add</Button>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2">Transaction History</h3>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No transactions yet</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{tx.description ?? tx.category}</p>
                  <p className="text-xs text-gray-400">{format(new Date(tx.created_at), 'd MMM yyyy')} · {tx.balance_type}</p>
                </div>
                <span className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
