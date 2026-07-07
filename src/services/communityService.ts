import { supabase } from './supabase';

export type CommunityPost = {
  id: string;
  professionalId: string;
  content: string;
  createdAt: string;
  authorNome: string;
  authorTratamento: string | null;
  authorFotoUrl: string | null;
  authorPlan: string | null;
};

export type CommunityComment = {
  id: string;
  postId: string;
  professionalId: string;
  content: string;
  createdAt: string;
  authorNome: string;
  authorTratamento: string | null;
  authorFotoUrl: string | null;
};

type PostRow = {
  id: string;
  professional_id: string;
  content: string;
  created_at: string;
  profiles: {
    nome: string;
    tratamento: string | null;
    foto_url: string | null;
    plan: string | null;
    comunidade_banned: boolean | null;
  } | null;
};

function toPost(r: PostRow): CommunityPost {
  return {
    id:               r.id,
    professionalId:   r.professional_id,
    content:          r.content,
    createdAt:        r.created_at,
    authorNome:       r.profiles?.nome ?? 'Profissional OLI',
    authorTratamento: r.profiles?.tratamento ?? null,
    authorFotoUrl:    r.profiles?.foto_url ?? null,
    authorPlan:       r.profiles?.plan ?? null,
  };
}

export async function fetchPosts(limit = 20, beforeCursor?: string): Promise<CommunityPost[]> {
  let query = supabase
    .from('community_posts')
    .select('id, professional_id, content, created_at, profiles(nome, tratamento, foto_url, plan, comunidade_banned)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (beforeCursor) query = query.lt('created_at', beforeCursor);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as PostRow[])
    .filter(r => !r.profiles?.comunidade_banned)
    .map(toPost);
}

export async function createPost(professionalId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('community_posts')
    .insert({ professional_id: professionalId, content: content.trim() });
  if (error) throw error;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function fetchLikeCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {};
  const { data, error } = await supabase
    .from('community_post_likes')
    .select('post_id')
    .in('post_id', postIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data) counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
  return counts;
}

export async function fetchMyLikedPostIds(postIds: string[], professionalId: string): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('community_post_likes')
    .select('post_id')
    .in('post_id', postIds)
    .eq('professional_id', professionalId);
  if (error) throw error;
  return new Set(data.map(r => r.post_id));
}

export async function fetchCommentCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {};
  const { data, error } = await supabase
    .from('community_post_comments')
    .select('post_id')
    .in('post_id', postIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data) counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
  return counts;
}

export async function likePost(postId: string, professionalId: string): Promise<void> {
  const { error } = await supabase
    .from('community_post_likes')
    .insert({ post_id: postId, professional_id: professionalId });
  if (error) throw error;
}

export async function unlikePost(postId: string, professionalId: string): Promise<void> {
  const { error } = await supabase
    .from('community_post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('professional_id', professionalId);
  if (error) throw error;
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from('community_post_comments')
    .select('id, post_id, professional_id, content, created_at, profiles(nome, tratamento, foto_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown as (Omit<PostRow, 'profiles'> & {
    post_id: string;
    profiles: { nome: string; tratamento: string | null; foto_url: string | null } | null;
  })[]).map(r => ({
    id:               r.id,
    postId:           r.post_id,
    professionalId:   r.professional_id,
    content:          r.content,
    createdAt:        r.created_at,
    authorNome:       r.profiles?.nome ?? 'Profissional OLI',
    authorTratamento: r.profiles?.tratamento ?? null,
    authorFotoUrl:    r.profiles?.foto_url ?? null,
  }));
}

export async function addComment(postId: string, professionalId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('community_post_comments')
    .insert({ post_id: postId, professional_id: professionalId, content: content.trim() });
  if (error) throw error;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('community_post_comments').delete().eq('id', commentId);
  if (error) throw error;
}
