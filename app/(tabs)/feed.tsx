import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Image,
  ImageStyle,
  ViewStyle,
  TextStyle
} from 'react-native';
import WebView from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// Interface definitions
interface Comment {
  user: string;
  text: string;
  gifUrl?: string;
  createdAt: string;
}

interface SongPost {
  _id: string;
  trackId: string;
  trackName: string;
  trackArtist: string;
  trackImage: string;
  spotifyId: string;
  likes: string[];
  comments: Comment[];
}

interface SongCardProps {
  songPost: SongPost;
  currentUserSpotifyId: string | null;
  onLike: (songId: string) => Promise<void>;
  onComment: (songId: string, comment: string, gifUrl?: string) => Promise<void>;
}

interface DynamicStyles {
  card: ViewStyle;
  cardContent: ViewStyle;
  cardHeader: ViewStyle;
  likeText: TextStyle;
  commentsText: TextStyle;
  commentItem: ViewStyle;
  commentUser: TextStyle;
  commentText: TextStyle;
  inputContainer: ViewStyle;
  input: TextStyle;
  sendButton: ViewStyle;
  emptyCommentsText: TextStyle;
  gifPickerContainer: ViewStyle;
  gifSearchInput: TextStyle;
  commentGif: ImageStyle;
  gifItem: ImageStyle;
}

