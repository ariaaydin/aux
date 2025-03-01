// app/(tabs)/feed.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SongCard } from '../../components/SongCard';

// Backend endpoint (adjust for emulator)
const API_URL = __DEV__ 
  ? Platform.OS === 'android' 
    ? 'http://10.0.2.2:3000' // Android emulator
    : 'http://localhost:3000'  // iOS simulator
  : 'http://localhost:3000';   // Production URL

// Interface for song post
// Add this to your interface definitions at the top of the file
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

// Then update your SongPost interface to use the Comment type
interface SongPost {
  _id: string;
  trackId: string;
  trackName: string;
  trackArtist: string;
  trackImage: string;
  spotifyId: string;
  username?: string;
  likes: string[];
  comments: Comment[];  // Use the Comment type instead of any[]
  createdAt: string;
}

export default function FeedScreen() {
  const [songs, setSongs] = useState<SongPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserSpotifyId, setCurrentUserSpotifyId] = useState<string | null>(null);
  
  // Ref to track if initial fetch is done
  const initialFetchDone = useRef(false);
  // Ref to track ongoing fetch
  const fetchInProgress = useRef(false);
  
  const router = useRouter();

  // Fetch current user data
  useEffect(() => {
    const init = async () => {
      try {
        const userSpotifyId = await SecureStore.getItemAsync('spotify_id');
        console.log('Current user ID:', userSpotifyId);
        setCurrentUserSpotifyId(userSpotifyId);
        
        if (userSpotifyId) {
          await fetchFeed(userSpotifyId);
          initialFetchDone.current = true;
        } else {
          setError('User not logged in');
          setLoading(false);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setError('Failed to initialize');
        setLoading(false);
      }
    };
    init();
  }, []);

  // Refresh when tab comes into focus, but avoid duplicate calls
  useFocusEffect(
    useCallback(() => {
      if (currentUserSpotifyId && initialFetchDone.current && !fetchInProgress.current) {
        fetchFeed(currentUserSpotifyId);
      }
      return () => {};
    }, [currentUserSpotifyId])
  );

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    if (currentUserSpotifyId && !fetchInProgress.current) {
      setRefreshing(true);
      fetchFeed(currentUserSpotifyId);
    }
  }, [currentUserSpotifyId]);

  // Fetch feed data from backend with improved error handling
  const fetchFeed = async (userId: string) => {
    // Prevent multiple fetch calls
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgress.current = true;
    
    try {
      console.log(`Fetching feed for user: ${userId}`);
      if (!refreshing) setLoading(true);
      setError(null);
      
      const feedUrl = `${API_URL}/api/feed/${userId}`;
      console.log(`Fetching from URL: ${feedUrl}`);
      
      // Add abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        const response = await fetch(feedUrl, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Feed data:', data);
        
        // Always set songs to an array, empty or not
        setSongs(data.feed || []);
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again later.');
        } else {
          throw fetchError;
        }
      }
    } catch (error: any) {
      console.error('Error fetching feed:', error);
      
      let errorMessage = 'Failed to load feed';
      
      // More specific error messages based on error type
      if (error.message.includes('timed out') || error.message.includes('abort')) {
        errorMessage = 'Connection timed out. Please check your network and try again.';
      } else if (error.message.includes('Network request failed') || error.message.includes('network')) {
        errorMessage = 'Network connection error. Please check your connection.';
      } else {
        errorMessage = `Error loading feed: ${error.message}`;
      }
      
      setError(errorMessage);
      
      // In case of error, set empty array to avoid undefined issues
      setSongs([]);
    } finally {
      fetchInProgress.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle liking a song
  const handleLike = async (songId: string) => {
    if (!currentUserSpotifyId) return;
    try {
      const response = await fetch(`${API_URL}/api/songOfTheDay/${songId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyId: currentUserSpotifyId })
      });
      
      if (response.ok) {
        // Update UI optimistically
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
      } else {
        Alert.alert('Error', 'Failed to update like');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Network error while updating like');
    }
  };

  // Handle adding a comment
  const handleComment = async (songId: string, commentText: string, gifUrl?: string) => {
    if (!currentUserSpotifyId) return;
    try {
      const response = await fetch(`${API_URL}/api/songOfTheDay/${songId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          spotifyId: currentUserSpotifyId,
          text: commentText,
          gifUrl
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Update UI with the returned comment that includes ID
        setSongs(prevSongs => 
          prevSongs.map(song => {
            if (song._id === songId) {
              return { 
                ...song, 
                comments: [...song.comments, result.comment] 
              };
            }
            return song;
          })
        );
      } else {
        Alert.alert('Error', 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Network error while adding comment');
    }
  };

  // Handle liking a comment
  const handleCommentLike = async (songId: string, commentId: string) => {
    if (!currentUserSpotifyId) return;
    console.log(`Liking comment ${commentId} for song ${songId}`); // Debug log
    
    try {
      const response = await fetch(`${API_URL}/api/songOfTheDay/${songId}/comment/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyId: currentUserSpotifyId })
      });
      
      console.log('Response status:', response.status); // Debug log
      
      if (response.ok) {
        const result = await response.json();
        console.log('Like result:', result); // Debug log
        
        // Update UI with the new likes
        setSongs(prevSongs => 
          prevSongs.map(song => {
            if (song._id === songId) {
              // Create a deep copy of song to avoid mutation issues
              const updatedSong = { ...song };
              
              // If comments exist
              if (updatedSong.comments && updatedSong.comments.length > 0) {
                // Update comments array with new likes
                updatedSong.comments = updatedSong.comments.map(comment => {
                  // Check if this is the comment we're looking for
                  if (comment.id === commentId) {
                    return { ...comment, likes: result.likes };
                  }
                  
                  // Check if this is in the replies
                  if (comment.replies && comment.replies.length > 0) {
                    const updatedReplies = comment.replies.map(reply => 
                      reply.id === commentId ? { ...reply, likes: result.likes } : reply
                    );
                    return { ...comment, replies: updatedReplies };
                  }
                  
                  return comment;
                });
              }
              
              return updatedSong;
            }
            return song;
          })
        );
      } else {
        console.error('Error response:', await response.text());
        Alert.alert('Error', 'Failed to update comment like');
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      Alert.alert('Error', 'Network error while updating comment like');
    }
  };

  // Handle replying to a comment
  const handleReply = async (songId: string, commentId: string, replyText: string) => {
    if (!currentUserSpotifyId) return;
    console.log(`Replying to comment ${commentId} on song ${songId} with text: ${replyText}`); // Debug log
    
    try {
      const response = await fetch(`${API_URL}/api/songOfTheDay/${songId}/comment/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          spotifyId: currentUserSpotifyId,
          text: replyText
        })
      });
      
      console.log('Response status:', response.status); // Debug log
      
      if (response.ok) {
        const result = await response.json();
        console.log('Reply result:', result); // Debug log
        
        // Update UI with the new reply
        setSongs(prevSongs => 
          prevSongs.map(song => {
            if (song._id === songId) {
              // Create a deep copy of song to avoid mutation issues
              const updatedSong = { ...song };
              
              // If comments exist
              if (updatedSong.comments && updatedSong.comments.length > 0) {
                // Update the specific comment with the new reply
                updatedSong.comments = updatedSong.comments.map(comment => {
                  if (comment.id === commentId) {
                    // Initialize replies array if it doesn't exist
                    const replies = comment.replies || [];
                    return { 
                      ...comment, 
                      replies: [...replies, result.reply]
                    };
                  }
                  return comment;
                });
              }
              
              return updatedSong;
            }
            return song;
          })
        );
      } else {
        console.error('Error response:', await response.text());
        Alert.alert('Error', 'Failed to add reply');
      }
    } catch (error) {
      console.error('Error adding reply:', error);
      Alert.alert('Error', 'Network error while adding reply');
    }
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FFFF" />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.headerText}>Feed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => {
              if (currentUserSpotifyId && !fetchInProgress.current) {
                fetchFeed(currentUserSpotifyId);
              }
            }}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty state
  if (songs.length === 0 && !loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerText}>Feed</Text>
        <View style={styles.emptyFeedContainer}>
          <Ionicons name="musical-notes" size={64} color="#CCCCCC" />
          <Text style={styles.emptyFeedTitle}>No songs in your feed</Text>
          <Text style={styles.emptyFeedText}>
            Follow friends to see their Songs of the Day
          </Text>
          <TouchableOpacity 
            style={styles.findFriendsButton}
            onPress={() => router.push('/(tabs)/account')}
          >
            <Text style={styles.findFriendsButtonText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Normal view with content
  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Feed</Text>
      <FlatList
        data={songs}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <SongCard
            songPost={item}
            currentUserSpotifyId={currentUserSpotifyId}
            onLike={handleLike}
            onComment={handleComment}
            onCommentLike={handleCommentLike}  // Add this new prop
            onReply={handleReply}              // Add this new prop
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        initialNumToRender={3}
        maxToRenderPerBatch={5}
        windowSize={5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No songs found</Text>
          </View>
        }
      />
    </View>
  );
}

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
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#777',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    marginBottom: 16,
    textAlign: 'center',
  },
  refreshButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#00FFFF',
    borderRadius: 20,
    alignSelf: 'center',
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyFeedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyFeedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyFeedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  findFriendsButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#00FFFF',
    borderRadius: 20,
  },
  findFriendsButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  }
});