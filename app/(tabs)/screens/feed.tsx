import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  Keyboard,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';

const PRIMARY_COLOR = '#00ffff';
const BACKEND_SONG_ENDPOINT = 'http://localhost:3000/api/songOfTheDay';

export default function SongOfTheDayFeed() {
  const [token, setToken] = useState<string | null>(null);
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [submittedPost, setSubmittedPost] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Fetch user token and song post on mount.
  useEffect(() => {
    async function fetchData() {
      const storedToken = await SecureStore.getItemAsync('spotify_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          const userData = await res.json();
          setSpotifyId(userData.id);
          const getRes = await fetch(
            `${BACKEND_SONG_ENDPOINT}?spotifyId=${userData.id}`
          );
          if (getRes.ok) {
            const getData = await getRes.json();
            if (getData.post) {
              setSubmittedPost(getData.post);
            }
          }
        } catch (err) {
          console.error('Error fetching user info', err);
        }
      }
    }
    fetchData();
  }, []);

  // Display a simple message if no post exists.
  if (!submittedPost) {
    return (
      <View style={styles.container}>
        <Text style={styles.infoText}>No Song of the Day submitted yet.</Text>
      </View>
    );
  }

  // Utility to format how long ago the post was created.
  const timeAgo = (dateStr: string) => {
    const postDate = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - postDate.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  // Like toggling logic.
  const toggleLike = async () => {
    if (!submittedPost || !spotifyId) return;
    try {
      const res = await fetch(
        `${BACKEND_SONG_ENDPOINT}/${submittedPost._id}/like`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spotifyId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSubmittedPost({ ...submittedPost, likes: data.likes });
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to toggle like.');
    }
  };

  // Submit a comment.
  const submitComment = async () => {
    if (!submittedPost || !spotifyId || !commentText.trim()) return;
    try {
      const res = await fetch(
        `${BACKEND_SONG_ENDPOINT}/${submittedPost._id}/comment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spotifyId, text: commentText.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSubmittedPost({ ...submittedPost, comments: data.comments });
        setCommentText('');
        setShowComments(true); // Auto-show comments after posting
        Keyboard.dismiss();
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment.');
    }
  };

  // Toggle play/pause via a hidden WebView.
  const playSong = () => {
    if (!webViewRef.current) return;
    const script = `(function(){
      var btn = document.querySelector('button[aria-label="Play"]');
      if(btn) {
         btn.click();
         setTimeout(function(){ btn.click(); }, 100);
         setTimeout(function(){ btn.click(); }, 200);
      }
    })();`;
    webViewRef.current.injectJavaScript(script);
    setTimeout(() => setIsPlaying(true), 300);
  };

  const pauseSong = () => {
    if (!webViewRef.current) return;
    const script = `(function(){
      var btn = document.querySelector('button[aria-label="Pause"]');
      if(btn) {
        btn.click();
        setTimeout(function(){ btn.click(); }, 100);
        setTimeout(function(){ btn.click(); }, 200);
      }
    })();`;
    webViewRef.current.injectJavaScript(script);
    setTimeout(() => setIsPlaying(false), 300);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pauseSong();
    } else {
      playSong();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Song of the Day</Text>
      </View>
      

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: submittedPost.trackImage }}
            style={styles.albumArt}
          />
          <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={1}>
              {submittedPost.trackName}
            </Text>
            <Text style={styles.trackArtist}>{submittedPost.trackArtist}</Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo(submittedPost.createdAt)}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayPause}
          >
            <Icon
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={28}
              color="#000"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.likeButton}
            onPress={toggleLike}
          >
            <Icon
              name={
                submittedPost.likes?.includes(spotifyId)
                  ? 'favorite'
                  : 'favorite-border'
              }
              size={24}
              color={
                submittedPost.likes?.includes(spotifyId) ? PRIMARY_COLOR : '#666'
              }
            />
            <Text style={styles.likeCount}>
              {submittedPost.likes?.length || 0}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentHeader}>
          <Text style={styles.sectionTitle}>Comments</Text>
          <TouchableOpacity onPress={() => setShowComments(!showComments)}>
            <Text style={styles.toggleComments}>
              {showComments ? 'Hide' : `Show all (${submittedPost.comments?.length || 0})`}
            </Text>
          </TouchableOpacity>
        </View>

        {showComments && (
          <FlatList
            data={submittedPost.comments}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={styles.comment}>
                <Text style={styles.commentUser}>{item.user}</Text>
                <Text style={styles.commentText}>{item.text}</Text>
                <Text style={styles.commentTime}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.noComments}>No comments yet</Text>
            }
            contentContainerStyle={styles.commentsList}
          />
        )}

        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#888"
            value={commentText}
            onChangeText={setCommentText}
            onSubmitEditing={submitComment}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={submitComment}
          >
            <Icon name="send" size={20} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Hidden WebView for Spotify playback */}
        <View style={styles.webViewWrapper}>
          <WebView
            ref={webViewRef}
            source={{
              uri: `https://open.spotify.com/embed/track/${submittedPost.trackId}`,
            }}
            style={styles.webView}
            allowsInlineMediaPlayback
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00ffff',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    padding: 16,
    paddingTop: 120,
  },
  headerText: {
    color: '#000',
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackArtist: {
    color: '#888',
    fontSize: 14,
  },
  timeAgo: {
    color: '#444',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  playButton: {
    backgroundColor: PRIMARY_COLOR,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    color: '#666',
    fontSize: 14,
    marginLeft: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleComments: {
    color: PRIMARY_COLOR,
    fontSize: 14,
  },
  commentsList: {
    paddingBottom: 16,
  },
  comment: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  commentUser: {
    color: PRIMARY_COLOR,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  commentText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  commentTime: {
    color: '#444',
    fontSize: 10,
  },
  noComments: {
    color: '#444',
    textAlign: 'center',
    paddingVertical: 16,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 25,
    paddingHorizontal: 16,
  },
  commentInput: {
    flex: 1,
    color: '#fff',
    height: 48,
    fontSize: 14,
  },
  sendButton: {
    padding: 8,
  },
  webViewWrapper: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  webView: {
    width: '100%',
    height: 300,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
});