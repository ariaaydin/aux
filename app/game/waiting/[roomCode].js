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
  
  const [isReady, setIsReady] = useState(false);
  
  // Game state from custom hook
  const {
    players,
    isWaitingToJoin,
    isLoading,
    error,
    joinRoom,
    setPlayerReady,
    gameState,
    currentPhase,
    startGame, // New function to start the game
  } = useGameState(
    roomCode,
    spotifyId,
    (errorMsg) => Alert.alert('Error', errorMsg),
    testMode,
    botCount
  );
  
  // Effect to handle game start
  useEffect(() => {
    if (gameState && gameState.status === 'playing') {
      console.log('Game started, redirecting to song selection screen');
      router.replace({
        pathname: '/game/select/[roomCode]',
        params: { 
          roomCode: roomCode, 
          spotifyId: spotifyId,
          username: username
        }
      });
    }
  }, [gameState, roomCode, spotifyId, username, router]);
  
  // Effect to join the room when the component mounts
  useEffect(() => {
    if (isWaitingToJoin && roomCode && spotifyId && username) {
      joinRoom(roomCode, username);
    }
  }, [isWaitingToJoin, roomCode, spotifyId, username, joinRoom]);
  
  // Determine if current player is the host
  const isHost = players.find(p => p.spotifyId === spotifyId)?.isHost || false;
  
  // Determine if all players are ready
  const allPlayersReady = players.length >= 2 && players.every(p => p.isReady);
  
  // Handle ready button press
  const handleReadyPress = () => {
    setPlayerReady([]);
    setIsReady(true);
  };
  
  // Handle start game button press (host only)
  const handleStartGame = () => {
    if (isHost) {
      if (players.length < 2) {
        Alert.alert("Not enough players", "You need at least 2 players to start the game.");
        return;
      }
      
      if (!allPlayersReady) {
        Alert.alert("Players not ready", "All players must be ready before starting the game.");
        return;
      }
      
      startGame();
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
          disabled={isReady}
        >
          <Ionicons name="arrow-back" size={24} color={isReady ? "#666666" : "#FFFFFF"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Song Wars</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.roomInfoContainer}>
        <Text style={styles.roomCodeLabel}>Room Code:</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <Text style={styles.waitingText}>
          {testMode 
            ? 'TEST MODE: Bots will join automatically' 
            : 'Waiting for players to join...'}
        </Text>
      </View>
      
      <View style={styles.playersContainer}>
        <Text style={styles.sectionTitle}>
          Players ({players.length})
          {isHost && <Text style={styles.hostIndicator}> - You are the host</Text>}
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
          {isHost ? (
            "As the host, you can start the game once all players are ready. Click 'Start Game' when everyone is ready."
          ) : (
            "When you're ready to play, press the 'I'm Ready!' button below. Once all players are ready, the host will start the game."
          )}
        </Text>
      </View>
      
      {/* Regular player ready button */}
      {!isHost && (
        <TouchableOpacity
          style={[
            styles.readyButton,
            isReady ? styles.readyButtonDisabled : styles.readyButtonActive
          ]}
          onPress={handleReadyPress}
          disabled={isReady}
        >
          <LinearGradient
            colors={isReady ? ['#666666', '#444444'] : ['#00FFAA', '#00AAFF']}
            style={styles.readyButtonGradient}
          >
            <Text style={styles.readyButtonText}>
              {isReady ? 'Waiting for other players...' : 'I\'m Ready!'}
            </Text>
            {isReady && <ActivityIndicator size="small" color="#FFFFFF" style={styles.readyIndicator} />}
          </LinearGradient>
        </TouchableOpacity>
      )}
      
      {/* Host buttons: Ready + Start Game */}
      {isHost && (
        <>
          <TouchableOpacity
            style={[
              styles.readyButton,
              isReady ? styles.readyButtonDisabled : styles.readyButtonActive
            ]}
            onPress={handleReadyPress}
            disabled={isReady}
          >
            <LinearGradient
              colors={isReady ? ['#666666', '#444444'] : ['#00FFAA', '#00AAFF']}
              style={styles.readyButtonGradient}
            >
              <Text style={styles.readyButtonText}>
                {isReady ? 'Ready' : 'I\'m Ready!'}
              </Text>
              {isReady && <Ionicons name="checkmark" size={20} color="#FFFFFF" style={styles.readyIcon} />}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.startGameButton,
              (!allPlayersReady) ? styles.startGameButtonDisabled : {}
            ]}
            onPress={handleStartGame}
            disabled={!allPlayersReady}
          >
            <LinearGradient
              colors={allPlayersReady ? ['#FF00AA', '#AA00FF'] : ['#666666', '#444444']}
              style={styles.startGameButtonGradient}
            >
              <Text style={styles.startGameButtonText}>Start Game</Text>
              <Ionicons name="play" size={20} color="#FFFFFF" style={styles.startIcon} />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
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
  hostIndicator: {
    color: '#00FFFF',
    fontWeight: '400',
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
  readyButton: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  readyButtonActive: {
    opacity: 1,
  },
  readyButtonDisabled: {
    opacity: 0.7,
  },
  readyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  readyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  readyIndicator: {
    marginLeft: 8,
  },
  readyIcon: {
    marginLeft: 8,
  },
  startGameButton: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 12,
    overflow: 'hidden',
  },
  startGameButtonDisabled: {
    opacity: 0.5,
  },
  startGameButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  startGameButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  startIcon: {
    marginLeft: 4,
  },
});