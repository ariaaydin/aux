// app/(tabs)/account.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, TextInput, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BACKEND_USER_ENDPOINT = 'http://localhost:3000/api/users';

export default function AccountScreen() {
  // Try to get spotifyId from the route parameters.
  const params = useLocalSearchParams<{ spotifyId?: string }>();
  console.log('Account screen route params:', params);
  
  // Use the spotifyId from the route if available.
  const [spotifyId, setSpotifyId] = useState<string | null>(params.spotifyId ?? null);
  
  // The username will always be pulled from the database.
  const [username, setUsername] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  // If spotifyId is not in the route, try to load it from SecureStore.
  useEffect(() => {
    if (!spotifyId) {
      SecureStore.getItemAsync('spotify_id')
        .then((storedId) => {
          if (storedId) {
            console.log('Retrieved spotifyId from SecureStore:', storedId);
            setSpotifyId(storedId);
          } else {
            console.error('No spotifyId found in route or SecureStore');
            Alert.alert('Error', 'No Spotify ID found. Please log in again.');
            router.push('/');
          }
        })
        .catch((err) => {
          console.error('Error retrieving spotifyId from SecureStore:', err);
          Alert.alert('Error', 'Failed to retrieve Spotify ID');
          router.push('/');
        });
    }
  }, [spotifyId, router]);

  // Once we have a spotifyId, always fetch the user data from the database.
  useEffect(() => {
    if (spotifyId) {
      fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log('Fetched user data:', data);
          if (data.user) {
            // Always set username from the database value.
            setUsername(data.user.username);
          } else {
            console.error('User not found in GET endpoint');
            Alert.alert('Error', 'User not found');
          }
        })
        .catch((err) => {
          console.error('Error fetching user:', err);
          Alert.alert('Error', 'Failed to load username');
        });
    }
  }, [spotifyId]);

  // Function to update username in the database.
  const saveUsername = () => {
    console.log('Saving username:', username, 'for spotifyId:', spotifyId);
    if (!spotifyId) {
      Alert.alert('Error', 'Missing spotifyId');
      return;
    }
    fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId.trim()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || `HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('Update response:', data);
        if (data.user) {
          Alert.alert('Username updated successfully');
          setEditing(false);
        } else {
          Alert.alert('Failed to update username', data.error || '');
        }
      })
      .catch((err) => {
        console.error('Error updating username:', err);
        Alert.alert('Error updating username', err.message);
      });
  };

  // Sign out: remove the token and spotify_id and navigate back to index.
  const logout = async () => {
    await SecureStore.deleteItemAsync('spotify_token');
    await SecureStore.deleteItemAsync('spotify_id');
    router.push('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Username:</Text>
      {editing ? (
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoFocus
        />
      ) : (
        <Text style={styles.username} onPress={() => setEditing(true)}>
          {username || 'No username'}
        </Text>
      )}
      {editing && <Button title="Save" onPress={saveUsername} />}
      <View style={styles.spacer} />
      <Button title="Sign Out" onPress={logout} color="red" />
      <View style={styles.spacer} />
      <Button title="Back" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    alignItems: 'center', 
    backgroundColor: '#fff' 
  },
  label: { 
    fontSize: 16, 
    marginBottom: 10 
  },
  username: { 
    fontSize: 18, 
    marginBottom: 10 
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    width: '100%',
    padding: 10,
    fontSize: 18,
    marginBottom: 10,
  },
  spacer: { 
    height: 20 
  },
});
