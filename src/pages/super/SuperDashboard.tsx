import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Users, ChevronRight, X, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  email?: string;
  primary_colour: string;
  created_at: string;
  member_count?: number;
}

interface NewClubForm {
  name: string;
  slug: string;
  email: string;
  primary_colour: string;
  admin_email: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
}

export function SuperDashboard() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewClub, setShowNewClub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<NewClubForm>({
    name: '',
    slug: '',
    email: '',
    primary_colour: '#16a34a',
    admin_email: '',
    admin_password: '',
    admin_first_name: '',
    admin_last_name: '',
  });

  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    setLoading(true);
    const { data } = await supabase
      .from('clubs')
      .select('id, name, slug, email, primary_colour, created_at')
      .order('created_at', { ascending: false });

    if (data) {
      // Get member counts
      const clubsWithCounts = await Promise.all(
        data.map(async (club) => {
          const { count } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', club.id)
            .eq('status', 'active');
          return { ...club, member_count: count ?? 0 };
        })
      );
      setClubs(clubsWithCounts);
    }
    setLoading(false);
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function createClub() {
    setError('');
    setSaving(true);

    try {
      // 1. Create the club
      const { data: club, error: clubErr } = await supabase
        .from('clubs')
        .insert({
          name: form.name,
          slug: form.slug,
          email: form.email || null,
          primary_colour: form.primary_colour,
        })
        .select()
        .single();

      if (clubErr) throw new Error(`Club creation failed: ${clubErr.message}`);

      // 2. Create the admin user via edge function (needs service role)
      // We'll use Supabase signUp and then set their profile + role
      const { data: authData, error: authErr } = await supabase.auth.admin
        ? // If admin API available
          { data: null, error: new Error('use-signup') }
        : { data: null, error: new Error('use-signup') };

      // Fall back: use standard signUp
      void authData; void authErr;
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: form.admin_email,
        password: form.admin_password,
        options: {
          data: {
            first_name: form.admin_first_name,
            last_name: form.admin_last_name,
          },
        },
      });

      if (signUpErr) throw new Error(`Admin user creation failed: ${signUpErr.message}`);

      const userId = signUpData.user?.id;
      if (!userId) throw new Error('No user ID returned');

      // 3. Set profile role + club
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          club_id: club.id,
          role: 'admin',
          email: form.admin_email,
          first_name: form.admin_first_name,
          last_name: form.admin_last_name,
        });

      if (profileErr) throw new Error(`Profile setup failed: ${profileErr.message}`);

      setSuccess(`Club "${form.name}" created with admin ${form.admin_email}`);
      setShowNewClub(false);
      setForm({
        name: '', slug: '', email: '', primary_colour: '#16a34a',
        admin_email: '', admin_password: '', admin_first_name: '', admin_last_name: '',
      });
      loadClubs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">C</div>
          <div>
            <h1 className="font-bold text-gray-900">ClubHub</h1>
            <p className="text-xs text-gray-500">Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowNewClub(true)}>
            New Club
          </Button>
          <button onClick={signOut} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{clubs.length}</p>
                <p className="text-sm text-gray-500">Total Clubs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {clubs.reduce((sum, c) => sum + (c.member_count ?? 0), 0)}
                </p>
                <p className="text-sm text-gray-500">Total Active Members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Clubs list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Clubs</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : clubs.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No clubs yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first club to get started</p>
              <Button className="mt-4" size="sm" onClick={() => setShowNewClub(true)}>
                Create Club
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {clubs.map((club) => (
                <div key={club.id} className="flex items-center px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm mr-4 flex-shrink-0"
                    style={{ backgroundColor: club.primary_colour }}
                  >
                    {club.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{club.name}</p>
                    <p className="text-sm text-gray-500">
                      /{club.slug} {club.email ? `· ${club.email}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span>{club.member_count} members</span>
                    <span>{new Date(club.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-4" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Club Modal */}
      {showNewClub && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-lg">Create New Club</h2>
              <button onClick={() => { setShowNewClub(false); setError(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Club Details</p>
                <div className="space-y-3">
                  <Input
                    label="Club Name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                    placeholder="Royal Perth Golf Club"
                  />
                  <Input
                    label="Slug (URL identifier)"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="royal-perth"
                    hint="Members access portal at /login?club=slug"
                  />
                  <Input
                    label="Club Email (optional)"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="admin@club.com.au"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 block mb-1">Brand Colour</label>
                      <input
                        type="color"
                        value={form.primary_colour}
                        onChange={e => setForm(f => ({ ...f, primary_colour: e.target.value }))}
                        className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
                      />
                    </div>
                    <div className="w-12 h-12 rounded-xl mt-5 flex-shrink-0" style={{ backgroundColor: form.primary_colour }} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Club Admin Account</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="First Name"
                      value={form.admin_first_name}
                      onChange={e => setForm(f => ({ ...f, admin_first_name: e.target.value }))}
                      placeholder="John"
                    />
                    <Input
                      label="Last Name"
                      value={form.admin_last_name}
                      onChange={e => setForm(f => ({ ...f, admin_last_name: e.target.value }))}
                      placeholder="Smith"
                    />
                  </div>
                  <Input
                    label="Admin Email"
                    type="email"
                    value={form.admin_email}
                    onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))}
                    placeholder="john@club.com.au"
                  />
                  <Input
                    label="Temporary Password"
                    type="password"
                    value={form.admin_password}
                    onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    hint="The admin can change this after first login"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowNewClub(false); setError(''); }}>Cancel</Button>
              <Button
                loading={saving}
                disabled={!form.name || !form.slug || !form.admin_email || !form.admin_password}
                onClick={createClub}
              >
                Create Club
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
