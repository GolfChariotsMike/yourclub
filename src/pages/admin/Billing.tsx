import { useEffect, useState } from 'react';
import { DollarSign, Plus, Send, CheckCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { InvoiceStatusBadge } from '../../components/ui/Badge';
import type { Invoice, Member, MembershipType } from '../../types';

export function AdminBilling() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<(Invoice & { member: Member; membership_type: MembershipType })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showGenModal, setShowGenModal] = useState(false);

  useEffect(() => {
    if (profile?.club_id) fetchInvoices();
  }, [profile?.club_id, statusFilter]);

  async function fetchInvoices() {
    setLoading(true);
    let query = supabase
      .from('invoices')
      .select('*, member:members(first_name, last_name, email), membership_type:membership_types(name)')
      .eq('club_id', profile!.club_id!)
      .order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data } = await query;
    setInvoices(data ?? []);
    setLoading(false);
  }

  async function markPaid(invoiceId: string, memberId: string, amount: number) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: 'manual' }).eq('id', invoiceId);
    // Update member status to active
    await supabase.from('members').update({ status: 'active' }).eq('id', memberId).eq('status', 'suspended');
    fetchInvoices();
  }

  const stats = {
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    outstanding: invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowGenModal(true)}>Generate Invoices</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><div className="text-center"><p className="text-sm text-gray-500">Paid</p><p className="text-2xl font-bold text-green-700">${stats.paid.toFixed(2)}</p></div></Card>
        <Card><div className="text-center"><p className="text-sm text-gray-500">Outstanding</p><p className="text-2xl font-bold text-blue-700">${stats.outstanding.toFixed(2)}</p></div></Card>
        <Card><div className="text-center"><p className="text-sm text-gray-500">Overdue</p><p className="text-2xl font-bold text-red-700">${stats.overdue.toFixed(2)}</p></div></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        {['', 'draft', 'sent', 'paid', 'overdue', 'void'].map(s => (
          <button
            key={s}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${statusFilter === s ? 'bg-[var(--club-primary,#16a34a)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Member', 'Type', 'Amount', 'Due Date', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto" /></td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No invoices found</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-800">{inv.member?.first_name} {inv.member?.last_name}</p>
                  <p className="text-xs text-gray-400">{inv.member?.email}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{inv.membership_type?.name ?? '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold">${inv.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{inv.due_date ? format(new Date(inv.due_date), 'd MMM yyyy') : '—'}</td>
                <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {inv.status !== 'paid' && inv.status !== 'void' && (
                      <button
                        className="text-xs text-green-600 hover:underline"
                        onClick={() => markPaid(inv.id, inv.member_id, inv.amount)}
                      >
                        Mark Paid
                      </button>
                    )}
                    {inv.status !== 'void' && (
                      <button
                        className="text-xs text-gray-400 hover:text-red-500 hover:underline"
                        onClick={async () => { await supabase.from('invoices').update({ status: 'void' }).eq('id', inv.id); fetchInvoices(); }}
                      >
                        Void
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showGenModal && (
        <GenerateInvoicesModal
          clubId={profile!.club_id!}
          onClose={() => setShowGenModal(false)}
          onGenerate={() => { setShowGenModal(false); fetchInvoices(); }}
        />
      )}
    </div>
  );
}

function GenerateInvoicesModal({
  clubId,
  onClose,
  onGenerate,
}: {
  clubId: string;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const [members, setMembers] = useState<(Member & { membership_type: MembershipType })[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    supabase
      .from('members')
      .select('*, membership_type:membership_types(name, annual_fee)')
      .eq('club_id', clubId)
      .in('status', ['active', 'pending'])
      .then(({ data }) => {
        setMembers(data ?? []);
        setSelected(new Set((data ?? []).map((m: Member) => m.id)));
      });
  }, []);

  async function generate() {
    setGenerating(true);
    const inserts = members
      .filter(m => selected.has(m.id))
      .map(m => ({
        club_id: clubId,
        member_id: m.id,
        membership_type_id: m.membership_type_id,
        amount: (m.membership_type as MembershipType | undefined)?.annual_fee ?? 0,
        status: 'sent',
        due_date: dueDate,
        billing_cycle: 'annual',
      }));

    await supabase.from('invoices').insert(inserts);
    setGenerating(false);
    onGenerate();
  }

  const total = members.filter(m => selected.has(m.id)).reduce((s, m) => s + ((m.membership_type as MembershipType | undefined)?.annual_fee ?? 0), 0);

  return (
    <Modal open onClose={onClose} title="Generate Invoices" size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{selected.size} of {members.length} members selected · Total: ${total.toFixed(2)}</p>
          <div className="flex gap-2">
            <button className="text-sm text-blue-600 hover:underline" onClick={() => setSelected(new Set(members.map(m => m.id)))}>Select All</button>
            <button className="text-sm text-gray-400 hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
        <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
          {members.map(m => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
              onClick={() => setSelected(s => {
                const n = new Set(s);
                if (n.has(m.id)) n.delete(m.id); else n.add(m.id);
                return n;
              })}
            >
              <input type="checkbox" readOnly checked={selected.has(m.id)} className="pointer-events-none" />
              <span className="flex-1 text-sm">{m.first_name} {m.last_name}</span>
              <span className="text-sm text-gray-500">{(m.membership_type as MembershipType | undefined)?.name}</span>
              <span className="text-sm font-medium">${(m.membership_type as MembershipType | undefined)?.annual_fee?.toFixed(2) ?? '0.00'}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={generating} onClick={generate}>Generate {selected.size} Invoices</Button>
        </div>
      </div>
    </Modal>
  );
}
