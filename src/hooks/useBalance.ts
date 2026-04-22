import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MemberAccount, MemberAccountTransaction } from '../types';

export function useBalance(memberId?: string) {
  const [account, setAccount] = useState<MemberAccount | null>(null);
  const [transactions, setTransactions] = useState<MemberAccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    fetchAccount(memberId);
  }, [memberId]);

  async function fetchAccount(id: string) {
    setLoading(true);
    const [accountRes, txRes] = await Promise.all([
      supabase
        .from('member_accounts')
        .select('*')
        .eq('member_id', id)
        .single(),
      supabase
        .from('member_account_transactions')
        .select('*')
        .eq('member_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setAccount(accountRes.data);
    setTransactions(txRes.data ?? []);
    setLoading(false);
  }

  async function addTransaction(
    clubId: string,
    balanceType: 'credit' | 'prize',
    type: 'debit' | 'credit',
    category: MemberAccountTransaction['category'],
    amount: number,
    description?: string,
    referenceId?: string
  ) {
    if (!memberId) return { error: 'No member' };

    // Insert transaction
    const { error: txError } = await supabase
      .from('member_account_transactions')
      .insert({
        member_id: memberId,
        club_id: clubId,
        balance_type: balanceType,
        type,
        category,
        amount,
        description,
        reference_id: referenceId,
      });

    if (txError) return { error: txError.message };

    // Update balance
    const field = balanceType === 'credit' ? 'credit_balance' : 'prize_balance';
    const delta = type === 'credit' ? amount : -amount;

    const { error: balError } = await supabase.rpc('adjust_balance', {
      p_member_id: memberId,
      p_club_id: clubId,
      p_field: field,
      p_delta: delta,
    });

    if (!balError) {
      await fetchAccount(memberId);
    }

    return { error: balError?.message };
  }

  return { account, transactions, loading, addTransaction, refetch: () => memberId && fetchAccount(memberId) };
}
