// app/(tabs)/leaderboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  Image, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

interface Track {
  _id: string;
  trackId: string;
  trackName: string;
  trackArtist: string;
  trackImage: string;
  spotifyId: string;
  likesCount: number;
  username: string;
  rank?: number;
}

export default function LeaderboardScreen() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:3000/api/leaderboard');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        const sortedTracks = [...data.leaderboard]
          .sort((a, b) => b.likesCount - a.likesCount)
          .map((track, index) => ({
            ...track,
            rank: index + 1
          }));
        
        setTracks(sortedTracks);
      } else {
        setTracks([]);
        setError('No tracks available');
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const intervalId = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, []);

  const renderTrackItem = ({ item }: { item: Track }) => (
    <View style={styles.trackItem}>
      <Text style={styles.rankText}>{item.rank}</Text>
      
      <Image 
        source={{ uri: item.trackImage || 'https://via.placeholder.com/60' }} 
        style={styles.trackImage}
      />
      
      <View style={styles.middleContainer}>
        <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={1}>{item.trackName}</Text>
          <Text style={styles.artistName} numberOfLines={1}>{item.trackArtist}</Text>
        </View>
        
        <View style={styles.likesContainer}>
          <Ionicons name="heart" size={16} color="#00FFFF" />
          <Text style={styles.likesText}>{item.likesCount}</Text>
        </View>
      </View>
    </View>
  );
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FFFF" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerText}>Top Songs</Text>
      <Text style={styles.subheaderText}>Today's Most Liked Songs!</Text>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchLeaderboard}>
            <Text style={styles.refreshButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tracks}
          renderItem={renderTrackItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00FFFF"
              colors={["#00FFFF"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No songs on the leaderboard yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00FFFF',
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  subheaderText: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00FFFF',
    width: 24,
    textAlign: 'center',
  },
  trackImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginLeft: 8,
  },
  

  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  middleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 14,
    color: '#00AAAA',
    fontWeight: '500',
    marginBottom: 4, // Space between username and track info
  },
  trackInfo: {
    flex: 1,
    marginBottom: 4, // Space before likes
  },
  trackName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  artistName: {
    fontSize: 14,
    color: '#666',
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00AAAA',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#00FFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  }
});