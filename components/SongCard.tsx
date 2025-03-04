import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  TextInput,
  Animated,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
  Easing,
  StyleProp,
  GestureResponderEvent,
  ViewStyle,
  TextStyle,
  ImageStyle
} from 'react-native';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';

// Backend endpoint (adjust for emulator)
const API_URL = __DEV__ 
  ? Platform.OS === 'android' 
    ? 'http://10.0.2.2:3000' // Android emulator
    : 'http://localhost:3000'  // iOS simulator
  : 'https://your-production-url.com'; // Update with your actual production URL

// Interfaces remain unchanged
interface CommentLike {
  userId: string;
  createdAt: string;
}

interface CommentReply {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
  likes: CommentLike[];
}

interface Comment {
  id: string;
  user: string;
  username?: string;
  text: string;
  gifUrl?: string;
  createdAt: string;
  likes: CommentLike[];
  replies: CommentReply[];
}

interface SongPost {
  _id: string;
  trackId: string;
  trackName: string;
  trackArtist: string;
  trackImage: string;
  spotifyId: string;
  username?: string;
  likes: string[];
  comments: Comment[];
  createdAt: string;
}

interface SongCardProps {
  songPost: SongPost;
  currentUserSpotifyId: string | null;
  onLike: (songId: string) => Promise<void>;
  onComment: (songId: string, comment: string, gifUrl?: string) => Promise<void>;
  onCommentLike?: (songId: string, commentId: string) => Promise<void>;
  onReply?: (songId: string, commentId: string, replyText: string) => Promise<void>;
}

// Constants (COLORS, TYPOGRAPHY, SPACING, RADIUS, ANIMATION, STATE) remain unchanged
const COLORS = {
  primary: '#4E34E1',
  accent: '#A3F7BF',
  background: '#FFFFFF',
  backgroundDark: '#121212',
  surfaceLight: '#F5F7FC',
  surfaceDark: '#1E1E28',
  border: '#E9EBF0',
  borderDark: '#2D2D39',
  text: '#202124',
  textSecondary: '#5F6368',
  textTertiary: '#9AA0A6',
  textLight: '#FFFFFF',
  textLightSecondary: '#E8EAED',
  error: '#EA4335',
  success: '#34A853',
  warning: '#FBBC05',
  info: '#4285F4',
  overlay: 'rgba(0, 0, 0, 0.5)',
  divider: 'rgba(0, 0, 0, 0.1)',
  dividerDark: 'rgba(255, 255, 255, 0.1)',
};

const TYPOGRAPHY = {
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: 0.25 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: 0.15 },
  h3: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.15 },
  body1: { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0.5 },
  body2: { fontSize: 14, fontWeight: '400' as const, letterSpacing: 0.25 },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.4 },
  button: { fontSize: 14, fontWeight: '500' as const, letterSpacing: 1.25, textTransform: 'uppercase' as const },
  overline: { fontSize: 10, fontWeight: '400' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 100,
};

const ANIMATION = {
  fast: 150,
  medium: 300,
  slow: 450,
};

const STATE = {
  pressed: 0.92,
  disabled: 0.6,
};

