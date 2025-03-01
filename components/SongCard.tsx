// components/SongCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity,
  TextInput,
  Animated,
  Image,
  ImageStyle,
  ViewStyle,
  TextStyle,
  Platform,
  ActivityIndicator
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
  : 'http://localhost:3000';   // Production URL

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

interface DynamicStyles {
  card: ViewStyle;
  cardContent: ViewStyle;
  cardHeader: ViewStyle;
  likeText: TextStyle;
  commentsText: TextStyle;
  commentItem: ViewStyle;
  replyItem: ViewStyle;
  commentUser: TextStyle;
  commentText: TextStyle;
  inputContainer: ViewStyle;
  input: TextStyle;
  sendButton: ViewStyle;
  emptyCommentsText: TextStyle;
  gifSearchInput: TextStyle;
}

const TEAL_COLOR = '#00FFFF';
const SPACING = 12;

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
  const [dominantColor, setDominantColor] = useState('#262626');
  const [isGifMode, setIsGifMode] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [gifPage, setGifPage] = useState(1);
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  
  const router = useRouter();

  const webViewRef = useRef<WebView>(null);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const commentOpacity = useRef(new Animated.Value(0)).current;

  // Format the time as "X minutes/hours ago" instead of the date
  const formatPostTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  };

  const toggleComments = () => {
    if (commentsExpanded) {
      Animated.parallel([
        Animated.timing(commentOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(animatedHeight, { toValue: 0, duration: 300, useNativeDriver: false })
      ]).start(() => setCommentsExpanded(false));
    } else {
      setCommentsExpanded(true);
      Animated.parallel([
        Animated.timing(animatedHeight, { toValue: 250, duration: 300, useNativeDriver: false }),
        Animated.timing(commentOpacity, { toValue: 1, duration: 300, useNativeDriver: false, delay: 100 })
      ]).start();
    }
  };

  const handleLike = async () => {
    if (!currentUserSpotifyId) return;
    setHasLiked(!hasLiked);
    await onLike(songPost._id);
  };

  const handleCommentLike = async (commentId: string) => {
    if (!currentUserSpotifyId || !onCommentLike) return;
    await onCommentLike(songPost._id, commentId);
  };

  const handleReply = () => {
    if (!currentUserSpotifyId || !replyingToCommentId || !replyText.trim() || !onReply) return;
    
    onReply(songPost._id, replyingToCommentId, replyText.trim());
    setReplyText('');
    setReplyingToCommentId(null);
  };

  const fetchGifs = async (searchTerm: string, page = 1, append = false) => {
    if (isLoadingGifs) return;
    
    setIsLoadingGifs(true);
    try {
      const response = await fetch(`${API_URL}/api/giphy/search?query=${encodeURIComponent(searchTerm)}&page=${page}&limit=24`);
      const data = await response.json();
      
      if (data.gifs && data.gifs.length > 0) {
        if (append) {
          setGifs(prevGifs => [...prevGifs, ...data.gifs]);
        } else {
          setGifs(data.gifs || []);
        }
        setHasMoreGifs(data.pagination?.hasMore || false);
      } else {
        if (!append) {
          setGifs([]);
        }
        setHasMoreGifs(false);
      }
    } catch (error) {
      console.error('Error fetching GIFs:', error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const handleGifSearch = (text: string) => {
    setGifSearch(text);
    setGifPage(1);
    
    if (text.length > 2) {
      fetchGifs(text, 1, false);
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
      await onComment(songPost._id, newComment.trim(), selectedGif || undefined);
      setNewComment('');
      setSelectedGif(null);
      setIsGifMode(false);
      if (!commentsExpanded) toggleComments();
    } finally {
      setSubmittingComment(false);
    }
  };

  const navigateToUserProfile = () => {
    if (songPost.spotifyId && songPost.spotifyId !== currentUserSpotifyId) {
      router.push(`/profile/${songPost.spotifyId}`);
    }
  };

  // Simplified Spotify embed HTML
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
    </head>
    <body>
      <iframe 
        src="https://open.spotify.com/embed/track/${songPost.trackId}" 
        frameborder="0" 
        allowtransparency="true" 
        allow="encrypted-media; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    </body>
  </html>`;
  

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      // Simple approach - just use the string as a color if possible
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
      console.error('Error handling WebView message:', e);
    }
  };

  const getTextColor = (bgColor: string): string => {
    if (bgColor.startsWith('rgb')) {
      const rgbValues = bgColor.match(/\d+/g);
      if (rgbValues && rgbValues.length >= 3) {
        const brightness = (parseInt(rgbValues[0]) * 299 + parseInt(rgbValues[1]) * 587 + parseInt(rgbValues[2]) * 114) / 1000;
        return brightness > 128 ? '#000000' : '#ffffff';
      }
    }
    if (bgColor.startsWith('#')) {
      const r = parseInt(bgColor.substr(1, 2), 16);
      const g = parseInt(bgColor.substr(3, 2), 16);
      const b = parseInt(bgColor.substr(5, 2), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? '#000000' : '#ffffff';
    }
    return '#ffffff';
  };

  const textColor = getTextColor(dominantColor);
  const secondaryTextColor = textColor === '#000000' ? '#555555' : '#dddddd';

  const dynamicStyles: DynamicStyles = {
    card: {
      backgroundColor: dominantColor,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: SPACING,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardContent: {
      paddingHorizontal: SPACING,
      paddingBottom: SPACING,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
    },
    likeText: {
      color: textColor,
      fontSize: 14,
      marginLeft: 6,
      fontWeight: '600',
    },
    commentsText: {
      color: textColor,
      fontSize: 14,
      marginRight: 6,
    },
    commentItem: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginVertical: 4,
      backgroundColor: `${dominantColor}99`,
      borderRadius: 12,
      borderLeftWidth: 2,
      borderLeftColor: TEAL_COLOR,
    },
    replyItem: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginTop: 4,
      marginLeft: 16,
      backgroundColor: `${dominantColor}80`,
      borderRadius: 8,
      borderLeftWidth: 1,
      borderLeftColor: TEAL_COLOR,
    },
    commentUser: {
      fontWeight: '600',
      color: textColor,
      marginBottom: 2,
      fontSize: 13,
    },
    commentText: {
      color: secondaryTextColor,
      fontSize: 14,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 0,
    },
    input: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: textColor,
      fontSize: 14,
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: TEAL_COLOR,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    emptyCommentsText: {
      textAlign: 'center',
      padding: 16,
      color: secondaryTextColor,
      fontStyle: 'italic',
      fontSize: 14,
    },
    gifSearchInput: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: textColor,
      fontSize: 14,
    },
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isCommentLiked = currentUserSpotifyId && item.likes?.some(like => like.userId === currentUserSpotifyId);
    
    return (
      <View style={dynamicStyles.commentItem}>
        <View style={styles.commentHeader}>
          <Text style={dynamicStyles.commentUser}>{item.username || item.user}</Text>
          <Text style={styles.commentTime}>{formatPostTime(item.createdAt)}</Text>
        </View>
        
        {item.text && <Text style={dynamicStyles.commentText}>{item.text}</Text>}
        
        {item.gifUrl && (
          <Image 
            source={{ uri: item.gifUrl }} 
            style={styles.commentGif}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.commentActions}>
          <TouchableOpacity 
            style={styles.commentAction}
            onPress={() => handleCommentLike(item.id)}
            disabled={!onCommentLike}
          >
            <Ionicons 
              name={isCommentLiked ? "heart" : "heart-outline"} 
              size={16} 
              color={isCommentLiked ? TEAL_COLOR : `${textColor}80`} 
            />
            {item.likes && item.likes.length > 0 && (
              <Text style={styles.commentActionText}>
                {item.likes.length}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.commentAction}
            onPress={() => setReplyingToCommentId(replyingToCommentId === item.id ? null : item.id)}
            disabled={!onReply}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={14} 
              color={`${textColor}80`} 
            />
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>
        </View>
        
        {/* Render replies */}
        {item.replies && item.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {item.replies.map((reply) => (
              <View key={reply.id} style={dynamicStyles.replyItem}>
                <View style={styles.commentHeader}>
                  <Text style={dynamicStyles.commentUser}>{reply.username || reply.userId}</Text>
                  <Text style={styles.commentTime}>{formatPostTime(reply.createdAt)}</Text>
                </View>
                <Text style={dynamicStyles.commentText}>{reply.text}</Text>
                
                {/* Like button for replies */}
                {onCommentLike && (
                  <TouchableOpacity 
                    style={[styles.commentAction, { marginTop: 4 }]}
                    onPress={() => handleCommentLike(reply.id)}
                  >
                    <Ionicons 
                      name={reply.likes && reply.likes.some(like => like.userId === currentUserSpotifyId) 
                        ? "heart" : "heart-outline"} 
                      size={14} 
                      color={reply.likes && reply.likes.some(like => like.userId === currentUserSpotifyId) 
                        ? TEAL_COLOR : `${textColor}80`} 
                    />
                    {reply.likes && reply.likes.length > 0 && (
                      <Text style={styles.commentActionText}>
                        {reply.likes.length}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
        
        {/* Reply input */}
        {replyingToCommentId === item.id && (
          <View style={styles.replyInputContainer}>
            <TextInput
              style={styles.replyInput}
              placeholder="Write a reply..."
              placeholderTextColor={`${textColor}80`}
              value={replyText}
              onChangeText={setReplyText}
              maxLength={300}
            />
            <TouchableOpacity 
              style={styles.replyButton}
              onPress={handleReply}
              disabled={!replyText.trim()}
            >
              <Ionicons name="arrow-up" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      {/* Username and time outside the card container */}
      {songPost.username && (
        <TouchableOpacity 
          style={styles.userInfoOutside}
          onPress={navigateToUserProfile}
          disabled={songPost.spotifyId === currentUserSpotifyId}
        >
          <Text style={styles.usernameText}>@{songPost.username}</Text>
          <Text style={styles.timeText}>{formatPostTime(songPost.createdAt)}</Text>
        </TouchableOpacity>
      )}

      <View style={[dynamicStyles.card, styles.card]}>
        <View style={styles.playerContainer}>
        <WebView
            ref={webViewRef}
            source={{ html: spotifyEmbedHtml }}
            style={styles.webView}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            onMessage={handleWebViewMessage}
            startInLoadingState={true}
            scalesPageToFit={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowFileAccess={true}
            userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
            />
        </View>
        
        <View style={dynamicStyles.cardContent}>
          <View style={dynamicStyles.cardHeader}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleLike}
              disabled={!currentUserSpotifyId}
            >
              <Ionicons 
                name={hasLiked ? "heart" : "heart-outline"} 
                size={22} 
                color={hasLiked ? TEAL_COLOR : textColor} 
              />
              {songPost.likes.length > 0 && (
                <Text style={dynamicStyles.likeText}>
                  {songPost.likes.length}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={toggleComments}
            >
              <Text style={dynamicStyles.commentsText}>
                {songPost.comments.length} {songPost.comments.length === 1 ? 'Comment' : 'Comments'}
              </Text>
              <Ionicons 
                name={commentsExpanded ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={textColor} 
              />
            </TouchableOpacity>
          </View>
      
          {commentsExpanded && (
            <Animated.View style={{ 
              maxHeight: animatedHeight, 
              opacity: commentOpacity,
              overflow: 'hidden',
              marginTop: 4
            }}>
              {songPost.comments && songPost.comments.length > 0 ? (
                <FlatList
                  data={songPost.comments}
                  keyExtractor={item => item.id || item.createdAt}
                  renderItem={renderComment}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <Text style={dynamicStyles.emptyCommentsText}>
                  No comments yet
                </Text>
              )}
            </Animated.View>
          )}
          
          {currentUserSpotifyId && (
            <View>
              <View style={dynamicStyles.inputContainer}>
                {isGifMode ? (
                  <TextInput
                    style={dynamicStyles.gifSearchInput}
                    placeholder="Search GIFs..."
                    placeholderTextColor={`${textColor}80`}
                    value={gifSearch}
                    onChangeText={handleGifSearch}
                  />
                ) : (
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="Add a comment..."
                    placeholderTextColor={`${textColor}80`}
                    value={newComment}
                    onChangeText={setNewComment}
                    maxLength={300}
                  />
                )}
                <TouchableOpacity 
                  style={[
                    styles.gifModeButton, 
                    isGifMode && styles.gifModeButtonActive
                  ]}
                  onPress={toggleGifMode}
                >
                  <Text style={{
                    fontSize: 13, 
                    fontWeight: 'bold',
                    color: isGifMode ? TEAL_COLOR : `${textColor}80`
                  }}>GIF</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    dynamicStyles.sendButton,
                    (!newComment.trim() && !selectedGif) || submittingComment ? { opacity: 0.5 } : {}
                  ]}
                  onPress={handleComment}
                  disabled={(!newComment.trim() && !selectedGif) || submittingComment}
                >
                  <Ionicons name="arrow-up" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
              
              {selectedGif && (
                <View style={styles.selectedGifContainer}>
                  <Image 
                    source={{ uri: selectedGif }} 
                    style={styles.selectedGifImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity 
                    style={styles.removeGifButton}
                    onPress={() => setSelectedGif(null)}
                  >
                    <Ionicons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
              
              {isGifMode && (
                <View style={styles.gifsResultsContainer}>
                  {isLoadingGifs && gifs.length === 0 ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={TEAL_COLOR} />
                      <Text style={styles.loadingText}>Searching GIFs...</Text>
                    </View>
                  ) : gifs.length > 0 ? (
                    <FlatList
                      data={gifs}
                      numColumns={3}
                      keyExtractor={(item, index) => `${item.id}-${index}`}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          onPress={() => setSelectedGif(item.originalUrl === selectedGif ? null : item.originalUrl)}
                          style={styles.gifItemWrapper}
                        >
                          <Image 
                            source={{ uri: item.previewUrl }} 
                            style={[
                              styles.gifItemImage,
                              { borderWidth: item.originalUrl === selectedGif ? 2 : 0, borderColor: TEAL_COLOR }
                            ]}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      )}
                      onEndReached={loadMoreGifs}
                      onEndReachedThreshold={0.5}
                      ListFooterComponent={isLoadingGifs ? (
                        <View style={styles.loadingFooter}>
                          <ActivityIndicator size="small" color={TEAL_COLOR} />
                        </View>
                      ) : null}
                    />
                  ) : gifSearch.length > 2 ? (
                    <Text style={styles.noResultsText}>No GIFs found. Try another search.</Text>
                  ) : (
                    <Text style={styles.searchPromptText}>Type at least 3 characters to search for GIFs</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    marginBottom: 16,
  },
  card: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  playerContainer: {
    width: '100%',
    height: 160,
    backgroundColor: 'transparent',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  userInfoOutside: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginBottom: 4,
  },
  usernameText: {
    fontSize: 14,
    color: '#00AAAA',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  gifModeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gifModeButtonActive: {
    borderColor: TEAL_COLOR,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  gifsResultsContainer: {
    marginTop: 8,
    height: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 6,
    width: '100%',
    overflow: 'hidden',
  },
  gifItemWrapper: {
    flex: 1,
    aspectRatio: 1,
    padding: 4,
  },
  gifItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  selectedGifContainer: {
    marginTop: 8,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedGifImage: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  removeGifButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFooter: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#AAA',
    fontSize: 14,
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
    color: '#AAA',
    fontSize: 14,
  },
  searchPromptText: {
    padding: 16,
    textAlign: 'center',
    color: '#AAA',
    fontSize: 14,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 10,
    color: '#999',
  },
  commentGif: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  commentActionText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    color: '#FFF',
  },
  replyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TEAL_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  }
});