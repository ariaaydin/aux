// app/(tabs)/song-of-the-day.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const BACKEND_SONG_ENDPOINT = 'http://localhost:3000/api/songOfTheDay';
const SPOTIFY_SEARCH_ENDPOINT = 'https://api.spotify.com/v1/search';

export default function SongOfTheDayScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [submittedPost, setSubmittedPost] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTokenAndUser = async () => {
      const storedToken = await SecureStore.getItemAsync('spotify_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          const userData = await res.json();
          setSpotifyId(userData.id);
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
    };
    fetchTokenAndUser();
  }, []);

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
        setSubmittedPost(data.post);
      } else {
        Alert.alert('Error', data.error || 'Failed to submit song');
      }
    } catch (err) {
      console.error('Error submitting song:', err);
      Alert.alert('Error', 'Failed to submit song');
    }
  };

  const timeAgo = (dateStr: string) => {
    const postDate = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - postDate.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  const alreadySubmitted = !!submittedPost;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Song of the Day</Text>
      {alreadySubmitted ? (
        <View style={styles.postContainer}>
          <Text style={styles.postTitle}>{submittedPost.trackName}</Text>
          <Text style={styles.postArtist}>{submittedPost.trackArtist}</Text>
          <Text style={styles.postTime}>Posted {timeAgo(submittedPost.createdAt)}</Text>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a song..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Button title="Search" onPress={searchSongs} disabled={loading || !searchQuery} />
          {results.length > 0 && (
            <View style={styles.resultsContainer}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultItem} onPress={() => setSelectedSong(item)}>
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
              <Text>
                Selected: {selectedSong.name} - {selectedSong.artists.map((a: any) => a.name).join(', ')}
              </Text>
              <Button title="Submit Song of the Day" onPress={submitSong} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
  resultsContainer: {
    maxHeight: 200,
    marginBottom: 10,
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultText: {
    fontSize: 16,
  },
  selectedContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  postContainer: {
    marginTop: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    alignItems: 'center',
  },
  postTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  postArtist: {
    fontSize: 16,
    marginBottom: 10,
  },
  postTime: {
    fontSize: 14,
    color: '#555',
  },
});
