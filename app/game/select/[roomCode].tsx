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
  Animated,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';

const MAX_SONGS = 6; // Show 6 songs but only 5 rounds
const MAX_SHUFFLES = 3;
const ANIMATION_DURATION = 500; // 500ms per song reveal
const COUNTDOWN_DURATION = 20; // 20-second countdown timer

export default function SongSelectionScreen() {
  const { roomCode, spotifyId, username } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [allSongs, setAllSongs] = useState<any[]>([]); // Store all fetched songs
  const [revealedSongs, setRevealedSongs] = useState<any[]>([]); // Songs currently revealed
  const [shufflesLeft, setShufflesLeft] = useState(MAX_SHUFFLES);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [countdownActive, setCountdownActive] = useState(true);
  const [usedSongIds, setUsedSongIds] = useState<string[]>([]);
  
  // Animation values for each song (up to 6)
  const animatedValues = useRef(
    Array(MAX_SONGS).fill(null).map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20)
    }))
  ).current;

  // Animation for countdown pulse effect
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const router = useRouter();

  // Set up pulse animation for countdown
  useEffect(() => {
    if (countdownActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [countdownActive]);

  // Countdown timer
  useEffect(() => {
    if (!countdownActive) return;
    
    let timer: NodeJS.Timeout;
    
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else {
      // Time's up, auto-select current songs
      handleAutoSelect();
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, countdownActive]);

  // Connect to socket server
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    
    // Check for previously used songs (stored in Secure Storage)
    const getUsedSongs = async () => {
      try {
        const usedSongsJson = await SecureStore.getItemAsync(`used_songs_${roomCode}`);
        if (usedSongsJson) {
          setUsedSongIds(JSON.parse(usedSongsJson));
        }
      } catch (err) {
        console.error("Error getting used songs:", err);
      }
    };
    
    getUsedSongs();
    
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

  // Auto-select function when countdown reaches zero
  const handleAutoSelect = () => {
    if (revealedSongs.length === 0) return;
    
    handleReady();
  };

  // Fetch songs from Spotify, excluding previously used songs
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
  
      // Filter out previously used songs - completely remove them
      const filteredItems = data.items.filter((item: SpotifyTrack) => 
        !usedSongIds.includes(item.track.id)
      );
      
      // If not enough songs after filtering, alert and use what we have
      if (filteredItems.length < MAX_SONGS) {
        Alert.alert('Warning', 'Running low on unused songs. Some previously used songs might appear.');
        
        // Use what we have, prioritizing unused songs
        const shuffled: Song[] = [...filteredItems]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(MAX_SONGS, filteredItems.length))
          .map((item: SpotifyTrack) => ({
            trackId: item.track.id,
            trackName: item.track.name,
            trackArtist: item.track.artists.map(a => a.name).join(', '),
            trackImage: item.track.album.images[0]?.url || ''
          }));
        
        // Only if we don't have enough unused songs, add some used ones
        if (shuffled.length < MAX_SONGS) {
          const usedItems = data.items.filter((item: SpotifyTrack) => 
            usedSongIds.includes(item.track.id)
          );
          
          const additionalSongs: Song[] = [...usedItems]
            .sort(() => 0.5 - Math.random())
            .slice(0, MAX_SONGS - shuffled.length)
            .map((item: SpotifyTrack) => ({
              trackId: item.track.id,
              trackName: item.track.name,
              trackArtist: item.track.artists.map(a => a.name).join(', '),
              trackImage: item.track.album.images[0]?.url || ''
            }));
          
          shuffled.push(...additionalSongs);
        }
        
        setAllSongs(shuffled);
        animateSongReveal(shuffled);
      } else {
        // Use only unused songs
        const shuffled: Song[] = [...filteredItems]
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
      }
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

  // Submit the displayed songs and set player as ready
  const handleReady = () => {
    if (!socket) {
      Alert.alert('Connection error', 'Socket not connected');
      return;
    }
    
    if (revealedSongs.length < MAX_SONGS) {
      Alert.alert('Loading incomplete', 'Please wait for all songs to load');
      return;
    }
    
    // Stop the countdown
    setCountdownActive(false);
    
    // Get just the 5 songs we'll use (out of 6 shown)
    const songsToSubmit = revealedSongs.slice(0, 5);
    
    // Add selected song IDs to used songs
    const newUsedSongIds = [...usedSongIds];
    songsToSubmit.forEach(song => {
      if (!newUsedSongIds.includes(song.trackId)) {
        newUsedSongIds.push(song.trackId);
      }
    });
    
    // Save updated used songs list
    SecureStore.setItemAsync(`used_songs_${roomCode}`, JSON.stringify(newUsedSongIds));
    setUsedSongIds(newUsedSongIds);
    
    // Map to the format expected by the backend
    const songData = songsToSubmit.map(song => ({
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
    
    router.push({
      pathname: '/game/play/[roomCode]',
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
        {/* Removed the Previously Used tag */}
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.loadingText}>Getting your songs ready...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      {countdownActive && (
        <Animated.View 
          style={[
            styles.countdownContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <Text style={styles.countdownLabel}>Song Wars starts in</Text>
          <Text style={styles.countdownText}>{countdown}</Text>
        </Animated.View>
      )}
      
      <View style={styles.header}>
      <View style={styles.statItem}>
          <Text style={styles.statValue}>{shufflesLeft}</Text>
          <Text style={styles.statLabel}>Shuffles Left</Text>
        </View>
      </View>
      
      
      <View style={styles.songListContainer}>
        <FlatList
          data={revealedSongs}
          keyExtractor={(item) => item.trackId}
          renderItem={renderSongItem}
          contentContainerStyle={styles.songsList}
          scrollEnabled={false} // Disable scrolling to fit within view
        />
      </View>
      
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
            <Text style={styles.buttonText}>I'm Ready!</Text>
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
  countdownContainer: {
    position: 'absolute',
    top: 60,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  countdownLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  countdownText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#00FFFF',
  },
  header: {
    alignItems: 'center',
    marginTop: 120, // Extra space for countdown
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
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
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
  songListContainer: {
    flex: 1,
    marginBottom: 16,
  },
  songsList: {
    paddingBottom: 10,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    height: 74, // Fixed height for each item
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
  previouslyUsedTag: {
    marginTop: 4,
    backgroundColor: 'rgba(255, 100, 100, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  previouslyUsedText: {
    fontSize: 10,
    color: '#FF6464',
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