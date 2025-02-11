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
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';

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

  // If no post exists, show a minimal message.
  if (!submittedPost) {
    return (
      <View style={styles.container}>
        <Text style={styles.infoText}>No Song of the Day submitted yet.</Text>
      </View>
    );
  }

  // Format the time elapsed.
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

  // Toggle like.
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
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment.');
    }
  };

  // Format like count text.
  const formatLikesText = () => {
    if (!submittedPost?.likes) return '';
    const count = submittedPost.likes.length;
    return count > 0 ? `${count} Like${count > 1 ? 's' : ''}` : '';
  };

  // Toggle play/pause using a hidden WebView.
  const togglePlayPause = () => {
    if (!webViewRef.current) return;
    let script = '';
    if (isPlaying) {
      script = `(function(){ 
        var btn = document.querySelector('button[aria-label="Pause"]'); 
        if(btn){ btn.click(); } 
      })();`;
    } else {
      script = `(function(){ 
        var btn = document.querySelector('button[aria-label="Play"]'); 
        if(btn){ btn.click(); } 
      })();`;
    }
    webViewRef.current.injectJavaScript(script);
    setIsPlaying(!isPlaying);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Song of the Day</Text>
      <View style={styles.card}>
        <Text style={styles.timeText}>{timeAgo(submittedPost.createdAt)}</Text>
        <Text style={styles.trackName}>{submittedPost.trackName}</Text>
        <Text style={styles.trackArtist}>{submittedPost.trackArtist}</Text>
        {submittedPost.trackImage && (
          <Image
            source={{ uri: submittedPost.trackImage }}
            style={styles.albumCover}
          />
        )}
        {/* Hidden WebView for playback */}
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
        <View style={styles.controls}>
  <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
    <Icon 
      name={isPlaying ? "pause" : "play-arrow"} 
      size={28} 
      color="#000"
      style={{ marginLeft: isPlaying ? 0 : 3 }}
    />
  </TouchableOpacity>
  
  <TouchableOpacity style={styles.likeButton} onPress={toggleLike}>
    <Icon
      name={submittedPost.likes?.includes(spotifyId) ? "favorite" : "favorite-border"}
      size={18}
      color="#00A3A3"
    />
    <Text style={styles.likeButtonText}>
      {submittedPost.likes?.includes(spotifyId) ? 'Unlike' : 'Like'}
    </Text>
  </TouchableOpacity>

  {formatLikesText() !== '' && (
    <Text style={styles.likesCount}>{formatLikesText()}</Text>
  )}
</View>
        {/* Toggle Comments Section */}
        <TouchableOpacity
          style={styles.toggleCommentsButton}
          onPress={() => setShowComments(!showComments)}
        >
          <Text style={styles.toggleCommentsText}>
            {showComments
              ? 'Hide Comments'
              : `View Comments (${
                  submittedPost.comments
                    ? submittedPost.comments.length
                    : 0
                })`}
          </Text>
        </TouchableOpacity>
        {showComments && (
          <View style={styles.commentsContainer}>
            {submittedPost.comments && submittedPost.comments.length > 0 ? (
              <FlatList
                data={submittedPost.comments}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Text style={styles.commentUser}>{item.user}:</Text>
                    <Text style={styles.commentText}>{item.text}</Text>
                    <Text style={styles.commentTime}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.noComments}>No comments yet.</Text>
            )}
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#00FFFF80"
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity
              style={styles.submitCommentButton}
              onPress={submitComment}
            >
              <Text style={styles.submitCommentButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8F9FA',
      paddingHorizontal: 16,
      paddingTop: 48, // Safe area for notch
    },
    header: {
      fontSize: 26,
      color: '#00A3A3',
      fontWeight: '800',
      marginBottom: 24,
      letterSpacing: -0.8,
      textAlign: 'left',
      paddingLeft: 8,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 18,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    timeText: {
      fontSize: 13,
      color: '#00A3A3',
      marginBottom: 6,
      fontWeight: '600',
    },
    trackName: {
      fontSize: 20,
      fontWeight: '800',
      color: '#111827',
      marginBottom: 4,
      letterSpacing: -0.4,
    },
    trackArtist: {
      fontSize: 15,
      color: '#00A3A3',
      marginBottom: 16,
      fontWeight: '600',
    },
    albumCover: {
      width: '100%',
      height: 240,
      borderRadius: 14,
      marginBottom: 16,
      backgroundColor: '#E6FCFF',
    },
    webViewWrapper: {
      width: 0,
      height: 0,
      opacity: 0,
    },
    webView: {
      flex: 1,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginVertical: 8,
      paddingHorizontal: 8,
    },
    playButton: {
      backgroundColor: '#00FFFF',
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#00FFFF',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    playButtonText: {
      fontSize: 24,
      color: '#000',
      fontWeight: '800',
      marginLeft: 3,
    },
    likeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 18,
      backgroundColor: '#E6FCFF',
      borderWidth: 1.5,
      borderColor: '#00FFFF',
    },
    likeButtonText: {
      color: '#00A3A3',
      fontSize: 14,
      fontWeight: '700',
    },
    likesCount: {
      fontSize: 14,
      color: '#374151',
      fontWeight: '500',
      marginLeft: 'auto',
    },
    toggleCommentsButton: {
      paddingVertical: 12,
      marginTop: 6,
    },
    toggleCommentsText: {
      fontSize: 14,
      color: '#00A3A3',
      fontWeight: '700',
      textAlign: 'center',
    },
    commentsContainer: {
      marginTop: 12,
      paddingTop: 12,
    },
    commentItem: {
      backgroundColor: '#F0FFFF',
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#E6FCFF',
    },
    commentUser: {
      fontSize: 13,
      fontWeight: '800',
      color: '#007D7D',
      marginBottom: 2,
    },
    commentText: {
      fontSize: 15,
      color: '#374151',
      lineHeight: 22,
      marginBottom: 6,
    },
    commentTime: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '500',
    },
    noComments: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
      paddingVertical: 16,
    },
    commentInput: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: '#111827',
      borderWidth: 1.5,
      borderColor: '#00FFFF',
      marginBottom: 10,
    },
    submitCommentButton: {
      backgroundColor: '#00FFFF',
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00FFFF',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    submitCommentButtonText: {
      color: '#000',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    infoText: {
      fontSize: 16,
      color: '#6B7280',
      textAlign: 'center',
      marginTop: 40,
    },
  });