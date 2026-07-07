import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../../theme/designSystem';
import { useAuthStore } from '../../store/authStore';
import { AvatarCircle } from '../AvatarCircle';
import { displayName } from '../../utils/profileDisplay';
import { timeAgo } from '../../utils/formatters';
import {
  fetchPosts, createPost, deletePost,
  fetchLikeCounts, fetchMyLikedPostIds, likePost, unlikePost,
  fetchCommentCounts, fetchComments, addComment, deleteComment,
  type CommunityPost, type CommunityComment,
} from '../../services/communityService';

const MAX_CONTENT = 2000;
const PAGE_SIZE = 20;

export function PostFeed() {
  const profile = useAuthStore(s => s.profile);
  const myId    = profile?.id ?? '';

  const [posts,         setPosts]         = useState<CommunityPost[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [hasMore,         setHasMore]       = useState(true);
  const [loadingMore,     setLoadingMore]   = useState(false);
  const [likeCounts,      setLikeCounts]    = useState<Record<string, number>>({});
  const [myLikes,         setMyLikes]       = useState<Set<string>>(new Set());
  const [commentCounts,   setCommentCounts] = useState<Record<string, number>>({});
  const [composerText,    setComposerText]  = useState('');
  const [posting,         setPosting]       = useState(false);
  const [expandedPostId,  setExpandedPostId] = useState<string | null>(null);
  const [comments,        setComments]      = useState<Record<string, CommunityComment[]>>({});
  const [commentText,     setCommentText]   = useState('');
  const [commentLoading,  setCommentLoading] = useState(false);

  const loadCounts = useCallback(async (list: CommunityPost[]) => {
    const ids = list.map(p => p.id);
    const [likes, mine, comm] = await Promise.all([
      fetchLikeCounts(ids),
      myId ? fetchMyLikedPostIds(ids, myId) : Promise.resolve(new Set<string>()),
      fetchCommentCounts(ids),
    ]);
    setLikeCounts(prev => ({ ...prev, ...likes }));
    setMyLikes(prev => new Set([...prev, ...mine]));
    setCommentCounts(prev => ({ ...prev, ...comm }));
  }, [myId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchPosts(PAGE_SIZE);
      setPosts(list);
      setHasMore(list.length === PAGE_SIZE);
      await loadCounts(list);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o feed.');
    } finally {
      setLoading(false);
    }
  }, [loadCounts]);

  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = posts[posts.length - 1].createdAt;
      const list = await fetchPosts(PAGE_SIZE, cursor);
      setPosts(prev => [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
      await loadCounts(list);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar mais posts.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePublish() {
    const content = composerText.trim();
    if (!content || !myId) return;
    setPosting(true);
    try {
      await createPost(myId, content);
      setComposerText('');
      Keyboard.dismiss();
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível publicar. Tente novamente.');
    } finally {
      setPosting(false);
    }
  }

  function confirmDeletePost(postId: string) {
    Alert.alert('Apagar post', 'Tem certeza que quer apagar esse post?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive', onPress: async () => {
          try {
            await deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
          } catch {
            Alert.alert('Erro', 'Não foi possível apagar o post.');
          }
        },
      },
    ]);
  }

  async function toggleLike(postId: string) {
    if (!myId) return;
    const liked = myLikes.has(postId);
    setMyLikes(prev => {
      const next = new Set(prev);
      liked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + (liked ? -1 : 1) }));
    try {
      if (liked) await unlikePost(postId, myId);
      else await likePost(postId, myId);
    } catch {
      // reverte otimismo em caso de erro
      setMyLikes(prev => {
        const next = new Set(prev);
        liked ? next.add(postId) : next.delete(postId);
        return next;
      });
      setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + (liked ? 1 : -1) }));
    }
  }

  async function toggleComments(postId: string) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    setCommentText('');
    if (!comments[postId]) {
      try {
        const list = await fetchComments(postId);
        setComments(prev => ({ ...prev, [postId]: list }));
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os comentários.');
      }
    }
  }

  async function handleAddComment(postId: string) {
    const content = commentText.trim();
    if (!content || !myId) return;
    setCommentLoading(true);
    try {
      await addComment(postId, myId, content);
      const list = await fetchComments(postId);
      setComments(prev => ({ ...prev, [postId]: list }));
      setCommentCounts(prev => ({ ...prev, [postId]: list.length }));
      setCommentText('');
    } catch {
      Alert.alert('Erro', 'Não foi possível comentar.');
    } finally {
      setCommentLoading(false);
    }
  }

  function confirmDeleteComment(postId: string, commentId: string) {
    Alert.alert('Apagar comentário', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive', onPress: async () => {
          try {
            await deleteComment(commentId);
            const list = (comments[postId] ?? []).filter(c => c.id !== commentId);
            setComments(prev => ({ ...prev, [postId]: list }));
            setCommentCounts(prev => ({ ...prev, [postId]: list.length }));
          } catch {
            Alert.alert('Erro', 'Não foi possível apagar o comentário.');
          }
        },
      },
    ]);
  }

  return (
    <View>
      {/* Composer */}
      <View style={[styles.composer, shadows.small]}>
        <TextInput
          style={styles.composerInput}
          placeholder="Compartilhe algo com a comunidade — cobertura de plantão, encaminhamento, dúvida clínica..."
          placeholderTextColor={colors.gray}
          multiline
          maxLength={MAX_CONTENT}
          value={composerText}
          onChangeText={setComposerText}
          accessibilityLabel="Escrever novo post"
        />
        <View style={styles.composerFooter}>
          <Text style={styles.composerHint}>Não inclua dados de pacientes · {composerText.length}/{MAX_CONTENT}</Text>
          <TouchableOpacity
            style={[styles.publishBtn, (!composerText.trim() || posting) && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={!composerText.trim() || posting}
            accessibilityLabel="Publicar post"
          >
            {posting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.publishBtnText}>Publicar</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de posts */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.oliGreen} />
      ) : posts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={32} color={colors.gray} />
          <Text style={styles.emptyText}>Nenhum post ainda. Seja o primeiro a compartilhar algo.</Text>
        </View>
      ) : (
        <>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isMine={post.professionalId === myId}
              liked={myLikes.has(post.id)}
              likeCount={likeCounts[post.id] ?? 0}
              commentCount={commentCounts[post.id] ?? 0}
              expanded={expandedPostId === post.id}
              comments={comments[post.id] ?? []}
              myId={myId}
              commentText={expandedPostId === post.id ? commentText : ''}
              commentLoading={commentLoading}
              onDelete={() => confirmDeletePost(post.id)}
              onToggleLike={() => toggleLike(post.id)}
              onToggleComments={() => toggleComments(post.id)}
              onChangeCommentText={setCommentText}
              onSubmitComment={() => handleAddComment(post.id)}
              onDeleteComment={(commentId) => confirmDeleteComment(post.id, commentId)}
            />
          ))}
          {hasMore && (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
              {loadingMore
                ? <ActivityIndicator size="small" color={colors.oliGreen} />
                : <Text style={styles.loadMoreText}>Carregar mais</Text>}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function PostCard({
  post, isMine, liked, likeCount, commentCount, expanded, comments, myId,
  commentText, commentLoading,
  onDelete, onToggleLike, onToggleComments, onChangeCommentText, onSubmitComment, onDeleteComment,
}: {
  post: CommunityPost;
  isMine: boolean;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  expanded: boolean;
  comments: CommunityComment[];
  myId: string;
  commentText: string;
  commentLoading: boolean;
  onDelete: () => void;
  onToggleLike: () => void;
  onToggleComments: () => void;
  onChangeCommentText: (t: string) => void;
  onSubmitComment: () => void;
  onDeleteComment: (commentId: string) => void;
}) {
  const nome = displayName(post.authorNome, post.authorTratamento);
  return (
    <View style={[styles.card, shadows.small]}>
      <View style={styles.cardHeader}>
        <AvatarCircle nome={post.authorNome} fotoUrl={post.authorFotoUrl} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>{nome}</Text>
          <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
        </View>
        {isMine && (
          <TouchableOpacity onPress={onDelete} accessibilityLabel="Apagar post" hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggleLike} accessibilityLabel={liked ? 'Descurtir' : 'Curtir'}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.oliRed : colors.gray} />
          {likeCount > 0 && <Text style={styles.actionText}>{likeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggleComments} accessibilityLabel="Ver comentários">
          <Ionicons name="chatbubble-outline" size={17} color={colors.gray} />
          {commentCount > 0 && <Text style={styles.actionText}>{commentCount}</Text>}
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.commentsWrap}>
          {comments.map(c => (
            <View key={c.id} style={styles.commentRow}>
              <AvatarCircle nome={c.authorNome} fotoUrl={c.authorFotoUrl} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={styles.commentAuthor}>{displayName(c.authorNome, c.authorTratamento)}</Text>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
              {c.professionalId === myId && (
                <TouchableOpacity onPress={() => onDeleteComment(c.id)} accessibilityLabel="Apagar comentário" hitSlop={8}>
                  <Ionicons name="close" size={14} color={colors.gray} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Comentar..."
              placeholderTextColor={colors.gray}
              value={commentText}
              onChangeText={onChangeCommentText}
              maxLength={500}
              accessibilityLabel="Escrever comentário"
            />
            <TouchableOpacity onPress={onSubmitComment} disabled={!commentText.trim() || commentLoading} accessibilityLabel="Enviar comentário">
              {commentLoading
                ? <ActivityIndicator size="small" color={colors.oliGreen} />
                : <Ionicons name="send" size={18} color={commentText.trim() ? colors.oliGreen : colors.gray} />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  composerInput: {
    fontSize:   14,
    color:      colors.oliDarkGray,
    minHeight:  60,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      spacing.sm,
  },
  composerHint: {
    fontSize: 11,
    color:    colors.gray,
    flex:     1,
  },
  publishBtn: {
    backgroundColor:   colors.oliGreen,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    minWidth:          88,
    alignItems:        'center',
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishBtnText:      { color: colors.white, fontSize: 13, fontWeight: '700' },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize:  13,
    color:     colors.gray,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginBottom:  spacing.sm,
  },
  authorName: { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray },
  postTime:   { fontSize: 11, color: colors.gray, marginTop: 1 },
  postContent: {
    fontSize:   14,
    color:      colors.oliDarkGray,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap:           spacing.lg,
    paddingTop:    spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  actionText: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  commentsWrap: {
    marginTop:   spacing.sm,
    paddingTop:  spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: colors.oliDarkGray },
  commentText:   { fontSize: 12, color: colors.oliDarkGray, marginTop: 1 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  commentInput: {
    flex:              1,
    backgroundColor:   colors.oliBackground,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   8,
    fontSize:          12,
    color:             colors.oliDarkGray,
  },
  loadMoreBtn: {
    alignItems:      'center',
    paddingVertical: spacing.md,
  },
  loadMoreText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.oliGreen,
  },
});
