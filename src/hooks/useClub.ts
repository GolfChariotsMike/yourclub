import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Club } from '../types';

export function useClub(clubId?: string) {
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) {
      setLoading(false);
      return;
    }
    fetchClub(clubId);
  }, [clubId]);

  async function fetchClub(id: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', id)
      .single();
    if (error) setError(error.message);
    else setClub(data);
    setLoading(false);
  }

  async function updateClub(updates: Partial<Club>) {
    if (!club) return { error: 'No club loaded' };
    const { data, error } = await supabase
      .from('clubs')
      .update(updates)
      .eq('id', club.id)
      .select()
      .single();
    if (!error && data) setClub(data);
    return { error: error?.message };
  }

  // Apply club branding as CSS variables
  useEffect(() => {
    if (club?.primary_colour) {
      document.documentElement.style.setProperty('--club-primary', club.primary_colour);
      // Generate lighter/darker variants
      document.documentElement.style.setProperty('--club-primary-light', club.primary_colour + '20');
    }
  }, [club?.primary_colour]);

  return { club, loading, error, updateClub, refetch: () => clubId && fetchClub(clubId) };
}
