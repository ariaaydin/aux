// app/profile/[spotifyId].tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import WebView from 'react-native-webview';

const BACKEND_USER_ENDPOINT = 'http://localhost:3000/api/users';

interface User {
  spotifyId: string;
  username: string;
  createdAt: string;
  followers?: number;
  following?: number;
}

interface Song {
  _id: string;
  trackId: string;
  trackName: string;
  trackArtist: string;
  trackImage: string;
  spotifyId: string;
  likes: string[];
  comments: any[];
  createdAt: string;
}

// Simple Song Item Component
const SongItem = ({ song, onLike, isLiked }: { 
  song: Song, 
  onLike: () => void, 
  isLiked: boolean 
}) => {
  const spotifyEmbedHtml = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html, body { margin: 0; padding: 0; background-color: #f8f8f8; overflow: hidden; height: 100%; width: 100%; }
        iframe { border: none; width: 100%; height: 80px; }
      </style>
    </head>
    <body>
      <iframe 
        src="https://open.spotify.com/embed/track/${song.trackId}?utm_source=generator" 
        frameborder="0" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
        loading="lazy"
      ></iframe>
    </body>
  </html>`;

  return (
    <View style={styles.songItem}>
      <View style={styles.songHeader}>
        <Text style={styles.songDate}>
          {new Date(song.createdAt).toLocaleDateString()}
        </Text>
        <TouchableOpacity onPress={onLike} style={styles.likeButton}>
          <Ionicons 
            name={isLiked ? "heart" : "heart-outline"} 
            size={22} 
            color="#00FFFF" 
          />
          <Text style={styles.likeCount}>{song.likes.length}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.playerContainer}>
        <WebView
          source={{ html: spotifyEmbedHtml }}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          originWhitelist={['*']}
          startInLoadingState={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          renderError={() => (
            <View style={styles.webViewError}>
              <Text>Failed to load track</Text>
            </View>
          )}
        />
      </View>
      
      <View style={styles.songInfo}>
        <Text style={styles.songTitle}>{song.trackName}</Text>
        <Text style={styles.songArtist}>{song.trackArtist}</Text>
      </View>
    </View>
  );
};

export default function UserProfileScreen() {
  // Get spotifyId from route params
  const params = useLocalSearchParams<{ spotifyId: string }>();
  const profileId = params.spotifyId;
  
  // State
  const [currentUserSpotifyId, setCurrentUserSpotifyId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  // Get current user's Spotify ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userSpotifyId = await SecureStore.getItemAsync('spotify_id');
        setCurrentUserSpotifyId(userSpotifyId);
      } catch (err) {
        console.error('Error fetching current user:', err);
        setError('Failed to fetch user information');
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    if (!profileId || !currentUserSpotifyId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user info
      const userResponse = await fetch(`${BACKEND_USER_ENDPOINT}/${profileId}`);
      if (!userResponse.ok) {
        throw new Error(`HTTP error! status: ${userResponse.status}`);
      }
      
      const userData = await userResponse.json();
      if (!userData.user) {
        throw new Error('User not found');
      }
      
      setUser(userData.user);
      
      // Fetch follower and following counts
      const followersResponse = await fetch(`${BACKEND_USER_ENDPOINT}/${profileId}/followers`);
      const followingResponse = await fetch(`${BACKEND_USER_ENDPOINT}/${profileId}/following`);
      
      if (followersResponse.ok) {
        const followersData = await followersResponse.json();
        setFollowersCount(followersData.followers ? followersData.followers.length : 0);
      }
      
      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        setFollowingCount(followingData.following ? followingData.following.length : 0);
      }
      
      // Check if current user is following this user
      const isFollowingResponse = await fetch(
        `${BACKEND_USER_ENDPOINT}/${currentUserSpotifyId}/isFollowing/${profileId}`
      );
      
      if (isFollowingResponse.ok) {
        const isFollowingData = await isFollowingResponse.json();
        setIsFollowing(isFollowingData.isFollowing);
      }
      
      // Fetch user's songs
      const songsResponse = await fetch(`${BACKEND_USER_ENDPOINT}/${profileId}/songs`);
      if (songsResponse.ok) {
        const songsData = await songsResponse.json();
        setSongs(songsData.songs || []);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [profileId, currentUserSpotifyId]);

  // Initial data fetch
  useEffect(() => {
    if (profileId && currentUserSpotifyId) {
      fetchUserProfile();
    }
  }, [profileId, currentUserSpotifyId, fetchUserProfile]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (profileId && currentUserSpotifyId) {
        fetchUserProfile();
      }
    }, [profileId, currentUserSpotifyId, fetchUserProfile])
  );

  // Handle follow/unfollow
  const toggleFollow = async () => {
    if (!currentUserSpotifyId || !profileId) return;
    
    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`${BACKEND_USER_ENDPOINT}/${profileId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserSpotifyId })
      });
      
      if (response.ok) {
        // Update UI state
        setIsFollowing(!isFollowing);
        // Update follower count
        setFollowersCount(prevCount => isFollowing ? prevCount - 1 : prevCount + 1);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || `Failed to ${isFollowing ? 'unfollow' : 'follow'} user`);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  // Handle liking a song
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

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FFFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      {/* User info section */}
      <View style={styles.userInfoSection}>
        <View style={styles.userInfoHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>
              {user?.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.userDetails}>
            <Text style={styles.username}>@{user?.username}</Text>
            
            <View style={styles.followStats}>
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{followersCount}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </View>
              <View style={styles.followStat}>
                <Text style={styles.followCount}>{followingCount}</Text>
                <Text style={styles.followLabel}>Following</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Follow button (only show for other users) */}
        {currentUserSpotifyId !== profileId && (
          <TouchableOpacity 
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={toggleFollow}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Songs section */}
      <View style={styles.songsSection}>
        <Text style={styles.sectionTitle}>Songs of the Day</Text>
        {songs.length === 0 ? (
          <View style={styles.emptySongsContainer}>
            <Ionicons name="musical-notes" size={48} color="#DDD" />
            <Text style={styles.emptySongsText}>No songs submitted yet</Text>
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <SongItem
                song={item}
                onLike={() => handleLike(item._id)}
                isLiked={currentUserSpotifyId ? item.likes.includes(currentUserSpotifyId) : false}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.songsList}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#777',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 40, // Balance the header
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    flex: 1,
  },
  userInfoSection: {
    backgroundColor: '#FFF',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  userInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00FFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  followStats: {
    flexDirection: 'row',
  },
  followStat: {
    marginRight: 20,
  },
  followCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  followLabel: {
    fontSize: 14,
    color: '#777',
  },
  followButton: {
    backgroundColor: '#00FFFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
   boxShadow: 'inset 0 0 0 1px #333', 
  },
  followButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#333',
  },
  songsSection: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  songsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptySongsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptySongsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  songItem: {
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  songHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  songDate: {
    fontSize: 14,
    color: '#666',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: 14,
    marginLeft: 4,
    color: '#00FFFF',
    fontWeight: '500',
  },
  playerContainer: {
    height: 80,
    backgroundColor: '#f8f8f8',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webViewError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  songInfo: {
    padding: 12,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#666',
  }
});