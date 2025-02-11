import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

const BACKEND_SONG_ENDPOINT = 'http://localhost:3000/api/songOfTheDay';
const SPOTIFY_SEARCH_ENDPOINT = 'https://api.spotify.com/v1/search';


export default function SongOfTheDaySubmission() {
  const [token, setToken] = useState<string | null>(null);
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [submittedPost, setSubmittedPost] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Fetch token and user data on mount
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('spotify_token');
        if (!storedToken) {
          Alert.alert('Error', 'No authentication token found');
          return;
        }
        
        setToken(storedToken);
        
        // Verify token with Spotify API
        const userRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        
        if (!userRes.ok) throw new Error('Invalid token');
        
        const userData = await userRes.json();
        setSpotifyId(userData.id);

        // Check existing submission
        const submissionRes = await fetch(
          `${BACKEND_SONG_ENDPOINT}?spotifyId=${userData.id}`
        );
        if (submissionRes.ok) {
          const submissionData = await submissionRes.json();
          submissionData.post && setSubmittedPost(submissionData.post);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        Alert.alert('Error', 'Failed to initialize application');
      }
    })();
  }, []);

  // Debounced search with proper token handling
  const searchSongs = useCallback(async () => {
    if (!token || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `${SPOTIFY_SEARCH_ENDPOINT}?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const data = await res.json();
      setResults(data.tracks?.items || []);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search songs');
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery]);

  // Search debounce effect
  useEffect(() => {
    const debounceTimer = setTimeout(searchSongs, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchSongs]);

  // Add this code INSIDE your component, right before the return statement:
const submitSong = async () => {
  if (!spotifyId || !selectedSong) {
    Alert.alert('Error', 'Please select a song before submitting');
    return;
  }

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
      setSubmittedPost(data.post);
    } else {
      Alert.alert('Error', data.error || 'Failed to submit song');
    }
  } catch (err) {
    console.error('Submission error:', err);
    Alert.alert('Error', 'Failed to submit song');
  }
};

// Also add this useEffect for redirection after submission
useEffect(() => {
  if (submittedPost) {
    router.replace('/screens/feed');
  }
}, [submittedPost, router]);

  // Rest of your component remains the same...
  // Only showing modified parts for brevity

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Submit Song of the Day</Text>
      
      <TextInput
        style={styles.searchInput}
        placeholder="Search for a song..."
        placeholderTextColor="#888"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {loading && <ActivityIndicator size="small" color="#00FFFF" />}

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

      {/* Selected song and submit button */}
      {selectedSong && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedText}>
            Selected: {selectedSong.name} -{' '}
            {selectedSong.artists.map((a: any) => a.name).join(', ')}
          </Text>
          <TouchableOpacity 
            style={styles.submitSongButton} 
            onPress={submitSong}
          >
            <Text style={styles.submitSongButtonText}>
              Submit Song of the Day
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
// Update styles (remove searchButton related styles)
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
  // Remove searchButton and searchButtonText styles
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
});