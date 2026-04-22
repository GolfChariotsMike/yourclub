import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { MemberStatusBadge } from '../../components/ui/Badge';
import type { Member, MemberAccount, MemberAccountTransaction, MembershipType } from '../../types';

export function MemberProfile() {
  const { profile, signOut } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [account, setAccount] = useState<MemberAccount | null>(null);
  const [transactions, setTransactions] = useState<MemberAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.member_id) fetchData();
  }, [profile?.member_id]);

  async function fetchData() {
    setLoading(true);
    const [memberRes, accountRes, txRes] = await Promise.all([
      supabase.from('members').select('*, membership_type:membership_types(name, annual_fee)').eq('id', profile!.member_id!).single(),
      supabase.from('member_accounts').select('*').eq('member_id', profile!.member_id!).single(),
      supabase.from('member_account_transactions').select('*').eq('member_id', profile!.member_id!).order('created_at', { ascending: false }).limit(20),
    ]);
    setMember(memberRes.data);
    setAccount(accountRes.data);
    setTransactions(txRes.data ?? []);
    setLoading(false);
  }

  if (loading) return <div className="p-4 flex items-center justify-center h-60"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--club-primary,#16a34a)]" /></div>;
  if (!member) return <div className="p-4 text-gray-500">Profile not found</div>;

  const mt = member.membership_type as MembershipType | undefined;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

      {/* Member card */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 text-white border-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold">{member.first_name} {member.last_name}</p>
            <p className="text-sm opacity-70">{mt?.name ?? 'Member'}</p>
            <p className="text-xs opacity-50 mt-1">Golf ID: {member.golf_id ?? 'N/A'}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{member.handicap?.toFixed(1) ?? '—'}</p>
            <p className="text-xs opacity-60">Handicap Index</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-xs opacity-60">
          <span>Member since {member.join_date ? format(new Date(member.join_date), 'MMM yyyy') : '—'}</span>
          <span>Renews {member.renewal_date ? format(new Date(member.renewal_date), 'd MMM yyyy') : '—'}</span>
        </div>
      </Card>

      {/* Status */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Membership Details</p>
          <MemberStatusBadge status={member.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Email', value: member.email ?? '—' },
            { label: 'Phone', value: member.phone ?? '—' },
            { label: 'Date of Birth', value: member.date_of_birth ? format(new Date(member.date_of_birth), 'd MMM yyyy') : '—' },
            { label: 'Gender', value: member.gender === 'M' ? 'Male' : member.gender === 'F' ? 'Female' : member.gender ?? '—' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="font-medium text-gray-800">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Handicap info */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Handicap</p>
          {member.handicap_updated_at && (
            <p className="text-xs text-gray-400">Updated {format(new Date(member.handicap_updated_at), 'd MMM yyyy')}</p>
          )}
        </div>
        <p className="text-4xl font-bold text-[var(--club-primary,#16a34a)]">{member.handicap?.toFixed(1) ?? '—'}</p>
        {!member.golf_id && (
          <p className="text-xs text-amber-600 mt-2">⚠️ No Golf ID linked — handicap is manually managed</p>
        )}
      </Card>

      {/* Wallet */}
      <Card>
        <p className="text-sm font-semibold text-gray-700 mb-3">My Wallet</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 p-3 rounded-xl">
            <p className="text-xs text-blue-600">Credit Balance</p>
            <p className="text-xl font-bold text-blue-800">${(account?.credit_balance ?? 0).toFixed(2)}</p>
            <p className="text-xs text-blue-400">For bookings</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl">
            <p className="text-xs text-purple-600">Prize Balance</p>
            <p className="text-xl font-bold text-purple-800">${(account?.prize_balance ?? 0).toFixed(2)}</p>
            <p className="text-xs text-purple-400">Shop credits</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent Transactions</p>
        {transactions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-xs font-medium text-gray-700">{tx.description ?? tx.category}</p>
                  <p className="text-xs text-gray-400">{format(new Date(tx.created_at), 'd MMM yyyy')} · {tx.balance_type}</p>
                </div>
                <span className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Sign out */}
      <button
        className="w-full py-3 text-sm text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
        onClick={signOut}
      >
        Sign Out
      </button>
    </div>
  );
}
