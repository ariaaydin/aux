// app/game/select/[roomCode].tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';

const MAX_SONGS = 10;
const MAX_SHUFFLES = 3;

export default function SongSelectionScreen() {
  const { roomCode, spotifyId, username } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<any[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<any[]>([]);
  const [shufflesLeft, setShufflesLeft] = useState(MAX_SHUFFLES);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  
  const router = useRouter();

  // Connect to socket server
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Get Spotify token
  useEffect(() => {
    const getToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('spotify_token');
        if (storedToken) {
          setToken(storedToken);
        } else {
          Alert.alert('Error', 'Spotify token not found');
          router.replace('/');
        }
      } catch (error) {
        console.error('Error getting token:', error);
        Alert.alert('Error', 'Failed to get Spotify token');
      }
    };
    
    getToken();
  }, []);

  // Fetch songs when token is available
  useEffect(() => {
    if (token) {
      fetchRandomSongs();
    }
  }, [token]);

  // Fetch random songs from user's Spotify library
  const fetchRandomSongs = async () => {
    if (!token) return;
    
    setLoading(true);
    
    try {
      // Fetch user's saved tracks
      const response = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch saved tracks');
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        Alert.alert('No songs found', 'You need to have saved songs in your Spotify library');
        return;
      }
      
      // Shuffle and take MAX_SONGS
    interface Song {
        id: string;
        name: string;
        artist: string;
        image: string;
        selected: boolean;
    }

    interface SpotifyTrack {
        track: {
            id: string;
            name: string;
            artists: { name: string }[];
            album: { images: { url: string }[] };
        };
    }

    const shuffled: Song[] = [...data.items]
        .sort(() => 0.5 - Math.random())
        .slice(0, MAX_SONGS)
        .map((item: SpotifyTrack) => ({
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists.map(a => a.name).join(', '),
            image: item.track.album.images[0]?.url || '',
            selected: false
        }));
      
      setSongs(shuffled);
    } catch (error) {
      console.error('Error fetching songs:', error);
      Alert.alert('Error', 'Failed to fetch songs from Spotify');
    } finally {
      setLoading(false);
    }
  };

  // Handle song selection/deselection
interface Song {
    id: string;
    name: string;
    artist: string;
    image: string;
    selected: boolean;
}

const toggleSongSelection = (songId: string) => {
    // Update songs array
    setSongs((prevSongs: Song[]) => 
        prevSongs.map((song: Song) => 
            song.id === songId 
                ? { ...song, selected: !song.selected } 
                : song
        )
    );
    
    // Update selected songs array
    setSelectedSongs((prevSelected: Song[]) => {
        const song = songs.find(s => s.id === songId);
        if (!song) return prevSelected;
        
        if (song.selected) {
            // Song was selected, now deselect it
            return prevSelected.filter(s => s.id !== songId);
        } else {
            // Song was not selected, now select it
            const updatedSong = { ...song, selected: true };
            return [...prevSelected, updatedSong];
        }
    });
};

  // Handle shuffling songs
  const handleShuffle = () => {
    if (shufflesLeft <= 0) {
      Alert.alert('No shuffles left', 'You have used all your shuffles');
      return;
    }
    
    // Decrement shuffles
    setShufflesLeft(prev => prev - 1);
    
    // Fetch new random songs
    fetchRandomSongs();
    
    // Clear selected songs
    setSelectedSongs([]);
  };

  // Submit selected songs and set player as ready
  const handleReady = () => {
    if (selectedSongs.length < 5) {
      Alert.alert('Not enough songs', 'Please select at least 5 songs');
      return;
    }
    
    if (!socket) {
      Alert.alert('Connection error', 'Socket not connected');
      return;
    }
    
    // Transform selected songs for sending
    const songData = selectedSongs.map(song => ({
      trackId: song.id,
      trackName: song.name,
      trackArtist: song.artist,
      trackImage: song.image
    }));
    
    // Send ready status to server
    socket.emit('setReady', { 
      roomCode, 
      spotifyId, 
      selectedSongs: songData 
    });
    
    // Navigate to waiting screen
    router.push({
      pathname: '/game/waiting/[roomCode]',
      params: { 
        roomCode: roomCode as string, 
        spotifyId: spotifyId as string,
        username: username as string
      }
    });
  };

  // Render song item
  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity
      style={[styles.songItem, item.selected && styles.selectedSongItem]}
      onPress={() => toggleSongSelection(item.id)}
    >
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/60' }}
        style={styles.songImage}
      />
      
      <View style={styles.songDetails}>
        <Text style={styles.songName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      
      <View style={styles.selectionIndicator}>
        {item.selected ? (
          <Ionicons name="checkmark-circle" size={24} color="#00FFFF" />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color="#FFFFFF" />
        )}
      </View>
    </TouchableOpacity>
  );

  // Loading state
  if (loading) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.loadingText}>Fetching songs from Spotify...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Your Songs</Text>
        <Text style={styles.headerSubtitle}>
          Choose songs you'll use during the game
        </Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{selectedSongs.length}</Text>
          <Text style={styles.statLabel}>Selected</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{shufflesLeft}</Text>
          <Text style={styles.statLabel}>Shuffles Left</Text>
        </View>
      </View>
      
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={renderSongItem}
        contentContainerStyle={styles.songsList}
      />
      
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.shuffleButton}
          onPress={handleShuffle}
          disabled={shufflesLeft <= 0}
        >
          <LinearGradient
            colors={shufflesLeft > 0 ? ['#FF00AA', '#AA00FF'] : ['#666666', '#444444']}
            style={styles.buttonGradient}
          >
            <Ionicons name="shuffle" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Shuffle</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.readyButton}
          onPress={handleReady}
          disabled={selectedSongs.length < 5}
        >
          <LinearGradient
            colors={selectedSongs.length >= 5 ? ['#00FFAA', '#00AAFF'] : ['#666666', '#444444']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>I'm Ready</Text>
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 16,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#CCDDFF',
    opacity: 0.8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00FFFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  songsList: {
    paddingBottom: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  selectedSongItem: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00FFFF',
  },
  songImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  songDetails: {
    flex: 1,
    marginLeft: 12,
  },
  songName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#CCDDFF',
    opacity: 0.8,
  },
  selectionIndicator: {
    paddingHorizontal: 8,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  shuffleButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
  },
  readyButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 6,
  },
});