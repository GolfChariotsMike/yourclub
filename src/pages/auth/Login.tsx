import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [club, setClub] = useState<{ name: string; logo_url?: string; primary_colour: string } | null>(null);

  // Try to detect club from URL slug (e.g. /login?club=royal-perth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('club');
    if (slug) {
      supabase.from('clubs').select('name, logo_url, primary_colour').eq('slug', slug).single().then(({ data }) => {
        if (data) {
          setClub(data);
          document.documentElement.style.setProperty('--club-primary', data.primary_colour);
        }
      });
    }
  }, []);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      // Check if admin or member
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').single();
      if (profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'comp_admin') {
        navigate('/admin');
      } else {
        navigate('/portal');
      }
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    });
    if (authError) setError(authError.message);
    else setMagicSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Club branding */}
        <div className="text-center mb-8">
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-20 h-20 mx-auto mb-3 rounded-full object-cover shadow" />
          ) : (
            <div
              className="w-20 h-20 mx-auto mb-3 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow"
              style={{ backgroundColor: club?.primary_colour ?? '#16a34a' }}
            >
              {club?.name?.[0] ?? 'G'}
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{club?.name ?? 'ClubHub'}</h1>
          <p className="text-sm text-gray-500">Member portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {/* Mode tabs */}
          <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'password' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setMode('password')}
            >
              Password
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'magic' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setMode('magic')}
            >
              Magic Link
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {magicSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-semibold text-gray-900">Check your email</p>
              <p className="text-sm text-gray-500 mt-1">We sent a sign-in link to <strong>{email}</strong></p>
              <button className="text-sm text-gray-400 hover:underline mt-4" onClick={() => setMagicSent(false)}>
                Try again
              </button>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <Button type="submit" className="w-full" loading={loading}>
                Sign In
              </Button>
              <button
                type="button"
                className="w-full text-sm text-gray-500 hover:text-gray-700 text-center"
                onClick={() => setMode('magic')}
              >
                Forgot password? Use magic link
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <p className="text-sm text-gray-500">Enter your email and we'll send you a sign-in link. No password needed.</p>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Button type="submit" className="w-full" loading={loading} icon={<ArrowRight className="w-4 h-4" />}>
                Send Magic Link
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Powered by ClubHub</p>
      </div>
    </div>
  );
}

// Auth callback handler
export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'comp_admin') {
          navigate('/admin');
        } else {
          navigate('/portal');
        }
      } else {
        navigate('/login');
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  );
}
