// app/game/create.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';

export default function CreateGameScreen() {
  const { spotifyId, username } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [roundCount, setRoundCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  
  // Connect to socket server and create a room
  useEffect(() => {
    const socket = io('http://localhost:3000');
    
    // Handle connection error
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to the game server');
      setLoading(false);
    });
    
    // Handle connection
    socket.on('connect', () => {
      console.log('Connected to socket server');
      
      // Create a new room
      socket.emit('createRoom', { 
        spotifyId: spotifyId as string, 
        username: username as string 
      });
    });
    
    // Handle room created event
    socket.on('roomCreated', ({ roomCode, gameState }) => {
      console.log('Room created:', roomCode);
      setRoomCode(roomCode);
      setPlayers(gameState.players);
      setLoading(false);
    });
    
    // Handle player joined event
    socket.on('playerJoined', ({ gameState }) => {
      console.log('Player joined');
      setPlayers(gameState.players);
    });
    
    // Handle game error
    socket.on('gameError', ({ message }) => {
      console.error('Game error:', message);
      setError(message);
      setLoading(false);
    });
    
    // Start game when all players are ready
    socket.on('gameStarted', ({ gameState }) => {
      console.log('Game started!');
      router.replace({
        pathname: '/game/play/[roomCode]',
        params: { 
          roomCode: roomCode as string, 
          spotifyId: spotifyId as string,
          username: username as string
        }
      });
    });
    
    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [roomCode]);

  // Start the game
  const handleStartGame = () => {
    if (players.length < 2) {
      Alert.alert('Not enough players', 'You need at least 2 players to start a game');
      return;
    }
    
    // Navigate to song selection
    router.push({
      pathname: '/game/select/[roomCode]',
      params: { 
        roomCode: roomCode as string, 
        spotifyId: spotifyId as string,
        username: username as string
      }
    });
  };

  // Render player item
  const renderPlayerItem = ({ item, index }: { item: any, index: number }) => (
    <View style={styles.playerItem}>
      <View style={styles.playerInfo}>
        <View style={styles.playerAvatar}>
          <Text style={styles.playerAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.playerName}>@{item.username}</Text>
          {item.isHost && <Text style={styles.hostBadge}>Host</Text>}
        </View>
      </View>
      
      <View style={styles.playerStatus}>
        {item.isReady ? (
          <Ionicons name="checkmark-circle" size={24} color="#00FF00" />
        ) : (
          <Ionicons name="time-outline" size={24} color="#FFAA00" />
        )}
      </View>
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.loadingText}>Creating game room...</Text>
      </LinearGradient>
    );
  }

  // Error state
  if (error) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color="#FF5555" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Game Lobby</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.roomCodeContainer}>
        <Text style={styles.roomCodeLabel}>Room Code:</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <Text style={styles.shareText}>Share this code with friends</Text>
      </View>
      
      <View style={styles.settingsContainer}>
        <Text style={styles.settingsTitle}>Game Settings</Text>
        <View style={styles.roundSelector}>
          <Text style={styles.roundLabel}>Rounds:</Text>
          <View style={styles.roundButtons}>
            {[3, 5, 7].map(count => (
              <TouchableOpacity
                key={count}
                style={[
                  styles.roundButton,
                  roundCount === count && styles.selectedRoundButton
                ]}
                onPress={() => setRoundCount(count)}
              >
                <Text style={[
                  styles.roundButtonText,
                  roundCount === count && styles.selectedRoundButtonText
                ]}>{count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      
      <View style={styles.playersContainer}>
        <Text style={styles.playersTitle}>Players ({players.length})</Text>
        <FlatList
          data={players}
          keyExtractor={(item) => item.spotifyId}
          renderItem={renderPlayerItem}
          contentContainerStyle={styles.playersList}
        />
      </View>
      
      <TouchableOpacity
        style={styles.startButton}
        onPress={handleStartGame}
      >
        <LinearGradient
          colors={['#00FFFF', '#007AFF']}
          style={styles.startButtonGradient}
        >
          <Text style={styles.startButtonText}>Start Game</Text>
        </LinearGradient>
      </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 30,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  backButtonText: {
    color: '#00FFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  roomCodeContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  roomCodeLabel: {
    fontSize: 16,
    color: '#CCDDFF',
  },
  roomCode: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00FFFF',
    letterSpacing: 5,
    marginVertical: 8,
  },
  shareText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  settingsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  roundSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  roundButtons: {
    flexDirection: 'row',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  selectedRoundButton: {
    backgroundColor: '#00FFFF',
  },
  roundButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedRoundButtonText: {
    color: '#1A2151',
  },
  playersContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  playersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  playersList: {
    paddingBottom: 10,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00FFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2151',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hostBadge: {
    fontSize: 12,
    color: '#00FFFF',
    marginTop: 2,
  },
  playerStatus: {
    paddingRight: 8,
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 30,
  },
  startButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});