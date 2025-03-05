// app/game/create.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import socketManager from '../utils/socket-manager';

export default function CreateGameScreen() {
  const { spotifyId, username } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [roomCode, setRoomCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [roundCount, setRoundCount] = useState(5);
  const [error, setError] = useState(null);
  const [testMode, setTestMode] = useState(false);
  const [botCount, setBotCount] = useState(3); // Default to 3 bots
  
  // Use refs to prevent duplicate event handling
  const hasCreatedRoom = useRef(false);
  const loadingTimeout = useRef(null);
  
  const router = useRouter();
  
  // Connect to socket server and create a room
  useEffect(() => {
    // Only execute this code once
    if (hasCreatedRoom.current) return;
    hasCreatedRoom.current = true;
    
    // Initialize socket manager
    socketManager.init('');    
    
    // Add a slight delay before showing loading
    loadingTimeout.current = setTimeout(() => {
      if (!roomCode) {
        setLoading(true);
      }
    }, 300);
    
    // Register event handlers
    socketManager.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to the game server');
      setLoading(false);
      
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
        loadingTimeout.current = null;
      }
    });
    
    socketManager.on('roomCreated', (data) => {
      const { roomCode, gameState } = data;
      console.log('Room created:', roomCode);
      
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
        loadingTimeout.current = null;
      }
      
      setRoomCode(roomCode);
      setPlayers(gameState.players);
      setLoading(false);
    });
    
    socketManager.on('playerJoined', (data) => {
      const { gameState } = data;
      console.log('Player joined');
      setPlayers(gameState.players);
    });
    
    socketManager.on('gameError', (data) => {
      const { message } = data;
      console.error('Game error:', message);
      setError(message);
      setLoading(false);
      
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
        loadingTimeout.current = null;
      }
    });
    
    socketManager.on('gameStarted', (data) => {
      console.log('Game started!');
      
      if (roomCode) {
        router.replace({
          pathname: '/game/play/[roomCode]',
          params: { 
            roomCode: roomCode, 
            spotifyId: spotifyId,
            username: username
          }
        });
      }
    });
    
    // Create a new room
    console.log('Creating room for user:', spotifyId, username);
    socketManager.emit('createRoom', { 
      spotifyId: spotifyId, 
      username: username,
      totalRounds: roundCount // Pass round count to server
    });
    
    // Cleanup event handlers on unmount
    return () => {
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
      }
      
      socketManager.off('connect_error');
      socketManager.off('roomCreated');
      socketManager.off('playerJoined');
      socketManager.off('gameError');
      socketManager.off('gameStarted');
    };
  }, []); // Empty dependency array ensures this runs once

  // Update round count on server when it changes
  useEffect(() => {
    if (roomCode) {
      socketManager.emit('updateRoundCount', { 
        roomCode,
        roundCount
      });
    }
  }, [roomCode, roundCount]);

  // Start the game
  const handleStartGame = () => {
    // If test mode is enabled, we should account for the bot players
    const playerCount = testMode ? players.length + botCount : players.length;

    if (playerCount < 2) {
      Alert.alert('Not enough players', 'You need at least 2 players to start a game');
      return;
    }
    
    // Navigate to waiting room
    router.push({
      pathname: '/game/waiting/[roomCode]',
      params: { 
        roomCode: roomCode, 
        spotifyId: spotifyId,
        username: username,
        testMode: testMode ? 'true' : 'false',
        botCount: botCount.toString()
      }
    });
  };

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
        <Text style={styles.headerTitle}>Song Wars</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.roomCodeContainer}>
        <Text style={styles.roomCodeLabel}>Room Code:</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <Text style={styles.shareText}>Share this code with friends to join</Text>
      </View>
      
      {/* Game settings section */}
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
        
        {/* Test Mode UI */}
        <View style={styles.testModeContainer}>
          <Text style={styles.testModeTitle}>Test Mode</Text>
          <View style={styles.testModeRow}>
            <Switch
              value={testMode}
              onValueChange={setTestMode}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={testMode ? '#00FFFF' : '#f4f3f4'}
            />
            <Text style={styles.testModeLabel}>
              {testMode ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          
          {testMode && (
            <View style={styles.botCountContainer}>
              <Text style={styles.botCountLabel}>Bot Players: {botCount}</Text>
              <View style={styles.botCountControls}>
                <TouchableOpacity
                  style={styles.botButton}
                  onPress={() => setBotCount(Math.max(1, botCount - 1))}
                >
                  <Text style={styles.botButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.botButton}
                  onPress={() => setBotCount(Math.min(7, botCount + 1))}
                >
                  <Text style={styles.botButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.hostInstructionsContainer}>
        <Ionicons name="information-circle-outline" size={24} color="#00FFFF" style={styles.infoIcon} />
        <Text style={styles.hostInstructionsText}>
          You're the host! Once your friends join with the room code, click "Start Game" to begin.
        </Text>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  roomCodeContainer: {
    alignItems: 'center',
    marginVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 20,
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
    marginBottom: 16,
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
  hostInstructionsContainer: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
  },
  hostInstructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
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
  testModeContainer: {
    marginTop: 16,
  },
  testModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  testModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testModeLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  botCountContainer: {
    marginTop: 16,
  },
  botCountLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  botCountControls: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  botButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  botButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});