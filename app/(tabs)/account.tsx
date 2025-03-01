// app/(tabs)/account.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Keyboard,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const BACKEND_USER_ENDPOINT = 'http://localhost:3000/api/users';

interface User {
  spotifyId: string;
  username: string;
  createdAt: string;
}

export default function AccountScreen() {
  // User data
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [editing, setEditing] = useState(false);
  
  // Search and followers
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('following');
  const [modalVisible, setModalVisible] = useState(false);
  
  const router = useRouter();

  // Get the current user's Spotify ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userSpotifyId = await SecureStore.getItemAsync('spotify_id');
        if (userSpotifyId) {
          setSpotifyId(userSpotifyId);
        } else {
          Alert.alert('Error', 'No Spotify ID found. Please log in again.');
          router.push('/');
        }
      } catch (err) {
        console.error('Error fetching Spotify ID:', err);
        Alert.alert('Error', 'Failed to retrieve user information');
        router.push('/');
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Fetch user data whenever we get a valid spotifyId
  useEffect(() => {
    if (spotifyId) {
      fetchUserData();
      fetchFollowersAndFollowing();
    }
  }, [spotifyId]);

  // Refresh follow data when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (spotifyId) {
        fetchFollowersAndFollowing();
      }
    }, [spotifyId])
  );

  // Fetch user data
  const fetchUserData = async () => {
    if (!spotifyId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.user) {
        setUsername(data.user.username);
      } else {
        Alert.alert('Error', 'User not found');
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch followers and following lists
  const fetchFollowersAndFollowing = async () => {
    if (!spotifyId) return;
    
    try {
      setLoading(true);
      
      // Fetch followers
      const followersResponse = await fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}/followers`);
      if (followersResponse.ok) {
        const followersData = await followersResponse.json();
        setFollowers(followersData.followers || []);
      }
      
      // Fetch following
      const followingResponse = await fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}/following`);
      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        
        // Set following list
        setFollowing(followingData.following || []);
        
        // Create a map for O(1) lookup
        const followMap: Record<string, boolean> = {};
        (followingData.following || []).forEach((user: User) => {
          followMap[user.spotifyId] = true;
        });
        setFollowingMap(followMap);
      }
    } catch (err) {
      console.error('Error fetching followers/following:', err);
    } finally {
      setLoading(false);
    }
  };

  // Search for users
  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setSearchLoading(true);
      const response = await fetch(`${BACKEND_USER_ENDPOINT}/search/${encodeURIComponent(query)}`);
      
      if (response.ok) {
        const data = await response.json();
        // Filter out the current user from search results
        const filteredResults = data.users.filter((user: User) => user.spotifyId !== spotifyId);
        setSearchResults(filteredResults || []);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Error searching users:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounce for search input
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Toggle follow/unfollow a user
  const toggleFollow = async (targetId: string, isFollowing: boolean) => {
    if (!spotifyId) return;
    
    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`${BACKEND_USER_ENDPOINT}/${targetId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserSpotifyId: spotifyId })
      });
      
      if (response.ok) {
        // Update the following map optimistically
        setFollowingMap(prev => ({
          ...prev,
          [targetId]: !isFollowing
        }));
        
        // Refresh followers and following lists
        fetchFollowersAndFollowing();
      } else {
        Alert.alert('Error', `Failed to ${isFollowing ? 'unfollow' : 'follow'} user`);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  // Save username
  const saveUsername = async () => {
    if (!spotifyId) {
      Alert.alert('Error', 'Missing Spotify ID');
      return;
    }
    
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }
    
    try {
      const response = await fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.user) {
        setEditing(false);
        Keyboard.dismiss();
      } else {
        Alert.alert('Error', 'Failed to update username');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update username');
    }
  };

  // Log out
  const logout = async () => {
    await SecureStore.deleteItemAsync('spotify_token');
    await SecureStore.deleteItemAsync('spotify_id');
    router.replace('/');
  };

  // Navigate to user profile
  const goToUserProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  // Render user item for followers/following lists
  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => goToUserProfile(item.spotifyId)}
    >
      <View style={styles.userInfoContainer}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      
      <TouchableOpacity
        style={[
          styles.followButton,
          followingMap[item.spotifyId] ? styles.followingButton : {}
        ]}
        onPress={() => toggleFollow(item.spotifyId, !!followingMap[item.spotifyId])}
      >
            <Text style={[styles.followButtonText, followingMap[item.spotifyId] && styles.followingButtonText]}>
          {followingMap[item.spotifyId] ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Render search result item
  const renderSearchResultItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => goToUserProfile(item.spotifyId)}
    >
      <View style={styles.userInfoContainer}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      
      <TouchableOpacity
        style={[
          styles.followButton,
          followingMap[item.spotifyId] ? styles.followingButton2 : {}
        ]}
        onPress={() => toggleFollow(item.spotifyId, !!followingMap[item.spotifyId])}
      >
            <Text style={[styles.followButtonText, followingMap[item.spotifyId] && styles.followingButtonText]}>
          {followingMap[item.spotifyId] ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading && !spotifyId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <View style={styles.container}>
        <Text style={styles.header}>Account</Text>
        
        {/* Username Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Profile</Text>
          <View style={styles.usernameContainer}>
            <Text style={styles.label}>Username</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoFocus
                onBlur={saveUsername}
                onSubmitEditing={saveUsername}
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={styles.usernameText}>{username || 'No username'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Friends</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for users..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchLoading && <ActivityIndicator size="small" color="#00FFFF" />}
          </View>
          
          {searchResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              <FlatList
                data={searchResults}
                renderItem={renderSearchResultItem}
                keyExtractor={(item) => item.spotifyId}
                showsVerticalScrollIndicator={false}
                style={styles.searchResultsList}
              />
            </View>
          )}
        </View>
        
        {/* Follow Stats Section */}
        <View style={styles.section}>
          <View style={styles.followStatsContainer}>
            <TouchableOpacity 
              style={styles.followStat}
              onPress={() => {
                setActiveTab('following');
                setModalVisible(true);
              }}
            >
              <Text style={styles.followStatNumber}>{following.length}</Text>
              <Text style={styles.followStatLabel}>Following</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.followStat}
              onPress={() => {
                setActiveTab('followers');
                setModalVisible(true);
              }}
            >
              <Text style={styles.followStatNumber}>{followers.length}</Text>
              <Text style={styles.followStatLabel}>Followers</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
        
        {/* Followers/Following Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {activeTab === 'followers' ? 'Followers' : 'Following'}
                </Text>
                <View style={styles.placeholder} />
              </View>
              
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'following' && styles.activeTab]}
                  onPress={() => setActiveTab('following')}
                >
                  <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
                    Following
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
                  onPress={() => setActiveTab('followers')}
                >
                  <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
                    Followers
                  </Text>
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={activeTab === 'followers' ? followers : following}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.spotifyId}
                ListEmptyComponent={
                  <View style={styles.emptyListContainer}>
                    <Text style={styles.emptyListText}>
                      {activeTab === 'followers' 
                        ? "You don't have any followers yet" 
                        : "You aren't following anyone yet"}
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  header: {
    fontSize: 28,
    fontWeight: '600',
    color: '#00FFFF',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  usernameContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  usernameText: {
    fontSize: 18,
    color: '#00FFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00FFFF',
  },
  input: {
    fontSize: 18,
    color: '#00FFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00FFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  searchResultsContainer: {
    maxHeight: 200,
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
    marginBottom: 16,
  },
  searchResultsList: {
    borderRadius: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  followStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  followStat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  followStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  followStatLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00FFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  username: {
    fontSize: 16,
    color: '#333',
  },
  followButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#00FFFF',
    borderRadius: 16,
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    boxShadow: 'inset 0 0 0 1px #333', 
  },
  followingButton2: {
    backgroundColor: '#fffcfc',
    boxShadow: 'inset 0 0 0 1px #333', 
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  followingButtonText: {
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#00FFFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',

  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 24, // Same width as close button for balanced header
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00FFFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#00FFFF',
    fontWeight: '600',
  },
  emptyListContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
