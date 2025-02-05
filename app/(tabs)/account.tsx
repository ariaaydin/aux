// app/(tabs)/account.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, TextInput, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BACKEND_USER_ENDPOINT = 'http://localhost:3000/api/users';

export default function AccountScreen() {
  const params = useLocalSearchParams<{ spotifyId?: string; username?: string }>();
  console.log('Account screen params:', params);
  const { spotifyId, username: initialUsername } = params;
  const [username, setUsername] = useState(initialUsername?.trim() || '');
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (spotifyId && (!initialUsername || initialUsername.trim() === '')) {
      fetch(`${BACKEND_USER_ENDPOINT}/${spotifyId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUsername(data.user.username);
          } else {
            console.error('User not found in GET endpoint');
          }
        })
        .catch((err) => console.error('Error fetching user:', err));
    }
  }, [spotifyId, initialUsername]);

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
        const text = await res.text();
        console.log('Raw response from PUT:', text);
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error('Failed to parse JSON: ' + text);
        }
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

  const logout = async () => {
    await SecureStore.deleteItemAsync('spotify_token');
    router.push('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Username:</Text>
      {editing ? (
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoFocus />
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
