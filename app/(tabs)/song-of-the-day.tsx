import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
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

  // On mount, fetch token, user info and any submitted song.
  useEffect(() => {
    async function fetchData() {
      const storedToken = await SecureStore.getItemAsync('spotify_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          const userData = await res.json();
          setSpotifyId(userData.id);

          // Fetch any submitted Song of the Day for this user.
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
    }
    fetchData();
  }, []);

  // If submittedPost becomes truthy, automatically redirect to the Feed.
  useEffect(() => {
    if (submittedPost) {
      // Redirect to the Feed (or main tabs). You can change the route as needed.
      router.replace({ pathname: '/feed' });
    }
  }, [submittedPost, router]);

  // Search Spotify for songs based on the query.
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

  // Submit the selected song as Song of the Day.
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
        // Setting submittedPost here will trigger the useEffect to redirect.
        setSubmittedPost(data.post);
      } else {
        Alert.alert('Error', data.error || 'Failed to submit song');
      }
    } catch (err) {
      console.error('Error submitting song:', err);
      Alert.alert('Error', 'Failed to submit song');
    }
  };

  // The submission UI.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Submit Song of the Day</Text>
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
            <Text style={styles.submitSongButtonText}>
              Submit Song of the Day
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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
});
