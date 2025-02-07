// app/(tabs)/song-of-the-day.tsx

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { WebView } from 'react-native-webview';

const BACKEND_SONG_ENDPOINT = 'http://localhost:3000/api/songOfTheDay';
const SPOTIFY_SEARCH_ENDPOINT = 'https://api.spotify.com/v1/search';

export default function SongOfTheDayScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [submittedPost, setSubmittedPost] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  // Local "play/pause" state (not guaranteed to sync with the actual embed).
  const [isPlaying, setIsPlaying] = useState(false);

  // Reference to the hidden WebView
  const webViewRef = useRef<WebView>(null);

  // On mount, fetch the token, Spotify user info, and existing song post
  useEffect(() => {
    const fetchTokenAndUser = async () => {
      const storedToken = await SecureStore.getItemAsync('spotify_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          const userData = await res.json();
          setSpotifyId(userData.id);

          // Fetch song of the day for this user (if any)
          const getRes = await fetch(`${BACKEND_SONG_ENDPOINT}?spotifyId=${userData.id}`);
          if (getRes.ok) {
            const getData = await getRes.json();
            if (getData.post) {
              setSubmittedPost(getData.post);
            }
          }
        } catch (err) {
          console.error('Error fetching Spotify user info', err);
        }
      }
    };
    fetchTokenAndUser();
  }, []);

  // Search Spotify for songs
  const searchSongs = async () => {
    if (!token || !searchQuery) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SPOTIFY_SEARCH_ENDPOINT}?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.tracks && data.tracks.items) {
        setResults(data.tracks.items);
      }
    } catch (err) {
      console.error('Error searching songs:', err);
      Alert.alert('Error', 'Failed to search songs');
    } finally {
      setLoading(false);
    }
  };

  // Submit the selected song as the Song of the Day
  const submitSong = async () => {
    if (!spotifyId || !selectedSong) return;
    try {
      const body = {
        spotifyId,
        trackId: selectedSong.id,
        trackName: selectedSong.name,
        trackArtist: selectedSong.artists.map((a: any) => a.name).join(', '),
        trackImage: selectedSong.album.images[0]?.url || '',
      };
      const res = await fetch(BACKEND_SONG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        Alert.alert('Song of the Day submitted');
        setSubmittedPost(data.post);
      } else {
        Alert.alert('Error', data.error || 'Failed to submit song');
      }
    } catch (err) {
      console.error('Error submitting song:', err);
      Alert.alert('Error', 'Failed to submit song');
    }
  };

  // Helper function to format the time elapsed
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

  // Toggle like on the submitted post
  const toggleLike = async () => {
    if (!submittedPost || !spotifyId) return;
    try {
      const res = await fetch(`${BACKEND_SONG_ENDPOINT}/${submittedPost._id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyId }),
      });
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

  // Submit a comment on the submitted post
  const submitComment = async () => {
    if (!submittedPost || !spotifyId || !commentText.trim()) return;
    try {
      const res = await fetch(`${BACKEND_SONG_ENDPOINT}/${submittedPost._id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyId, text: commentText.trim() }),
      });
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

  // If we have a post, user has already submitted a Song of the Day
  const alreadySubmitted = !!submittedPost;

  // Helper functions to format like and comment counts
  const formatLikesText = () => {
    if (!submittedPost?.likes) return '';
    const count = submittedPost.likes.length;
    if (count === 0) return '';
    return count === 1 ? '1 Like' : `${count} Likes`;
  };

  const formatCommentsText = () => {
    if (!submittedPost?.comments) return '';
    const count = submittedPost.comments.length;
    if (count === 0) return '';
    return count === 1 ? '1 Comment' : `${count} Comments`;
  };

  /**
   * Plays or pauses the Spotify embed by injecting a small script that
   * clicks the correct button in the hidden iframe, depending on whether
   * we want to play or pause. This is a hacky approach.
   */
  const togglePlayPause = () => {
    if (!webViewRef.current) return;

    let script = '';

    if (isPlaying) {
      // If currently playing, find the Pause button and click it.
      script = `
        (function() {
          var pauseBtn = document.querySelector('button[aria-label="Pause"]');
          if (pauseBtn) { pauseBtn.click(); }
        })();
      `;
    } else {
      // If currently paused, find the Play button and click it.
      script = `
        (function() {
          var playBtn = document.querySelector('button[aria-label="Play"]');
          if (playBtn) { playBtn.click(); }
        })();
      `;
    }

    webViewRef.current.injectJavaScript(script);
    setIsPlaying(!isPlaying);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Song of the Day</Text>

      {alreadySubmitted ? (
        <View style={styles.postContainer}>
          {/* Timestamp at the top */}
          <Text style={styles.postTime}>Posted {timeAgo(submittedPost.createdAt)}</Text>

          {/* Song Title & Artist */}
          <Text style={styles.postTitle}>{submittedPost.trackName}</Text>
          <Text style={styles.postArtist}>{submittedPost.trackArtist}</Text>

          {/* Album/Track Cover if available */}
          {submittedPost.trackImage ? (
            <Image
              source={{ uri: submittedPost.trackImage }}
              style={styles.albumCover}
            />
          ) : null}

          {/* Hidden WebView for playback */}
          <View style={styles.hiddenWebViewContainer}>
            <WebView
              ref={webViewRef}
              source={{
                uri: `https://open.spotify.com/embed/track/${submittedPost.trackId}`,
              }}
              style={styles.hiddenWebView}
              allowsInlineMediaPlayback
            />
          </View>

          {/* Circular Play/Pause Button */}
          <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause}>
            <Text style={styles.playPauseButtonIcon}>
              {isPlaying ? '❚❚' : '►'}
            </Text>
          </TouchableOpacity>

          {/* Like Button + Count */}
          <View style={styles.likeButtonContainer}>
            <TouchableOpacity style={styles.likeButton} onPress={toggleLike}>
              <Text style={styles.likeButtonText}>
                {submittedPost.likes?.includes(spotifyId) ? 'Unlike' : 'Like'}
              </Text>
            </TouchableOpacity>
            {formatLikesText().length > 0 && (
              <Text style={styles.countText}>{formatLikesText()}</Text>
            )}
          </View>

          {/* Comments Section */}
          <View style={styles.commentsContainer}>
            {formatCommentsText().length > 0 && (
              <Text style={styles.countText}>{formatCommentsText()}</Text>
            )}
            <Text style={styles.commentsTitle}>Comments</Text>
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
              placeholderTextColor="#888"
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity style={styles.submitCommentButton} onPress={submitComment}>
              <Text style={styles.submitCommentButtonText}>Submit Comment</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a song..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={searchSongs}
            disabled={loading || !searchQuery}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          {results.length > 0 && (
            <View style={styles.resultsContainer}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => setSelectedSong(item)}
                  >
                    <Text style={styles.resultText}>
                      {item.name} - {item.artists.map((a: any) => a.name).join(', ')}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
          {selectedSong && (
            <View style={styles.selectedContainer}>
              <Text style={styles.selectedText}>
                Selected: {selectedSong.name} -{' '}
                {selectedSong.artists.map((a: any) => a.name).join(', ')}
              </Text>
              <TouchableOpacity style={styles.submitSongButton} onPress={submitSong}>
                <Text style={styles.submitSongButtonText}>Submit Song of the Day</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ----------------- STYLES ----------------- //

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#00FFFF',
    textAlign: 'center',
    marginBottom: 25,
  },
  searchInput: {
    backgroundColor: '#F8F8F8',
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  searchButton: {
    backgroundColor: '#00FFFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  resultsContainer: {
    maxHeight: 200,
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#FFF',
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  resultText: {
    fontSize: 16,
    color: '#333',
  },
  selectedContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  selectedText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 15,
  },
  submitSongButton: {
    backgroundColor: '#00FFFF',
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  submitSongButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },

  // Post layout
  postContainer: {
    backgroundColor: '#FFF',
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  postTime: {
    fontSize: 14,
    color: '#777',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00FFFF',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  postArtist: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  albumCover: {
    width: 200,
    height: 200,
    marginBottom: 15,
    borderRadius: 8,
  },

  // Hidden WebView
  hiddenWebViewContainer: {
    width: 1,
    height: 1,
    opacity: 0,
  },
  hiddenWebView: {
    flex: 1,
  },

  // Circular play/pause button
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  playPauseButtonIcon: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },

  // Like button + likes text
  likeButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  likeButton: {
    backgroundColor: '#00FFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  likeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  countText: {
    fontSize: 16,
    color: '#333',
  },

  // Comments
  commentsContainer: {
    width: '100%',
    marginTop: 15,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#00FFFF',
    marginBottom: 10,
  },
  commentItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 8,
  },
  commentUser: {
    fontWeight: '600',
    color: '#00FFFF',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  noComments: {
    fontStyle: 'italic',
    color: '#999',
    marginBottom: 10,
  },
  commentInput: {
    backgroundColor: '#F8F8F8',
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  submitCommentButton: {
    backgroundColor: '#00FFFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitCommentButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
