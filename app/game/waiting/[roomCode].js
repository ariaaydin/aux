// app/game/waiting/[roomCode].js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useGameState } from '../../utils/game-state-manager';

export default function WaitingRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const roomCode = typeof params.roomCode === 'string' ? params.roomCode : '';
  const spotifyId = typeof params.spotifyId === 'string' ? params.spotifyId : '';
  const username = typeof params.username === 'string' ? params.username : '';
  const testMode = params.testMode === 'true';
  const botCount = params.botCount ? parseInt(String(params.botCount), 10) : 0;
  
  const [buttonPressed, setButtonPressed] = useState(false);
  
  // Game state from custom hook
  const {
    players,
    isWaitingToJoin,
    isLoading,
    error,
    joinRoom,
    setPlayerReady,
    gameState,
    currentPhase
  } = useGameState(
    roomCode,
    spotifyId,
    (errorMsg) => Alert.alert('Error', errorMsg),
    testMode,
    botCount
  );
  

// In your useEffect that handles game status:
useEffect(() => {
  if (gameState && gameState.status === 'playing') {
    console.log('Game started, preparing to navigate to song selection screen');
    
    // Add a slight delay before redirection to prevent state flickering
    const redirectTimer = setTimeout(() => {
      console.log('Now navigating to song selection screen');
      router.replace({
        pathname: '/game/select/[roomCode]',
        params: { 
          roomCode: roomCode, 
          spotifyId: spotifyId,
          username: username
        }
      });
    }, 200); // Increased delay to ensure socket operations complete
    
    return () => clearTimeout(redirectTimer);
  }
}, [gameState, roomCode, spotifyId, username, router]);

// Add a secondary effect to watch for all players ready state
useEffect(() => {
  // Count how many players are ready
  const readyCount = players.filter(p => p.isReady).length;
  
  // Check if all players are ready
  const allReady = players.length >= 2 && players.every(p => p.isReady);
  console.log(`Ready players: ${readyCount}/${players.length}, All ready: ${allReady}`);
  
  // If all players ready and you are host, try to start
  if (allReady) {
    const isHost = players.find(p => p.spotifyId === spotifyId)?.isHost || false;
    if (isHost) {
      console.log("Host detected: All players ready - should auto-start soon");
    }
  }
}, [players, spotifyId]);
  // Effect to join the room when the component mounts
  useEffect(() => {
    if (isWaitingToJoin && roomCode && spotifyId && username) {
      joinRoom(roomCode, username);
    }
  }, [isWaitingToJoin, roomCode, spotifyId, username, joinRoom]);
  
  // Check if this player is already ready
  const isSelfReady = players.find(p => p.spotifyId === spotifyId)?.isReady || false;
  
  // Check if all players are ready
  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady);
  
  // Count how many players are ready
  const readyCount = players.filter(p => p.isReady).length;
  
  // Handle ready/start button press
  const handleStartPress = () => {
    if (!buttonPressed) {
      setButtonPressed(true);
      setPlayerReady(); 
      console.log("Marked player as ready");
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.loadingText}>Joining game room...</Text>
      </LinearGradient>
    );
  }
  
  // Error state
  if (error) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color="#FF5555" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/game')}>
          <Text style={styles.backButtonText}>Return to Lobby</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }
  
  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.replace('/game')}
          disabled={buttonPressed}
        >
          <Ionicons name="arrow-back" size={24} color={buttonPressed ? "#666666" : "#FFFFFF"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Song Wars</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.roomInfoContainer}>
        <Text style={styles.roomCodeLabel}>Room Code:</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <Text style={styles.waitingText}>
          {testMode 
            ? 'TEST MODE: Bots are automatically ready' 
            : 'Waiting for all players to start...'}
        </Text>
      </View>
      
      <View style={styles.playersContainer}>
        <Text style={styles.sectionTitle}>
          Players Ready: {readyCount}/{players.length}
        </Text>
        <FlatList
          data={players}
          keyExtractor={(item) => item.spotifyId}
          renderItem={({ item }) => (
            <View style={styles.playerItem}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {item.username}
                  {item.spotifyId === spotifyId && " (You)"}
                </Text>
                {item.isHost && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>Host</Text>
                  </View>
                )}
              </View>
              <View style={[
                styles.readyStatus, 
                item.isReady ? styles.readyStatusActive : styles.readyStatusInactive
              ]}>
                <Text style={styles.readyStatusText}>
                  {item.isReady ? 'Ready' : 'Not Ready'}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={styles.playersList}
        />
      </View>
      
      <View style={styles.instructionsContainer}>
        <Ionicons name="information-circle" size={24} color="#00FFFF" />
        <Text style={styles.instructionsText}>
          {allPlayersReady 
            ? "All players are ready! The game will start automatically." 
            : "Click 'Start Game' when you're ready to play. The game will start when all players are ready."}
        </Text>
      </View>
      
     {/* Single start button for all players */}
    <TouchableOpacity
      style={[
        styles.startButton,
        (isSelfReady || buttonPressed) ? styles.startButtonDisabled : styles.startButtonActive
      ]}
      onPress={handleStartPress}
      disabled={isSelfReady || buttonPressed}
    >
      <LinearGradient
        colors={(isSelfReady || buttonPressed) ? ['#666666', '#444444'] : ['#00FFAA', '#00AAFF']}
        style={styles.startButtonGradient}
      >
        <Text style={styles.startButtonText}>
          {isSelfReady || buttonPressed
            ? (allPlayersReady ? 'Starting game...' : 'Waiting for others...') 
            : 'Start Game'}
        </Text>
        {(isSelfReady || buttonPressed) && (
          allPlayersReady 
            ? <ActivityIndicator size="small" color="#FFFFFF" style={styles.startIndicator} />
            : <Ionicons name="checkmark" size={20} color="#FFFFFF" style={styles.startIcon} />
        )}
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
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  roomInfoContainer: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  roomCodeLabel: {
    fontSize: 14,
    color: '#CCDDFF',
  },
  roomCode: {
    fontSize: 32,
    fontWeight: '800',
    color: '#00FFFF',
    letterSpacing: 4,
    marginVertical: 8,
  },
  waitingText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  playersContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
    maxHeight: '30%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  playersList: {
    paddingBottom: 8,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 8,
  },
  hostBadge: {
    backgroundColor: 'rgba(0, 170, 255, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hostBadgeText: {
    fontSize: 12,
    color: '#00AAFF',
  },
  readyStatus: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readyStatusActive: {
    backgroundColor: 'rgba(0, 255, 170, 0.2)',
  },
  readyStatusInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  readyStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 12,
    lineHeight: 20,
  },
  startButton: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 30,
    borderRadius: 12,
    overflow: 'hidden',
  },
  startButtonActive: {
    opacity: 1,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  startIndicator: {
    marginLeft: 8,
  }
});