export const SongCard = ({ 
  songPost, 
  currentUserSpotifyId, 
  onLike, 
  onComment,
  onCommentLike,
  onReply
}: SongCardProps) => {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [hasLiked, setHasLiked] = useState(
    currentUserSpotifyId ? songPost.likes.includes(currentUserSpotifyId) : false
  );
  const [dominantColor, setDominantColor] = useState(COLORS.primary);
  const [isGifMode, setIsGifMode] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [gifPage, setGifPage] = useState(1);
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyingToUsername, setReplyingToUsername] = useState<string | null>(null);

  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const commentInputRef = useRef<TextInput>(null);
  
  const commentOpacity = useRef(new Animated.Value(0)).current;
  const commentScale = useRef(new Animated.Value(0.95)).current;
  const likeAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (currentUserSpotifyId) {
      setHasLiked(songPost.likes.includes(currentUserSpotifyId));
    }
  }, [songPost.likes, currentUserSpotifyId]);

  const formatPostTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  };

  const animateLike = () => {
    Animated.sequence([
      Animated.timing(likeAnimation, {
        toValue: 1.2,
        duration: ANIMATION.fast,
        easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
        useNativeDriver: true
      }),
      Animated.timing(likeAnimation, {
        toValue: 1,
        duration: ANIMATION.fast,
        easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
        useNativeDriver: true
      })
    ]).start();
  };

  const toggleComments = () => {
    if (commentsExpanded) {
      Animated.parallel([
        Animated.timing(commentOpacity, { 
          toValue: 0, 
          duration: ANIMATION.medium, 
          useNativeDriver: true 
        }),
        Animated.timing(commentScale, { 
          toValue: 0.95, 
          duration: ANIMATION.medium, 
          useNativeDriver: true 
        })
      ]).start(() => setCommentsExpanded(false));
    } else {
      setCommentsExpanded(true);
      Animated.parallel([
        Animated.timing(commentOpacity, { 
          toValue: 1, 
          duration: ANIMATION.medium, 
          useNativeDriver: true 
        }),
        Animated.timing(commentScale, { 
          toValue: 1, 
          duration: ANIMATION.medium, 
          useNativeDriver: true 
        })
      ]).start();
    }
  };

  const handleLike = async () => {
    if (!currentUserSpotifyId) return;
    try {
      animateLike();
      setHasLiked(!hasLiked);
      await onLike(songPost._id);
    } catch (error) {
      setHasLiked(hasLiked);
      console.error('Error liking song:', error);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!currentUserSpotifyId || !onCommentLike) return;
    try {
      await onCommentLike(songPost._id, commentId);
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const fetchGifs = async (searchTerm: string, page = 1, append = false) => {
    if (isLoadingGifs || !searchTerm.trim()) return;
    setIsLoadingGifs(true);
    try {
      const response = await fetch(`${API_URL}/api/giphy/search?query=${encodeURIComponent(searchTerm)}&page=${page}&limit=24}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.gifs && Array.isArray(data.gifs) && data.gifs.length > 0) {
        setGifs(append ? prevGifs => [...prevGifs, ...data.gifs] : data.gifs);
        setHasMoreGifs(data.pagination?.hasMore || false);
      } else {
        setGifs(append ? gifs : []);
        setHasMoreGifs(false);
      }
    } catch (error) {
      console.error('Error fetching GIFs:', error);
      setGifs(append ? gifs : []);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const handleGifSearch = (text: string) => {
    setGifSearch(text);
    setGifPage(1);
    if (text.length > 2) {
      const timeoutId = setTimeout(() => fetchGifs(text, 1, false), 300);
      return () => clearTimeout(timeoutId);
    } else {
      setGifs([]);
      setHasMoreGifs(false);
    }
  };

  const loadMoreGifs = () => {
    if (hasMoreGifs && !isLoadingGifs && gifSearch.length > 2) {
      const nextPage = gifPage + 1;
      setGifPage(nextPage);
      fetchGifs(gifSearch, nextPage, true);
    }
  };

  const toggleGifMode = () => {
    setIsGifMode(!isGifMode);
    setSelectedGif(null);
    setGifSearch('');
    setGifs([]);
    setGifPage(1);
    setHasMoreGifs(true);
  };

  const handleComment = async () => {
    if (!currentUserSpotifyId || (!newComment.trim() && !selectedGif) || submittingComment) return;
    setSubmittingComment(true);
    try {
      if (replyingToCommentId && onReply) {
        await onReply(songPost._id, replyingToCommentId, newComment.trim());
        setReplyingToCommentId(null);
        setReplyingToUsername(null);
      } else {
        await onComment(songPost._id, newComment.trim(), selectedGif || undefined);
      }
      setNewComment('');
      setSelectedGif(null);
      setIsGifMode(false);
      if (!commentsExpanded) toggleComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const navigateToUserProfile = () => {
    if (songPost.spotifyId && songPost.username && songPost.spotifyId !== currentUserSpotifyId) {
      router.push(`/profile/${songPost.spotifyId}`);
    }
  };

  const spotifyEmbedHtml = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body { 
            margin: 0; 
            padding: 0; 
            background-color: transparent; 
            overflow: hidden; 
            height: 100%; 
            width: 100%; 
          }
          iframe { 
            border: none; 
            width: 100%; 
            height: 100%; 
            position: absolute; 
            top: 0; 
            left: 0; 
            right: 0; 
            bottom: 0;
            border-radius: 8px;
          }
        </style>
        <script>
          function getIframeBackgroundColor() {
            setTimeout(() => {
              const iframe = document.querySelector('iframe');
              if (iframe && iframe.contentDocument) {
                try {
                  const bgColor = getComputedStyle(iframe.contentDocument.body).backgroundColor;
                  if (bgColor) window.ReactNativeWebView.postMessage(bgColor);
                } catch (e) {
                  console.log('Error getting color:', e);
                }
              }
            }, 1000);
          }
          window.onload = () => {
            getIframeBackgroundColor();
            setTimeout(getIframeBackgroundColor, 2000);
          };
        </script>
      </head>
      <body>
        <iframe 
          src="https://open.spotify.com/embed/track/${songPost.trackId}" 
          frameborder="0" 
          allowtransparency="true" 
          allow="encrypted-media"
        ></iframe>
      </body>
    </html>`;

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const color = event.nativeEvent.data;
      if (color && color !== '' && typeof color === 'string') {
        if (color.startsWith('rgb')) {
          const rgbValues = color.match(/\d+/g);
          if (rgbValues && rgbValues.length >= 3) {
            const r = parseInt(rgbValues[0]);
            const g = parseInt(rgbValues[1]);
            const b = parseInt(rgbValues[2]);
            setDominantColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
          }
        } else if (color.startsWith('#')) {
          setDominantColor(color);
        }
      }
    } catch (e) {
      console.log('Error handling WebView message:', e);
    }
  };

  const getCommentLikesCount = (comment: Comment | CommentReply) => {
    return comment.likes && Array.isArray(comment.likes) ? comment.likes.length : 0;
  };

  const hasUserLikedComment = (comment: Comment | CommentReply) => {
    return currentUserSpotifyId && comment.likes && 
      Array.isArray(comment.likes) && 
      comment.likes.some(like => like.userId === currentUserSpotifyId);
  };

  const renderComment = (item: Comment) => {
    const isCommentLiked = hasUserLikedComment(item);
    const likesCount = getCommentLikesCount(item);
    
    return (
      <View key={item.id || `comment-${item.createdAt}`} style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={item.username ? navigateToUserProfile : undefined}
            disabled={!item.username}
          >
            <Text style={styles.commentUsername}>{item.username || item.user}</Text>
          </TouchableOpacity>
          <Text style={styles.commentTime}>{formatPostTime(item.createdAt)}</Text>
        </View>
        
        {item.text ? <Text style={styles.commentText}>{item.text}</Text> : null}
        
        {item.gifUrl ? (
          <View style={styles.commentGifContainer}>
            <Image 
              source={{ uri: item.gifUrl }} 
              style={styles.commentGif}
              resizeMode="cover"
              defaultSource={require('../assets/images/icon.png')}
            />
          </View>
        ) : null}
        
        <View style={styles.commentActions}>
          <Pressable 
            style={({ pressed }) => [
              styles.commentAction,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
            ] as StyleProp<ViewStyle>}
            onPress={() => handleCommentLike(item.id)}
            disabled={!onCommentLike || !currentUserSpotifyId}
          >
            <Ionicons 
              name={isCommentLiked ? "heart" : "heart-outline"} 
              size={16} 
              color={isCommentLiked ? COLORS.primary : COLORS.textSecondary} 
            />
            {likesCount > 0 ? (
              <Text style={styles.commentActionText}>
                {likesCount}
              </Text>
            ) : null}
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.commentAction,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
            ] as StyleProp<ViewStyle>}
            onPress={() => {
              const isReplying = replyingToCommentId === item.id;
              setReplyingToCommentId(isReplying ? null : item.id);
              setReplyingToUsername(isReplying ? null : (item.username || item.user));
              if (!isReplying) {
                setIsGifMode(false);
                setNewComment('');
                setTimeout(() => commentInputRef.current?.focus(), 100);
              }
            }}
            disabled={!onReply || !currentUserSpotifyId}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={16} 
              color={COLORS.textSecondary} 
            />
            <Text style={styles.commentActionText}>Reply</Text>
          </Pressable>
        </View>
        
        {item.replies && Array.isArray(item.replies) && item.replies.length > 0 ? (
          <View style={styles.repliesContainer}>
            {item.replies.map((reply: CommentReply) => {
              const isReplyLiked = hasUserLikedComment(reply);
              const replyLikesCount = getCommentLikesCount(reply);
              
              return (
                <View key={reply.id} style={styles.replyItem}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentUsername}>{reply.username || reply.userId}</Text>
                    <Text style={styles.commentTime}>{formatPostTime(reply.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{reply.text}</Text>
                  
                  {onCommentLike && currentUserSpotifyId ? (
                    <Pressable 
                      style={({ pressed }) => [
                        styles.replyLikeAction,
                        { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
                      ] as StyleProp<ViewStyle>}
                      onPress={() => handleCommentLike(reply.id)}
                    >
                      <Ionicons 
                        name={isReplyLiked ? "heart" : "heart-outline"} 
                        size={14} 
                        color={isReplyLiked ? COLORS.primary : COLORS.textSecondary} 
                      />
                      {replyLikesCount > 0 ? (
                        <Text style={styles.commentActionText}>
                          {replyLikesCount}
                        </Text>
                      ) : null}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {/* Song post header */}
        <View style={styles.headerContainer}>
          {songPost.username ? (
            <TouchableOpacity 
              style={styles.userInfo}
              onPress={navigateToUserProfile}
              disabled={songPost.spotifyId === currentUserSpotifyId || !songPost.spotifyId}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{songPost.username.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.username}>@{songPost.username}</Text>
                <Text style={styles.timestamp}>{formatPostTime(songPost.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Main card */}
        <View style={styles.card}>
          <View style={styles.playerContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: spotifyEmbedHtml }}
              style={styles.webView}
              scrollEnabled={false}
              bounces={false}
              javaScriptEnabled={true}
              onMessage={handleWebViewMessage}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
            />
          </View>
          
          <View style={styles.songInfoContainer}>
            <View style={styles.songDetails}>
              <Text style={styles.trackName} numberOfLines={1}>{songPost.trackName || "Unknown Track"}</Text>
              <Text style={styles.artistName} numberOfLines={1}>{songPost.trackArtist || "Unknown Artist"}</Text>
            </View>
            
            <View style={styles.actionsContainer}>
              <Pressable 
                style={({ pressed }) => [
                  styles.likeButton,
                  {
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? STATE.pressed : 1 }]
                  }
                ] as StyleProp<ViewStyle>} 
                onPress={handleLike}
                disabled={!currentUserSpotifyId}
              >
                <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
                  <Ionicons 
                    name={hasLiked ? "heart" : "heart-outline"} 
                    size={22} 
                    color={hasLiked ? COLORS.primary : COLORS.textSecondary} 
                  />
                </Animated.View>
                {songPost.likes && songPost.likes.length > 0 ? (
                  <Text style={styles.likeCount}>
                    {songPost.likes.length}
                  </Text>
                ) : null}
              </Pressable>
              
              <Pressable 
                style={({ pressed }) => [
                  styles.commentButton,
                  {
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? STATE.pressed : 1 }]
                  }
                ] as StyleProp<ViewStyle>} 
                onPress={toggleComments}
              >
                <Ionicons 
                  name={commentsExpanded ? "chatbubbles" : "chatbubbles-outline"} 
                  size={22} 
                  color={commentsExpanded ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[
                  styles.commentCount,
                  commentsExpanded && { color: COLORS.primary }
                ] as StyleProp<TextStyle>}>
                  {songPost.comments ? songPost.comments.length : 0}
                </Text>
              </Pressable>
            </View>
          </View>
          
          {commentsExpanded && (
            <Animated.View style={{
              opacity: commentOpacity,
              transform: [{ scale: commentScale }],
            }}>
              {songPost.comments && songPost.comments.length > 0 ? (
                songPost.comments.map(renderComment)
              ) : (
                <View style={styles.emptyCommentsContainer}>
                  <Ionicons name="chatbubbles-outline" size={32} color={COLORS.textTertiary} />
                  <Text style={styles.emptyCommentsText}>
                    No comments yet
                  </Text>
                  <Text style={styles.emptyCommentsSubtext}>
                    Be the first to share your thoughts
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>

        {/* Comment Input Section */}
        {currentUserSpotifyId ? (
          <View style={styles.commentInputSection}>
            {replyingToUsername ? (
              <View style={styles.replyIndicator}>
                <View style={styles.replyIndicatorContent}>
                  <Ionicons name="return-down-forward" size={14} color={COLORS.primary} />
                  <Text style={styles.replyingToText}>
                    Replying to <Text style={styles.replyUsername}>@{replyingToUsername}</Text>
                  </Text>
                </View>
                <Pressable 
                  style={({ pressed }) => [
                    styles.cancelReplyButton,
                    { opacity: pressed ? 0.7 : 1 }
                  ] as StyleProp<ViewStyle>}
                  onPress={() => {
                    setReplyingToCommentId(null);
                    setReplyingToUsername(null);
                  }}
                >
                  <Ionicons name="close" size={16} color={COLORS.textSecondary} />
                </Pressable>
              </View>
            ) : null}
            
            <View style={styles.inputRow}>
              {isGifMode ? (
                <TextInput
                  ref={commentInputRef}
                  style={styles.gifSearchInput as StyleProp<TextStyle>}
                  placeholder={replyingToUsername ? `Find a GIF for @${replyingToUsername}...` : "Search for GIFs..."}
                  placeholderTextColor={COLORS.textTertiary}
                  value={gifSearch}
                  onChangeText={handleGifSearch}
                  selectionColor={COLORS.primary}
                />
              ) : (
                <TextInput
                  ref={commentInputRef}
                  style={styles.commentInput as StyleProp<TextStyle>}
                  placeholder={replyingToUsername ? `Reply to @${replyingToUsername}...` : "Add a comment..."}
                  placeholderTextColor={COLORS.textTertiary}
                  value={newComment}
                  onChangeText={setNewComment}
                  maxLength={300}
                  selectionColor={COLORS.primary}
                />
              )}
              
              <Pressable 
                style={({ pressed }) => [
                  styles.gifButton, 
                  isGifMode && styles.gifButtonActive,
                  { opacity: pressed ? 0.7 : 1 }
                ] as StyleProp<ViewStyle>}
                onPress={toggleGifMode}
              >
                <Text style={[
                  styles.gifButtonText,
                  isGifMode && styles.gifButtonTextActive
                ] as StyleProp<TextStyle>}>GIF</Text>
              </Pressable>
              
              <Pressable 
                style={({ pressed }) => [
                  styles.sendButton,
                  { 
                    opacity: ((!newComment.trim() && !selectedGif) || submittingComment) 
                      ? STATE.disabled 
                      : pressed ? 0.7 : 1
                  }
                ] as StyleProp<ViewStyle>}
                onPress={handleComment}
                disabled={(!newComment.trim() && !selectedGif) || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="arrow-up" size={18} color="#ffffff" />
                )}
              </Pressable>
            </View>
            
            {selectedGif ? (
              <View style={styles.selectedGifContainer}>
                <Image 
                  source={{ uri: selectedGif }} 
                  style={styles.selectedGifImage as StyleProp<ImageStyle>}
                  resizeMode="cover"
                  defaultSource={require('../assets/images/icon.png')}
                />
                <Pressable 
                  style={({ pressed }) => [
                    styles.removeGifButton,
                    { opacity: pressed ? 0.7 : 1 }
                  ] as StyleProp<ViewStyle>}
                  onPress={() => setSelectedGif(null)}
                >
                  <Ionicons name="close" size={16} color="#FFF" />
                </Pressable>
              </View>
            ) : null}
            
            {isGifMode ? (
              <View style={styles.gifsResultsContainer}>
                {isLoadingGifs && gifs.length === 0 ? (
                  <View style={styles.gifLoadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.gifLoadingText}>Loading GIFs...</Text>
                  </View>
                ) : gifs.length > 0 ? (
                  <ScrollView
                    horizontal
                    contentContainerStyle={styles.gifGrid}
                    showsHorizontalScrollIndicator={false}
                  >
                    {gifs.map((item, index) => (
                      <Pressable 
                        key={`${item.id || 'gif'}-${index}`}
                        style={({ pressed }) => [
                          styles.gifItem,
                          { 
                            opacity: pressed ? 0.7 : 1,
                            transform: [{ scale: pressed ? 0.95 : 1 }]
                          }
                        ] as StyleProp<ViewStyle>}
                        onPress={() => {
                          if (item && item.originalUrl) {
                            setSelectedGif(item.originalUrl === selectedGif ? null : item.originalUrl);
                          }
                        }}
                      >
                        {item && item.previewUrl ? (
                          <Image 
                            source={{ uri: item.previewUrl }} 
                            style={[
                              styles.gifItemImage,
                              item.originalUrl === selectedGif && styles.selectedGifItemImage
                            ] as StyleProp<ImageStyle>}
                            resizeMode="cover"
                            defaultSource={require('../assets/images/icon.png')}
                          />
                        ) : null}
                      </Pressable>
                    ))}
                    {isLoadingGifs && <ActivityIndicator size="small" color={COLORS.primary} style={styles.gifLoadingFooter} />}
                  </ScrollView>
                ) : gifSearch.length > 2 ? (
                  <View style={styles.gifEmptyState}>
                    <Ionicons name="images-outline" size={36} color={COLORS.textTertiary} />
                    <Text style={styles.gifEmptyText}>No GIFs found</Text>
                    <Text style={styles.gifEmptySubtext}>Try another search term</Text>
                  </View>
                ) : (
                  <View style={styles.gifEmptyState}>
                    <Ionicons name="search-outline" size={36} color={COLORS.textTertiary} />
                    <Text style={styles.gifEmptyText}>Search for GIFs</Text>
                    <Text style={styles.gifEmptySubtext}>Type at least 3 characters</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  headerContainer: {
    marginBottom: SPACING.xs,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textLight,
  },
  userDetails: {
    marginLeft: SPACING.sm,
  },
  username: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  timestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  playerContainer: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  songInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  songDetails: {
    flex: 1,
    marginRight: SPACING.md,
  },
  trackName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 2,
  },
  artistName: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    minWidth: 40,
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  likeCount: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  commentCount: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  commentItem: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  commentUsername: {
    ...TYPOGRAPHY.body2,
    fontWeight: '600',
    color: COLORS.text,
  },
  commentTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  commentText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  commentGifContainer: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  commentGif: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.md,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  commentActionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  repliesContainer: {
    marginTop: SPACING.sm,
  },
  replyItem: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  replyLikeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  emptyCommentsContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyCommentsText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  emptyCommentsSubtext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  commentInputSection: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: 'rgba(78, 52, 225, 0.08)',
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  replyIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyingToText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  replyUsername: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelReplyButton: {
    padding: SPACING.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    ...TYPOGRAPHY.body2,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 40,
  },
  gifSearchInput: {
    flex: 1,
    ...TYPOGRAPHY.body2,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 40,
  },
  gifButton: {
    marginLeft: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  gifButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(78, 52, 225, 0.08)',
  },
  gifButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  gifButtonTextActive: {
    color: COLORS.primary,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  selectedGifContainer: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  selectedGifImage: {
    width: '100%',
    height: 160,
    borderRadius: RADIUS.lg,
  },
  removeGifButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifsResultsContainer: {
    marginTop: SPACING.md,
    height: 120,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  gifGrid: {
    padding: SPACING.xs,
    flexDirection: 'row',
  },
  gifItem: {
    width: 100,
    height: 100,
    margin: SPACING.xs,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  gifItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
  },
  selectedGifItemImage: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  gifLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifLoadingText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  gifLoadingFooter: {
    padding: SPACING.md,
  },
  gifEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  gifEmptyText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  gifEmptySubtext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
  }
});