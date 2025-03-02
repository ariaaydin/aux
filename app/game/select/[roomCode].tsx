import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';

const MAX_SONGS = 5;
const MAX_SHUFFLES = 3;
const ANIMATION_DURATION = 500; // 500ms per song reveal

export default function SongSelectionScreen() {
  const { roomCode, spotifyId, username, testMode, botCount } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [allSongs, setAllSongs] = useState<any[]>([]); // Store all fetched songs
  const [revealedSongs, setRevealedSongs] = useState<any[]>([]); // Songs currently revealed
  const [shufflesLeft, setShufflesLeft] = useState(MAX_SHUFFLES);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  
  // Animation values for each song (up to 5)
  const animatedValues = useRef(
    Array(MAX_SONGS).fill(null).map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20)
    }))
  ).current;

  const router = useRouter();

  // Connect to socket server
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    
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

  // Fetch songs when token is available and animate reveal
  useEffect(() => {
    if (token) {
      fetchRandomSongs();
    }
  }, [token]);

  // Fetch 5 random songs from user's Spotify library
  const fetchRandomSongs = async () => {
    if (!token) return;
    
    setLoading(true);
    setRevealedSongs([]); // Reset revealed songs
    
    try {
      const response = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch saved tracks');
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length < MAX_SONGS) {
        Alert.alert('Not enough songs', `You need at least ${MAX_SONGS} saved songs in your Spotify library`);
        return;
      }
      
    interface SpotifyTrack {
        track: {
            id: string;
            name: string;
            artists: { name: string }[];
            album: { images: { url: string }[] };
        };
    }

    interface Song {
        trackId: string;
        trackName: string;
        trackArtist: string;
        trackImage: string;
    }

    const shuffled: Song[] = [...data.items as SpotifyTrack[]]
        .sort(() => 0.5 - Math.random())
        .slice(0, MAX_SONGS)
        .map((item: SpotifyTrack) => ({
            trackId: item.track.id,
            trackName: item.track.name,
            trackArtist: item.track.artists.map(a => a.name).join(', '),
            trackImage: item.track.album.images[0]?.url || ''
        }));
      
      setAllSongs(shuffled);
      animateSongReveal(shuffled);
    } catch (error) {
      console.error('Error fetching songs:', error);
      Alert.alert('Error', 'Failed to fetch songs from Spotify');
    } finally {
      setLoading(false);
    }
  };

  // Animate revealing songs one by one
  const animateSongReveal = (newSongs: any[]) => {
    newSongs.forEach((song, index) => {
      setTimeout(() => {
        setRevealedSongs(prev => [...prev, song]);
        Animated.parallel([
          Animated.timing(animatedValues[index].opacity, {
            toValue: 1,
            duration: ANIMATION_DURATION,
            useNativeDriver: true
          }),
          Animated.timing(animatedValues[index].translateY, {
            toValue: 0,
            duration: ANIMATION_DURATION,
            useNativeDriver: true
          })
        ]).start();
      }, index * (ANIMATION_DURATION + 200)); // 200ms delay between each song
    });
  };

  // Handle shuffling songs
  const handleShuffle = () => {
    if (shufflesLeft <= 0) {
      Alert.alert('No shuffles left', 'You have used all your shuffles');
      return;
    }
    
    setShufflesLeft(prev => prev - 1);
    // Reset animations
    animatedValues.forEach(val => {
      val.opacity.setValue(0);
      val.translateY.setValue(20);
    });
    fetchRandomSongs();
  };

  // Submit the 5 displayed songs and set player as ready
  const handleReady = () => {
    if (!socket) {
      Alert.alert('Connection error', 'Socket not connected');
      return;
    }
    
    if (revealedSongs.length < MAX_SONGS) {
      Alert.alert('Loading incomplete', 'Please wait for all songs to load');
      return;
    }
    
    const songData = revealedSongs.map(song => ({
      trackId: song.trackId,
      trackName: song.trackName,
      trackArtist: song.trackArtist,
      trackImage: song.trackImage
    }));
    
    socket.emit('setReady', { 
      roomCode, 
      spotifyId, 
      selectedSongs: songData 
    });
    
    if (testMode === 'true') {
      socket.emit('enableTestMode', {
        roomCode,
        spotifyId,
        botCount: parseInt(botCount as string, 10) || 3
      });
    }
    
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
  const renderSongItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      style={[
        styles.songItem,
        {
          opacity: animatedValues[index].opacity,
          transform: [{ translateY: animatedValues[index].translateY }]
        }
      ]}
    >
      <Image
        source={{ uri: item.trackImage || 'https://via.placeholder.com/60' }}
        style={styles.songImage}
      />
      <View style={styles.songDetails}>
        <Text style={styles.songName} numberOfLines={1}>{item.trackName}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.trackArtist}</Text>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.loadingText}>Fetching your songs...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Songs</Text>
        <Text style={styles.headerSubtitle}>
          Watch as your 5 songs are revealed! Shuffle if you want different ones.
        </Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{shufflesLeft}</Text>
          <Text style={styles.statLabel}>Shuffles Left</Text>
        </View>
      </View>
      
      <FlatList
        data={revealedSongs}
        keyExtractor={(item) => item.trackId}
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
          disabled={revealedSongs.length < MAX_SONGS} // Disable until all songs reveal
        >
          <LinearGradient
            colors={revealedSongs.length >= MAX_SONGS ? ['#00FFAA', '#00AAFF'] : ['#666666', '#444444']}
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
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
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