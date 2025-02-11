import React, { useEffect, useState, useCallback } from 'react';
import { View, Button, Alert, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthRequest } from 'expo-auth-session';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

const SPOTIFY_CLIENT_ID = '6496a3c69dd145e39107b1950f105774';
const SPOTIFY_SCOPES = 'user-library-read';
// Ensure this URI is whitelisted in your Spotify Dashboard.
const SPOTIFY_REDIRECT_URI = 'exp://10.101.155.121:8081';

// Replace with your backend URL if needed.
const BACKEND_USER_ENDPOINT = 'http://localhost:3000/api/users';

export default function IndexScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [randomSong, setRandomSong] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Create the auth request.
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: 'token',
      clientId: SPOTIFY_CLIENT_ID,
      scopes: [SPOTIFY_SCOPES],
      redirectUri: SPOTIFY_REDIRECT_URI,
    },
    {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    }
  );

  // On mount, check for an existing token.
  useEffect(() => {
    SecureStore.getItemAsync('spotify_token').then((storedToken) => {
      if (storedToken) {
        setToken(storedToken);
      }
    });
  }, []);

  // Re-check the token every time the screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      SecureStore.getItemAsync('spotify_token').then((storedToken) => {
        setToken(storedToken);
      });
    }, [])
  );

  // When Spotify responds, save the token and fetch the user profile.
  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      if (access_token) {
        setToken(access_token);
        SecureStore.setItemAsync('spotify_token', access_token);

        // Get the Spotify user's profile.
        fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        })
          .then((res) => res.json())
          .then((userData) => {
            // Save the Spotify ID in SecureStore for later use.
            SecureStore.setItemAsync('spotify_id', userData.id);
            // When creating/verifying the user, set the username to the spotifyId.
            fetch(BACKEND_USER_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                spotifyId: userData.id,
                username: userData.id, // Set username equal to spotifyId on creation.
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.user) {
                  console.log('User returned from backend:', data.user);
                  setUser(data.user);
                }
              })
              .catch((err) => console.error('Backend user error:', err));
          })
          .catch((err) => console.error('Spotify profile error:', err));
      }
    }
  }, [response]);

  // **NEW**: Redirect if a token exists so logged-in users cannot use this login page.
  useEffect(() => {
    if (token) {
      // Replace '/song-of-the-day' with your main app's initial route.
      router.replace('/screens/song-of-the-day');
    }
  }, [token]);

  // Fetch a random song from the user's saved tracks.
  const getRandomSong = async () => {
    if (!token) {
      Alert.alert('Not authenticated', 'Please connect to Spotify first.');
      return;
    }
    try {
      const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.items.length);
        const song = data.items[randomIndex].track;
        setRandomSong(song);
      } else {
        Alert.alert('No songs found in your Spotify library.');
      }
    } catch (error) {
      console.error('Error fetching tracks:', error);
      Alert.alert('Error', 'Failed to fetch tracks.');
    }
  };

  // (Optional) A logout function.
  const logout = async () => {
    await SecureStore.deleteItemAsync('spotify_token');
    setToken(null);
    setRandomSong(null);
    setUser(null);
  };

  return (
    <View style={styles.container}>
      {!token ? (
        // Not connected: show Connect button.
        <Button
          title="Connect to Spotify"
          onPress={() => promptAsync()}
          disabled={!request}
        />
      ) : (
        // In theory, this block won’t be seen because of the redirect,
        // but the detailed logic remains here.
        <View style={styles.authContainer}>
          <View style={styles.buttonRow}>
            <Button title="Fetch Random Song" onPress={getRandomSong} />
          </View>
          {randomSong && (
            <View style={styles.webViewContainer}>
              <WebView
                source={{
                  uri: `https://open.spotify.com/embed/track/${randomSong.id}`,
                }}
                style={styles.webView}
                allowsInlineMediaPlayback
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  authContainer: { 
    width: '100%', 
    padding: 20, 
    alignItems: 'center' 
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  webViewContainer: { 
    height: 300, 
    width: '100%' 
  },
  webView: { 
    flex: 1 
  },
});
