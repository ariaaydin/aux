// app/(tabs)/game.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

export default function GameScreen() {
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [joinMode, setJoinMode] = useState<boolean>(false);
  
  const router = useRouter();

  // Get user credentials on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userSpotifyId = await SecureStore.getItemAsync('spotify_id');
        const storedUsername = await SecureStore.getItemAsync('username');
        
        if (userSpotifyId) {
          setSpotifyId(userSpotifyId);
          
          if (storedUsername) {
            setUsername(storedUsername);
          } else {
            // Fetch username from your backend if not in SecureStore
            const response = await fetch(`http://localhost:3000/api/users/${userSpotifyId}`);
            if (response.ok) {
              const data = await response.json();
              if (data.user && data.user.username) {
                setUsername(data.user.username);
                SecureStore.setItemAsync('username', data.user.username);
              }
            }
          }
        } else {
          Alert.alert('Error', 'Please login first');
          router.replace({ pathname: '/' });
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        Alert.alert('Error', 'Failed to load user information');
      }
    };
    
    fetchUserInfo();
  }, []);

  // Create a new game
  const handleCreateGame = async () => {
    if (!spotifyId || !username) {
      Alert.alert('Error', 'User info missing');
      return;
    }
    
    setLoading(true);
    
    try {
      // Navigate to the create game screen with user info
      router.push({
        pathname: '/game/create',
        params: { spotifyId, username }
      });
    } catch (error) {
      console.error('Error creating game:', error);
      Alert.alert('Error', 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  // Join an existing game
  const handleJoinGame = () => {
    if (!spotifyId || !username) {
      Alert.alert('Error', 'User info missing');
      return;
    }
    
    if (!roomCode || roomCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-character room code');
      return;
    }
    
    // Navigate to the waiting room with user info and room code
    router.push({
        pathname: '/game/waiting/[roomCode]',
        params: { roomCode: roomCode.toUpperCase(), spotifyId, username }
      });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={['#1A2151', '#323B71']}
          style={styles.backgroundGradient}
        >
          <Text style={styles.title}>Song Wars</Text>
          <Text style={styles.subtitle}>Battle with your best tracks</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#00FFFF" style={styles.loader} />
          ) : (
            <>
              {joinMode ? (
                <View style={styles.joinContainer}>
                  <Text style={styles.joinText}>Enter room code:</Text>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="XXXXXX"
                    placeholderTextColor="#8899AA"
                    value={roomCode}
                    onChangeText={(text) => setRoomCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                  
                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={handleJoinGame}
                  >
                    <LinearGradient
                      colors={['#007AFF', '#00FFFF']}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>Join Game</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.switchModeButton}
                    onPress={() => setJoinMode(false)}
                  >
                    <Text style={styles.switchModeText}>Create a Game</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.createContainer}>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateGame}
                  >
                    <LinearGradient
                      colors={['#00FFFF', '#007AFF']}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>Create New Game</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.switchModeButton}
                    onPress={() => setJoinMode(true)}
                  >
                    <Text style={styles.switchModeText}>Join Existing Game</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>How to Play:</Text>
            <View style={styles.instructionItem}>
              <Ionicons name="musical-notes" size={20} color="#00FFFF" />
              <Text style={styles.instructionText}>Choose your 5 battle songs</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="trophy" size={20} color="#00FFFF" />
              <Text style={styles.instructionText}>Pick the best song for each round's category</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="thumbs-up" size={20} color="#00FFFF" />
              <Text style={styles.instructionText}>Vote on your favorite songs each round</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="star" size={20} color="#00FFFF" />
              <Text style={styles.instructionText}>Most votes wins!</Text>
            </View>
          </View>
        </LinearGradient>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backgroundGradient: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#CCDDFF',
    marginBottom: 40,
  },
  loader: {
    marginVertical: 40,
  },
  createContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 20,
  },
  joinContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 20,
  },
  createButton: {
    width: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  joinButton: {
    width: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  joinText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  codeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '80%',
    padding: 15,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 5,
  },
  switchModeButton: {
    padding: 12,
  },
  switchModeText: {
    color: '#00FFFF',
    fontSize: 16,
  },
  instructionsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginTop: 30,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 10,
  },
});