// SongCard component
const SongCard = ({ 
  songPost, 
  currentUserSpotifyId, 
  onLike, 
  onComment 
}: SongCardProps) => {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [hasLiked, setHasLiked] = useState(
    currentUserSpotifyId ? songPost.likes.includes(currentUserSpotifyId) : false
  );
  const [dominantColor, setDominantColor] = useState('#3E3E35');
  const [isGifMode, setIsGifMode] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);

  const animatedHeight = useRef(new Animated.Value(0)).current;
  const commentOpacity = useRef(new Animated.Value(0)).current;

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

  const fetchGifs = async (searchTerm: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/giphy/search?query=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      setGifs(data.gifs || []);
    } catch (error) {
      console.error('Error fetching GIFs:', error);
    }
  };

  const handleGifSearch = (text: string) => {
    setGifSearch(text);
    if (text.length > 2) fetchGifs(text);
    else setGifs([]);
  };

  const toggleGifMode = () => {
    setIsGifMode(!isGifMode);
    setSelectedGif(null);
    setGifSearch('');
    setGifs([]);
    setNewComment('');
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

  const spotifyEmbedHtml = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body { margin: 0; padding: 0; background-color: transparent; overflow: hidden; height: 100%; width: 100%; }
          iframe { border: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
        </style>
        <script>
          function getIframeBackgroundColor() {
            setTimeout(() => {
              const iframe = document.querySelector('iframe');
              if (iframe && iframe.contentDocument) {
                const bgColor = getComputedStyle(iframe.contentDocument.body).backgroundColor;
                if (bgColor) window.ReactNativeWebView.postMessage(bgColor);
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
          onload="getIframeBackgroundColor()"
        ></iframe>
      </body>
    </html>
  `;

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    const color = event.nativeEvent.data;
    if (color && color !== '') {
      if (color.startsWith('rgb')) {
        const rgbValues = color.match(/\d+/g);
        if (rgbValues && rgbValues.length >= 3) {
          const r = parseInt(rgbValues[0]);
          const g = parseInt(rgbValues[1]);
          const b = parseInt(rgbValues[2]);
          setDominantColor(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        }
      } else {
        setDominantColor(color);
      }
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
  const TEAL_COLOR = '#00FFFF';

  const dynamicStyles: DynamicStyles = {
    card: {
      backgroundColor: dominantColor,
      borderRadius: 12,
      overflow: 'hidden',
      marginVertical: 8,
      marginHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    cardContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    likeText: {
      color: TEAL_COLOR,
      fontSize: 14,
      marginLeft: 8,
      fontWeight: '600',
    },
    commentsText: {
      color: textColor,
      fontSize: 14,
      marginRight: 8,
    },
    commentItem: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginVertical: 4,
      backgroundColor: `${dominantColor}CC`,
      borderRadius: 8,
      borderLeftWidth: 2,
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
      marginBottom: 4,
    },
    input: {
      flex: 1,
      backgroundColor: `${dominantColor}80`,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: textColor,
      fontSize: 14,
      borderWidth: 1,
      borderColor: `${textColor}40`,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
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
    gifPickerContainer: {
      backgroundColor: `${dominantColor}CC`,
      borderRadius: 8,
      padding: 8,
      marginTop: 8,
      maxHeight: 150,
    },
    gifSearchInput: {
      flex: 1,
      backgroundColor: `${dominantColor}80`,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: textColor,
      fontSize: 14,
      borderWidth: 1,
      borderColor: `${textColor}40`,
    },
    commentGif: {
      width: 80,
      height: 80,
      borderRadius: 4,
      marginTop: 4,
    },
    gifItem: {
      width: 80,
      height: 80,
      margin: 4,
      borderRadius: 4,
    },
  };

  return (
    <View style={dynamicStyles.card}>
      <View style={styles.playerContainer}>
        <WebView
          source={{ html: spotifyEmbedHtml }}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          onMessage={handleWebViewMessage}
        />
      </View>
      
      <View style={dynamicStyles.cardContent}>
        <View style={dynamicStyles.cardHeader}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleLike}
            disabled={!currentUserSpotifyId}
          >
            <Ionicons 
              name={hasLiked ? "heart" : "heart-outline"} 
              size={22} 
              color={TEAL_COLOR} 
            />
            <Text style={dynamicStyles.likeText}>
              {songPost.likes.length}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={toggleComments}
          >
            <Text style={dynamicStyles.commentsText}>
              {songPost.comments.length} Comments
            </Text>
            <MaterialIcons 
              name={commentsExpanded ? "expand-less" : "expand-more"} 
              size={24} 
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
            {songPost.comments.length > 0 ? (
              <FlatList
                data={songPost.comments}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={dynamicStyles.commentItem}>
                    <Text style={dynamicStyles.commentUser}>{item.user}</Text>
                    {item.text && <Text style={dynamicStyles.commentText}>{item.text}</Text>}
                    {item.gifUrl && (
                      <Image 
                        source={{ uri: item.gifUrl }} 
                        style={dynamicStyles.commentGif}
                      />
                    )}
                  </View>
                )}
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
          <View style={dynamicStyles.inputContainer}>
            {isGifMode ? (
              <>
                <TextInput
                  style={dynamicStyles.gifSearchInput}
                  placeholder="Search GIFs..."
                  placeholderTextColor={`${textColor}80`}
                  value={gifSearch}
                  onChangeText={handleGifSearch}
                />
                {gifs.length > 0 && (
                  <View style={dynamicStyles.gifPickerContainer}>
                    <FlatList
                      data={gifs}
                      horizontal
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => setSelectedGif(item.originalUrl === selectedGif ? null : item.originalUrl)}>
                          <Image 
                            source={{ uri: item.previewUrl }} 
                            style={[
                              dynamicStyles.gifItem,
                              { borderWidth: item.originalUrl === selectedGif ? 2 : 0, borderColor: TEAL_COLOR }
                            ]}
                          />
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </>
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
              style={[dynamicStyles.sendButton, { backgroundColor: '#666' }]}
              onPress={toggleGifMode}
            >
              <MaterialIcons name={isGifMode ? "text-fields" : "gif"} size={24} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                dynamicStyles.sendButton,
                (!newComment.trim() && !selectedGif) || submittingComment ? { opacity: 0.6 } : {}
              ]}
              onPress={handleComment}
              disabled={(!newComment.trim() && !selectedGif) || submittingComment}
            >
              <Ionicons name="paper-plane" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

// Main component
export default function SongOfTheDay() {
  const [songs, setSongs] = useState<SongPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserSpotifyId, setCurrentUserSpotifyId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const userSpotifyId = await SecureStore.getItemAsync('spotify_id');
        setCurrentUserSpotifyId(userSpotifyId);
        await fetchSongs();
      } catch (error) {
        console.error('Initialization error:', error);
        setError('Failed to initialize');
      }
    };
    init();
  }, []);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:3000/api/leaderboard');
      const data = await response.json();
      
      if (data.leaderboard && data.leaderboard.length > 0) {
        const processedSongs = await Promise.all(
          data.leaderboard.map(async (song: any) => {
            try {
              const songResponse = await fetch(`http://localhost:3000/api/songOfTheDay/${song._id}`);
              const songData = await songResponse.json();
              if (songData.song) return songData.song;
            } catch (err) {
              console.error('Error fetching song details:', err);
            }
            return {
              _id: song._id,
              trackId: song.trackId,
              trackName: song.trackName,
              trackArtist: song.trackArtist,
              trackImage: song.trackImage,
              spotifyId: song.spotifyId,
              likes: new Array(song.likesCount || 0).fill(''),
              comments: []
            };
          })
        );
        setSongs(processedSongs);
      } else {
        setError('No songs available');
      }
    } catch (error) {
      console.error('Error fetching songs:', error);
      setError('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (songId: string) => {
    if (!currentUserSpotifyId) return;
    try {
      const response = await fetch(`http://localhost:3000/api/songOfTheDay/${songId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyId: currentUserSpotifyId })
      });
      if (response.ok) {
        setSongs(prevSongs => 
          prevSongs.map(song => {
            if (song._id === songId) {
              const isLiked = song.likes.includes(currentUserSpotifyId);
              const updatedLikes = isLiked
                ? song.likes.filter(id => id !== currentUserSpotifyId)
                : [...song.likes, currentUserSpotifyId];
              return { ...song, likes: updatedLikes };
            }
            return song;
          })
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = async (songId: string, commentText: string, gifUrl?: string) => {
    if (!currentUserSpotifyId) return;
    try {
      const response = await fetch(`http://localhost:3000/api/songOfTheDay/${songId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          spotifyId: currentUserSpotifyId,
          text: commentText,
          gifUrl
        })
      });
      if (response.ok) {
        setSongs(prevSongs => 
          prevSongs.map(song => {
            if (song._id === songId) {
              const newComment = {
                user: currentUserSpotifyId,
                text: commentText,
                gifUrl,
                createdAt: new Date().toISOString()
              };
              return { 
                ...song, 
                comments: [...song.comments, newComment] 
              };
            }
            return song;
          })
        );
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#00FFFF" />
          <Text style={styles.loadingText}>Loading songs...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchSongs}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Song of the Day</Text>
      <FlatList
        data={songs}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <SongCard
            songPost={item}
            currentUserSpotifyId={currentUserSpotifyId}
            onLike={handleLike}
            onComment={handleComment}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00FFFF',
    marginTop: 60,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#777',
    marginLeft: 10,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#ff6b6b',
    marginBottom: 16,
    textAlign: 'center',
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#00FFFF',
    borderRadius: 20,
  },
  refreshButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
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
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
});