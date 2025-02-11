import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Keyboard,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BACKEND_USER_ENDPOINT = 'http://localhost:3000/api/users';

export default function AccountScreen() {
  // Retrieve spotifyId from the route or SecureStore.
  const params = useLocalSearchParams<{ spotifyId?: string }>();
  const [spotifyId, setSpotifyId] = useState<string | null>(params.spotifyId ?? null);
  const [username, setUsername] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!spotifyId) {
      SecureStore.getItemAsync('spotify_id')
        .then((storedId) => {
          if (storedId) {
            setSpotifyId(storedId);
          } else {
            Alert.alert('Error', 'No Spotify ID found. Please log in again.');
            router.push('/(tabs)/account');
          }
        })
        .catch(() => {
          Alert.alert('Error', 'Failed to retrieve Spotify ID');
          router.push('/');
        });
    }
  }, [spotifyId, router]);

  useEffect(() => {
    if (spotifyId) {
      fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.user) {
            setUsername(data.user.username);
          } else {
            Alert.alert('Error', 'User not found');
          }
        })
        .catch(() => {
          Alert.alert('Error', 'Failed to load username');
        });
    }
  }, [spotifyId]);

  const saveUsername = () => {
    if (!spotifyId) {
      Alert.alert('Error', 'Missing Spotify ID');
      return;
    }
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }
    fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: trimmedUsername }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || `HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          setEditing(false);
          Keyboard.dismiss();
        } else {
          Alert.alert('Error', 'Failed to update username');
        }
      })
      .catch((err) => {
        Alert.alert('Error', err.message);
      });
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('spotify_token');
    await SecureStore.deleteItemAsync('spotify_id');
    router.replace('/');
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <View style={styles.container}>
        <Text style={styles.header}>Account Settings</Text>
        <View style={styles.inputContainer}>
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
              <Text style={styles.username}>{username || 'No username'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.button} onPress={logout}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // white background
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: '600',
    color: '#00FFFF', // cyan accent
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 40,
  },
  label: {
    fontSize: 16,
    color: '#00FFFF',
    marginBottom: 8,
  },
  username: {
    fontSize: 20,
    color: '#00FFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00FFFF',
  },
  input: {
    fontSize: 20,
    color: '#00FFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00FFFF',
  },
  button: {
    backgroundColor: '#00FFFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff', // white text on cyan button
    fontSize: 18,
    fontWeight: '600',
  },
});
