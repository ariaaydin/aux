// app/game/waiting/[roomCode].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';

export default function WaitingScreen() {
  const { roomCode, spotifyId, username } = useLocalSearchParams();
  const [players, setPlayers] = useState<any[]>([]);
  const [socket, setSocket] = useState<any>(null);
  
  const router = useRouter();

  // Connect to socket server
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    
    // Handle connection
    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      
      // Join the room
      newSocket.emit('joinRoom', { 
        roomCode: roomCode as string, 
        spotifyId: spotifyId as string, 
        username: username as string 
      });
    });
    
    // Handle player joined event
    newSocket.on('playerJoined', ({ gameState }) => {
      console.log('Player joined/updated');
      setPlayers(gameState.players || []);
    });
    
    // Handle player ready event
    newSocket.on('playerReady', ({ gameState }) => {
      console.log('Player ready');
      setPlayers(gameState.players || []);
    });
    
    // Handle game started event
    newSocket.on('gameStarted', ({ gameState }) => {
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
    
    // Handle error
    newSocket.on('gameError', ({ message }) => {
      console.error('Game error:', message);
      Alert.alert('Game Error', message);
    });
    
    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Render player item
  const renderPlayerItem = ({ item }: { item: { username: string; isHost: boolean; isReady: boolean; spotifyId: string } }) => (
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
          <View style={styles.readyStatus}>
            <Ionicons name="checkmark-circle" size={24} color="#00FF00" />
            <Text style={styles.readyText}>Ready</Text>
          </View>
        ) : (
          <View style={styles.notReadyStatus}>
            <Ionicons name="time-outline" size={24} color="#FFAA00" />
            <Text style={styles.notReadyText}>Selecting...</Text>
          </View>
        )}
      </View>
    </View>
  );

  // Calculate ready player count
  const readyCount = players.filter(p => p.isReady).length;
  const totalCount = players.length;

  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Waiting for Players</Text>
        <Text style={styles.headerSubtitle}>
          {readyCount} of {totalCount} players ready
        </Text>
      </View>
      
      <View style={styles.roomCodeContainer}>
        <Text style={styles.roomCodeLabel}>Room Code:</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
      </View>
      
      <View style={styles.readyIndicator}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.readyIndicatorText}>
          Waiting for all players to select their songs...
        </Text>
      </View>
      
      <View style={styles.playersContainer}>
        <Text style={styles.playersTitle}>Players</Text>
        <FlatList
          data={players}
          keyExtractor={(item) => item.spotifyId}
          renderItem={renderPlayerItem}
          contentContainerStyle={styles.playersList}
        />
      </View>
      
      <View style={styles.youAreReadyContainer}>
        <Ionicons name="checkmark-circle" size={24} color="#00FF00" />
        <Text style={styles.youAreReadyText}>You are ready!</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  roomCodeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  roomCodeLabel: {
    fontSize: 14,
    color: '#CCDDFF',
  },
  roomCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00FFFF',
    letterSpacing: 5,
  },
  readyIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  readyIndicatorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#FFFFFF',
    marginTop: 10,
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
  readyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readyText: {
    fontSize: 14,
    color: '#00FF00',
    marginLeft: 4,
  },
  notReadyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notReadyText: {
    fontSize: 14,
    color: '#FFAA00',
    marginLeft: 4,
  },
  youAreReadyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  youAreReadyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});