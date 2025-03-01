import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_SONG_ENDPOINT = 'http://localhost:3000/api/songOfTheDay';
const SPOTIFY_SEARCH_ENDPOINT = 'https://api.spotify.com/v1/search';
const SPOTIFY_LIKED_SONGS_ENDPOINT = 'https://api.spotify.com/v1/me/tracks';

export default function SongOfTheDaySubmission() {
  const [token, setToken] = useState<string | null>(null);
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [submittedPost, setSubmittedPost] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      const storedToken = await SecureStore.getItemAsync('spotify_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (!res.ok) throw new Error('Invalid token');
          const userData = await res.json();
          setSpotifyId(userData.id);

          const getRes = await fetch(`${BACKEND_SONG_ENDPOINT}?spotifyId=${userData.id}`);
          if (getRes.ok) {
            const getData = await getRes.json();
            if (getData.post) setSubmittedPost(getData.post);
          }
        } catch (err) {
          console.error('Error fetching Spotify user info:', err);
          setError('Failed to load user data');
        }
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (submittedPost) router.replace('/feed');
  }, [submittedPost, router]);

  let debounceTimer: NodeJS.Timeout | null = null;

  const searchSongs = async (query: string) => {
    if (!token || !query) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${SPOTIFY_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&type=track&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.tracks && data.tracks.items) {
        setResults(data.tracks.items);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Error searching songs:', err);
      setError('Failed to search songs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchSongs(searchQuery);
    }, 500);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

  const submitSong = async (song: any) => {
    if (!spotifyId || !song) return;
    try {
      const body = {
        spotifyId,
        trackId: song.id,
        trackName: song.name,
        trackArtist: song.artists.map((a: any) => a.name).join(', '),
        trackImage: song.album.images[0]?.url || '',
      };
      const res = await fetch(BACKEND_SONG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setSubmittedPost(data.post);
      } else {
        Alert.alert('Error', data.error || 'Submission failed');
      }
    } catch (err) {
      console.error('Error submitting song:', err);
      Alert.alert('Error', 'Submission failed');
    }
  };

  const getRandomSong = async () => {
    if (!token || !spotifyId) return;
    setLoading(true);
    try {
      const res = await fetch(`${SPOTIFY_LIKED_SONGS_ENDPOINT}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.items.length);
        const randomSong = data.items[randomIndex].track;
        await submitSong(randomSong);
      } else {
        setError('No liked songs found');
      }
    } catch (err) {
      console.error('Error fetching random song:', err);
      setError('Failed to fetch random song');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0A0F1E', '#1A2338']}
      style={styles.container}
    >
      <Text style={styles.title}>Song Of The Day</Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Find your vibe..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading && (
        <ActivityIndicator 
          size="small" 
          color="#00F5FF" 
          style={styles.loading}
        />
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {results.length > 0 && (
        <View style={styles.resultsWrapper}>
          <View style={styles.resultsContainer}>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.resultItem,
                    selectedSong?.id === item.id && styles.resultItemSelected
                  ]}
                  onPress={() => setSelectedSong(item)}
                >
                  <Image
                    source={{ uri: item.album.images[0]?.url || 'https://via.placeholder.com/36' }}
                    style={styles.albumArt}
                  />
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.resultArtist} numberOfLines={1}>
                      {item.artists.map((a: any) => a.name).join(', ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          </View>

          {selectedSong && (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => submitSong(selectedSong)}
            >
              <LinearGradient
                colors={['#00F5FF', '#007AFF']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.randomButton}
        onPress={getRandomSong}
        disabled={loading}
      >
        <LinearGradient
          colors={['#FF00FF', '#FF007A']}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>Random</Text>
        </LinearGradient>
      </TouchableOpacity>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 80, // Lowered header by increasing top padding
  },
  title: {
    fontSize: 32, // Reduced from 36
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 1.2, // Slightly reduced
    marginBottom: 24, // Reduced from 30
    textShadowColor: 'rgba(0, 245, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6, // Reduced from 8
  },
  searchContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14, // Reduced from 16
    padding: 3, // Reduced from 4
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, // Reduced from 4
    shadowOpacity: 0.2,
    shadowRadius: 6, // Reduced from 8
    elevation: 3, // Reduced from 4
  },
  searchInput: {
    backgroundColor: 'transparent',
    borderRadius: 10, // Reduced from 12
    padding: 14, // Reduced from 16
    fontSize: 15, // Reduced from 16
    color: '#FFFFFF',
    fontWeight: '500',
  },
  resultsWrapper: {
    marginTop: 16, // Reduced from 20
    alignItems: 'center',
  },
  resultsContainer: {
    borderRadius: 14, // Reduced from 16
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // Reduced from 6
    shadowOpacity: 0.15,
    shadowRadius: 10, // Reduced from 12
    elevation: 4, // Reduced from 6
    maxHeight: 270, // Reduced from 300
    overflow: 'hidden',
    width: '100%',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10, // Reduced from 12
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'transparent',
  },
  resultItemSelected: {
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
  },
  albumArt: {
    width: 36, // Reduced from 40
    height: 36, // Reduced from 40
    borderRadius: 6, // Reduced from 8
    marginRight: 10, // Reduced from 12
  },
  resultTextContainer: {
    flex: 1,
  },
  resultText: {
    fontSize: 15, // Reduced from 16
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resultArtist: {
    fontSize: 13, // Reduced from 14
    color: '#A1A1AA',
    marginTop: 1, // Reduced from 2
  },
  submitButton: {
    marginTop: 20, // Reduced from 15
    borderRadius: 10, // Reduced from 12
    overflow: 'hidden',
    width: '60%', // Slightly reduced from 60%
  },
  randomButton: {
    position: 'absolute',
    bottom: 100, // Reduced from 30
    alignSelf: 'center', // Centered horizontally
    borderRadius: 10, // Reduced from 12, matches Submit
    overflow: 'hidden',
    width: '60%', // Matches Submit button width
  },
  buttonGradient: {
    paddingVertical: 12, // Reduced from 14
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15, // Reduced from 16
    fontWeight: '700',
    letterSpacing: 0.4, // Slightly reduced
  },
  selectedContainer: {
    marginTop: 20, // Reduced from 25
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10, // Reduced from 12
    padding: 12, // Reduced from 14
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, // Reduced from 4
    shadowOpacity: 0.15,
    shadowRadius: 6, // Reduced from 8
    elevation: 3, // Reduced from 4
  },
  selectedText: {
    fontSize: 14, // Reduced from 15
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  errorText: {
    color: '#FF6666',
    textAlign: 'center',
    marginTop: 12, // Reduced from 15
    fontSize: 13, // Reduced from 14
    fontWeight: '500',
  },
  loading: {
    marginTop: 12, // Reduced from 15
  },
});