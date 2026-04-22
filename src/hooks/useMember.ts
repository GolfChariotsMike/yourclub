import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../types';

export function useMember(memberId?: string) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    fetchMember(memberId);
  }, [memberId]);

  async function fetchMember(id: string) {
    setLoading(true);
    const { data } = await supabase
      .from('members')
      .select('*, membership_type:membership_types(*), account:member_accounts(*)')
      .eq('id', id)
      .single();
    setMember(data);
    setLoading(false);
  }

  return { member, loading, refetch: () => memberId && fetchMember(memberId) };
}

export function useMembers(clubId?: string) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setLoading(false);
      return;
    }
    fetchMembers(clubId);
  }, [clubId]);

  async function fetchMembers(id: string) {
    setLoading(true);
    const { data } = await supabase
      .from('members')
      .select('*, membership_type:membership_types(name, annual_fee), account:member_accounts(credit_balance, prize_balance)')
      .eq('club_id', id)
      .order('last_name');
    setMembers(data ?? []);
    setLoading(false);
  }

  return { members, loading, refetch: () => clubId && fetchMembers(clubId) };
}
