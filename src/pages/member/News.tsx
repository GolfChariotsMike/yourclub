import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Pin, MessageSquare, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { NoticeboardPost, NoticeboardComment, Member } from '../../types';

export function MemberNews() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<NoticeboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, NoticeboardComment[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

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

  async function submitComment(postId: string) {
    const text = commentInput[postId]?.trim();
    if (!text || !profile?.member_id) return;
    setSubmitting(postId);
    await supabase.from('noticeboard_comments').insert({
      post_id: postId,
      club_id: profile.club_id,
      member_id: profile.member_id,
      body: text,
    });
    setCommentInput(c => ({ ...c, [postId]: '' }));
    await fetchComments(postId);
    setSubmitting(null);
  }

  const postTypeColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
    general: 'gray',
    results: 'success',
    alert: 'danger',
    news: 'info',
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Club News</h1>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--club-primary,#16a34a)]" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No news yet</div>
      ) : (
        posts.map(post => (
          <Card key={post.id} className={post.pinned ? 'border-amber-200 bg-amber-50/30' : ''}>
            {/* Post header */}
            <div className="flex items-start gap-2 mb-2">
              {post.pinned && <Pin className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />}
              <Badge variant={postTypeColors[post.post_type] ?? 'gray'} size="sm">{post.post_type}</Badge>
              <span className="text-xs text-gray-400 ml-auto">{format(new Date(post.published_at), 'd MMM yyyy')}</span>
            </div>

            <h3 className="font-semibold text-gray-900 mb-1">{post.title}</h3>
            {post.body && (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{post.body}</p>
            )}

            {/* Comments toggle */}
            {post.comments_enabled && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    if (expandedPost === post.id) {
                      setExpandedPost(null);
                    } else {
                      setExpandedPost(post.id);
                      fetchComments(post.id);
                    }
                  }}
                >
                  <MessageSquare className="w-3 h-3" />
                  {expandedPost === post.id ? 'Hide comments' : 'Comments'}
                </button>

                {expandedPost === post.id && (
                  <div className="mt-3 space-y-2">
                    {(comments[post.id] ?? []).map(c => {
                      const member = c.member as Member | undefined;
                      return (
                        <div key={c.id} className="bg-gray-50 p-2 rounded-lg">
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-xs font-semibold text-gray-700">{member?.first_name} {member?.last_name}</span>
                            <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'd MMM HH:mm')}</span>
                          </div>
                          <p className="text-sm text-gray-700">{c.body}</p>
                        </div>
                      );
                    })}

                    <div className="flex gap-2 mt-2">
                      <input
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--club-primary,#16a34a)]"
                        placeholder="Add a comment..."
                        value={commentInput[post.id] ?? ''}
                        onChange={e => setCommentInput(c => ({ ...c, [post.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') submitComment(post.id); }}
                      />
                      <button
                        className="p-2 bg-[var(--club-primary,#16a34a)] text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                        onClick={() => submitComment(post.id)}
                        disabled={submitting === post.id || !commentInput[post.id]?.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
