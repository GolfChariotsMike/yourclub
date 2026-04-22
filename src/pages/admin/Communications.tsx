import { useEffect, useState } from 'react';
import { Plus, Pin, Trash2, Mail, MessageSquare, AlertCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import type { NoticeboardPost, NoticeboardComment, Member } from '../../types';

export function AdminCommunications() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'noticeboard' | 'broadcast'>('noticeboard');
  const [posts, setPosts] = useState<NoticeboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [editPost, setEditPost] = useState<NoticeboardPost | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, NoticeboardComment[]>>({});

  useEffect(() => {
    if (profile?.club_id) fetchPosts();
  }, [profile?.club_id]);

  async function fetchPosts() {
    setLoading(true);
    const { data } = await supabase
      .from('noticeboard_posts')
      .select('*')
      .eq('club_id', profile!.club_id!)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  }

  async function fetchComments(postId: string) {
    const { data } = await supabase
      .from('noticeboard_comments')
      .select('*, member:members(first_name, last_name)')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at');
    setComments(c => ({ ...c, [postId]: data ?? [] }));
  }

  async function togglePin(post: NoticeboardPost) {
    await supabase.from('noticeboard_posts').update({ pinned: !post.pinned }).eq('id', post.id);
    fetchPosts();
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return;
    await supabase.from('noticeboard_posts').delete().eq('id', id);
    fetchPosts();
  }

  async function deleteComment(commentId: string, postId: string) {
    await supabase.from('noticeboard_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId);
    fetchComments(postId);
  }

  const postTypeColors: Record<string, BadgeVariant> = {
    general: 'gray',
    results: 'success',
    alert: 'danger',
    news: 'info',
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        {activeTab === 'noticeboard' && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowNewPost(true)}>New Post</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'noticeboard', label: 'Noticeboard', icon: MessageSquare },
          { id: 'broadcast', label: 'Email Broadcast', icon: Mail },
        ].map(t => (
          <button
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-[var(--club-primary,#16a34a)] text-[var(--club-primary,#16a34a)]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
          >
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Noticeboard */}
      {activeTab === 'noticeboard' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
          ) : posts.length === 0 ? (
            <Card className="text-center py-16">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No posts yet</p>
              <Button className="mt-4" onClick={() => setShowNewPost(true)}>Create First Post</Button>
            </Card>
          ) : (
            posts.map(post => (
              <Card key={post.id} className={post.pinned ? 'border-amber-200 bg-amber-50/30' : ''}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {post.pinned && <Pin className="w-3 h-3 text-amber-500" />}
                      <Badge variant={postTypeColors[post.post_type] ?? 'gray'}>{post.post_type}</Badge>
                      <span className="text-xs text-gray-400">{format(new Date(post.published_at), 'd MMM yyyy HH:mm')}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{post.title}</h3>
                    {post.body && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3">{post.body}</p>}
                  </div>
                  <div className="flex gap-1 ml-4">
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-500" onClick={() => togglePin(post)} title={post.pinned ? 'Unpin' : 'Pin'}>
                      <Pin className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500" onClick={() => setEditPost(post)} title="Edit">
                      ✏️
                    </button>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500" onClick={() => deletePost(post.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Comments section */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => {
                      if (expandedPost === post.id) { setExpandedPost(null); } else { setExpandedPost(post.id); fetchComments(post.id); }
                    }}
                  >
                    {expandedPost === post.id ? 'Hide' : 'View'} comments
                  </button>

                  {expandedPost === post.id && (
                    <div className="mt-2 space-y-2">
                      {(comments[post.id] ?? []).map(c => {
                        const member = c.member as Member | undefined;
                        return (
                          <div key={c.id} className="flex items-start justify-between bg-gray-50 p-2 rounded">
                            <div>
                              <span className="text-xs font-medium text-gray-700">{member?.first_name} {member?.last_name}</span>
                              <p className="text-xs text-gray-600">{c.body}</p>
                              <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'd MMM HH:mm')}</span>
                            </div>
                            <button className="text-xs text-red-400 hover:text-red-600" onClick={() => deleteComment(c.id, post.id)}>Delete</button>
                          </div>
                        );
                      })}
                      {(comments[post.id] ?? []).length === 0 && <p className="text-xs text-gray-400">No comments yet</p>}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Broadcast */}
      {activeTab === 'broadcast' && (
        <EmailBroadcast clubId={profile!.club_id!} />
      )}

      {/* New/Edit Post Modal */}
      {(showNewPost || editPost) && (
        <PostFormModal
          clubId={profile!.club_id!}
          post={editPost}
          onClose={() => { setShowNewPost(false); setEditPost(null); }}
          onSave={() => { setShowNewPost(false); setEditPost(null); fetchPosts(); }}
        />
      )}
    </div>
  );
}

function PostFormModal({
  clubId,
  post,
  onClose,
  onSave,
}: {
  clubId: string;
  post: NoticeboardPost | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    title: post?.title ?? '',
    body: post?.body ?? '',
    post_type: post?.post_type ?? 'general',
    pinned: post?.pinned ?? false,
    comments_enabled: post?.comments_enabled ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title) return;
    setSaving(true);
    const payload = { ...form, club_id: clubId };
    if (post) {
      await supabase.from('noticeboard_posts').update(payload).eq('id', post.id);
    } else {
      await supabase.from('noticeboard_posts').insert(payload);
    }
    setSaving(false);
    onSave();
  }

  return (
    <Modal open onClose={onClose} title={post ? 'Edit Post' : 'New Post'} size="lg">
      <div className="space-y-4">
        <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <Textarea label="Body" rows={6} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Post Type"
            value={form.post_type}
            onChange={e => setForm(f => ({ ...f, post_type: e.target.value as import('../../types').PostType }))}
            options={[
              { value: 'general', label: 'General' },
              { value: 'results', label: 'Competition Results' },
              { value: 'alert', label: 'Alert (Urgent)' },
              { value: 'news', label: 'News' },
            ]}
          />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} />
            Pin to top
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.comments_enabled} onChange={e => setForm(f => ({ ...f, comments_enabled: e.target.checked }))} />
            Allow comments
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>{post ? 'Update Post' : 'Publish Post'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EmailBroadcast({ clubId }: { clubId: string }) {
  const [form, setForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    supabase.from('members').select('id', { count: 'exact' }).eq('club_id', clubId).eq('status', 'active').then(({ count }) => {
      setMemberCount(count ?? 0);
    });
  }, []);

  async function handleSend() {
    if (!form.subject || !form.body) return;
    setSending(true);
    // In production: call Resend API via Supabase Edge Function
    // For now, log to email_log
    const { data: members } = await supabase.from('members').select('id, email').eq('club_id', clubId).eq('status', 'active').not('email', 'is', null);
    const logs = (members ?? []).map((m: { id: string; email: string }) => ({
      club_id: clubId,
      recipient_member_id: m.id,
      recipient_email: m.email,
      email_type: 'broadcast',
      subject: form.subject,
      status: 'sent',
    }));
    if (logs.length > 0) {
      await supabase.from('email_log').insert(logs);
    }
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <Card className="text-center py-12">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Mail className="w-6 h-6 text-green-600" />
        </div>
        <p className="font-semibold text-gray-900">Broadcast queued!</p>
        <p className="text-sm text-gray-500 mt-1">Sending to {memberCount} active members</p>
        <Button className="mt-4" variant="outline" onClick={() => { setSent(false); setForm({ subject: '', body: '' }); }}>
          Send Another
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <p className="text-sm text-blue-700">This will be sent to <strong>{memberCount}</strong> active members with email addresses.</p>
        </div>
        <Input label="Subject" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Club announcement — Course closure this Sunday" />
        <Textarea label="Message Body" rows={8} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your message here..." />
        <div className="flex justify-end">
          <Button loading={sending} icon={<Send className="w-4 h-4" />} onClick={handleSend}>
            Send to {memberCount} Members
          </Button>
        </div>
      </div>
    </Card>
  );
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'purple';
