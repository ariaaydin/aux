import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import io from 'socket.io-client';

// Define game phases
const PHASES = {
  CATEGORY: 'category',
  SUBMISSION: 'submission',
  PLAYBACK: 'playback',
  VOTING: 'voting',
  RESULTS: 'results'
};

// Define Player type
type Player = {
  spotifyId: string;
  username: string;
  selectedSongs: Song[];
};

// Define Song type
type Song = {
  trackId: string;
  trackName: string;
  trackArtist: string;
  trackImage: string;
};

export default function GamePlayScreen() {
  const { roomCode, spotifyId, username } = useLocalSearchParams();
  const [gameState, setGameState] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<string>(PHASES.CATEGORY);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [category, setCategory] = useState<string>('');
  const [round, setRound] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [mySongs, setMySongs] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number>(-1);
  const [songProgress, setSongProgress] = useState<{ [key: number]: number }>({}); // Progress per song
  const [selectedSongForSubmission, setSelectedSongForSubmission] = useState<string | null>(null);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [isGameCompleted, setIsGameCompleted] = useState<boolean>(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
  const router = useRouter();

  // Connect to socket server and initialize
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
  
    SecureStore.getItemAsync('spotify_token').then(token => {
      setToken(token);
    });
  
    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      newSocket.emit('joinGame', { roomCode: roomCode as string, spotifyId: spotifyId as string });
    });
  
    newSocket.on('gameState', (data) => {
      console.log('Game state received:', JSON.stringify(data, null, 2));
      setGameState(data);
      setCurrentPhase(data.currentPhase);
      setRound(data.currentRound);
      setTotalRounds(data.totalRounds);
      setCategory(data.category);
      setTimeLeft(data.timeLeft);
  
      const myPlayerData = data.players.find((p: any) => p.spotifyId === spotifyId);
      if (myPlayerData) {
        if (myPlayerData.selectedSongs && myPlayerData.selectedSongs.length > 0) {
          console.log(`Setting mySongs for ${spotifyId}:`, myPlayerData.selectedSongs);
          setMySongs(myPlayerData.selectedSongs);
        } else {
          console.log(`No selectedSongs found for ${spotifyId} in gameState`);
          setMySongs([]); // Ensure empty array if no songs
        }
      } else {
        console.log(`Player ${spotifyId} not found in gameState.players`);
        setMySongs([]);
      }
  
      if (data.currentPhase === PHASES.PLAYBACK || data.currentPhase === PHASES.VOTING) {
        setSubmissions(data.submissions);
      }
  
      if (data.currentPhase === PHASES.RESULTS) {
        setRoundResults(data.roundResults);
        setLeaderboard(data.leaderboard);
      }
  
      if (data.isLastRound && data.currentPhase === PHASES.RESULTS) {
        setIsGameCompleted(true);
      }
    });
  
    newSocket.on('songSubmitted', ({ success }) => {
      if (success) console.log('Song successfully submitted');
    });
  
    newSocket.on('voteSubmitted', ({ success }) => {
      if (success) console.log('Vote successfully submitted');
    });
  
    newSocket.on('playbackUpdate', ({ index }) => {
      setCurrentPlayingIndex(index);
      setSongProgress(prev => ({ ...prev, [index]: 30 }));
    });
  
    newSocket.on('gameError', ({ message }) => {
      console.error('Game error:', message);
      Alert.alert('Game Error', message);
    });
  
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true })
    ]).start();
  
    return () => {
      newSocket.disconnect();
      return undefined;
    };
  }, [roomCode, spotifyId]);


  // Phase timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  // Song progress countdown during playback
  useEffect(() => {
    if (currentPhase !== PHASES.PLAYBACK || currentPlayingIndex < 0) return;
    const interval = setInterval(() => {
      setSongProgress(prev => ({
        ...prev,
        [currentPlayingIndex]: Math.max(0, (prev[currentPlayingIndex] || 30) - 1)
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentPhase, currentPlayingIndex]);

  const handleSubmitSong = () => {
    if (!selectedSongForSubmission) {
      Alert.alert('Select a song', 'Please select a song to submit');
      return;
    }
    socket.emit('submitSong', { roomCode, spotifyId, trackId: selectedSongForSubmission });
  };

  const handleSubmitVote = () => {
    if (!selectedVote) {
      Alert.alert('Select a song', 'Please vote for a song');
      return;
    }
    socket.emit('submitVote', { roomCode, spotifyId, voteForPlayerId: selectedVote });
  };

  const handleReturnToLobby = () => {
    router.replace('/game');
  };

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case PHASES.CATEGORY:
        return renderCategoryPhase();
      case PHASES.SUBMISSION:
        return renderSubmissionPhase();
      case PHASES.PLAYBACK:
        return renderPlaybackPhase();
      case PHASES.VOTING:
        return renderVotingPhase();
      case PHASES.RESULTS:
        return renderResultsPhase();
      default:
        return <ActivityIndicator size="large" color="#00FFFF" />;
    }
  };

  const renderCategoryPhase = () => (
    <Animated.View 
      style={[styles.categoryContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <Text style={styles.categoryLabel}>Category:</Text>
      <Text style={styles.categoryText}>{category}</Text>
      <Text style={styles.categoryInstructions}>
        Get ready to pick your best song that matches this category!
      </Text>
    </Animated.View>
  );

  const renderSubmissionPhase = () => {
  console.log('Rendering submission phase with mySongs:', mySongs);
  return (
    <View style={styles.submissionContainer}>
      <Text style={styles.submissionTitle}>Pick Your Song</Text>
      <Text style={styles.submissionSubtitle}>
        Which of your songs best fits: "{category}"?
      </Text>
      <View style={styles.timerContainer}>
        <Ionicons name="timer-outline" size={24} color="#FFAA00" />
        <Text style={styles.timerText}>{timeLeft}s</Text>
      </View>
      {mySongs.length === 0 ? (
        <Text style={styles.noSongsText}>
          No songs available. Please ensure you selected songs in the lobby.
        </Text>
      ) : (
        <FlatList
          data={mySongs}
          keyExtractor={(item) => item.trackId || `${Math.random()}`} // Fallback key
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.songItem,
                selectedSongForSubmission === item.trackId && styles.selectedSongItem
              ]}
              onPress={() => {
                console.log('Selected song:', item);
                setSelectedSongForSubmission(item.trackId);
              }}
            >
              <Image
                source={{ uri: item.trackImage || 'https://via.placeholder.com/60' }}
                style={styles.songImage}
              />
              <View style={styles.songDetails}>
                <Text style={styles.songName} numberOfLines={1}>
                  {item.trackName || 'Unknown Track'}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {item.trackArtist || 'Unknown Artist'}
                </Text>
              </View>
              <View style={styles.selectionIndicator}>
                {selectedSongForSubmission === item.trackId ? (
                  <Ionicons name="checkmark-circle" size={24} color="#00FFFF" />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.songsList}
        />
      )}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmitSong}
        disabled={!selectedSongForSubmission}
      >
        <LinearGradient
          colors={selectedSongForSubmission ? ['#00FFAA', '#00AAFF'] : ['#666666', '#444444']}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>Submit</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const renderPlaybackPhase = () => {
    console.log('Rendering playback phase:', { currentPlayingIndex, submissions });
    return (
      <View style={styles.playbackContainer}>
        <Text style={styles.playbackTitle}>Listening Time</Text>
        <Text style={styles.playbackSubtitle}>
          Listen to each song submission for "{category}"
        </Text>
        
        {submissions.length > 0 && currentPlayingIndex >= 0 && currentPlayingIndex < submissions.length ? (
          <View style={styles.playerContainer}>
            <View style={styles.nowPlayingHeader}>
              <Ionicons name="musical-notes" size={24} color="#00FFFF" style={styles.nowPlayingIcon} />
              <Text style={styles.nowPlayingText}>
                Now Playing ({currentPlayingIndex + 1}/{submissions.length})
              </Text>
            </View>
            
            <View style={styles.spotifyPlayerContainer}>
              {token ? (
                <WebView
                  source={{
                    html: `
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <style>
                            body { margin: 0; padding: 0; background-color: #121212; color: white; font-family: Arial, sans-serif; }
                            iframe { border: none; width: 100%; height: 80px; }
                            .loader { text-align: center; padding: 10px; }
                            .error { color: red; padding: 10px; text-align: center; }
                          </style>
                        </head>
                        <body>
                          <div class="loader" id="loader">Loading Spotify player...</div>
                          <iframe 
                            id="spotifyFrame"
                            src="https://open.spotify.com/embed/track/${submissions[currentPlayingIndex].trackId}?autoplay=1" 
                            frameborder="0" 
                            allowtransparency="true" 
                            allow="encrypted-media; autoplay"
                            onload="document.getElementById('loader').style.display = 'none';"
                          ></iframe>
                          <script>
                            // Add error handling
                            setTimeout(function() {
                              if (document.getElementById('loader').style.display !== 'none') {
                                document.getElementById('loader').innerHTML = 'Player is taking longer than expected to load...';
                              }
                            }, 5000);
                          </script>
                        </body>
                      </html>
                    `
                  }}
                  style={styles.webView}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  mediaPlaybackRequiresUserAction={false}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('WebView error:', nativeEvent);
                  }}
                />
              ) : (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={24} color="#FF5555" />
                  <Text style={styles.noTokenText}>Spotify token not available</Text>
                </View>
              )}
            </View>
            
            <View style={styles.songDetailsContainer}>
              {(() => {
                const song: Song | undefined = gameState?.players
                  .find((p: Player) => p.spotifyId === submissions[currentPlayingIndex]?.playerId)
                  ?.selectedSongs.find((s: Song) => s.trackId === submissions[currentPlayingIndex]?.trackId);
                
                return song ? (
                  <>
                    <Text style={styles.songTitle}>{song.trackName}</Text>
                    <Text style={styles.songArtist}>by {song.trackArtist}</Text>
                  </>
                ) : (
                  <Text style={styles.songTitle}>Unknown Song</Text>
                );
              })()}
            </View>
            
            <View style={styles.progressBarContainer}>
              <Text style={styles.timeRemaining}>
                {songProgress[currentPlayingIndex] || 0}s remaining
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { 
                      width: `${((songProgress[currentPlayingIndex] || 0) / 30) * 100}%`,
                      backgroundColor: '#00FFFF'
                    }
                  ]}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={24} color="#FF5555" />
            <Text style={styles.noSongsText}>No submissions to play</Text>
          </View>
        )}
        
        <Text style={styles.playersListTitle}>All Submissions</Text>
        <FlatList
          data={submissions}
          keyExtractor={(item, index) => `${item.playerId}-${index}`}
          renderItem={({ item, index }) => {
            const progress = songProgress[index] || 0;
            const isPlaying = index === currentPlayingIndex;
            const player: Player | undefined = gameState?.players.find((p: Player) => p.spotifyId === item.playerId);
            const song = player?.selectedSongs.find((s) => s.trackId === item.trackId);
            
            return (
              <View 
                style={[
                  styles.songPlaybackItem,
                  isPlaying && styles.currentPlaybackItem
                ]}
              >
                <View style={styles.songPlaybackInfo}>
                  <Text style={styles.songPlaybackNumber}>{index + 1}.</Text>
                  <View style={styles.songPlaybackDetails}>
                    <Text style={styles.songPlaybackName}>
                      {song?.trackName || 'Unknown Song'}
                    </Text>
                    <Text style={styles.songPlaybackArtist}>
                      by {song?.trackArtist || 'Unknown Artist'}
                    </Text>
                  </View>
                  {isPlaying && (
                    <View style={styles.playingIndicator}>
                      <Ionicons name="musical-notes" size={18} color="#00FFFF" />
                      <Text style={styles.nowPlayingIndicatorText}>Now Playing</Text>
                    </View>
                  )}
                </View>
                
                {isPlaying && (
                  <View style={styles.miniProgressBar}>
                    <View
                      style={[
                        styles.miniProgressFill,
                        { width: `${(progress / 30) * 100}%` }
                      ]}
                    />
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={styles.submissionsList}
        />
        
        <Text style={styles.playbackInstructions}>
          Get ready to vote for your favorite song in this category!
        </Text>
      </View>
    );
  };
  const renderVotingPhase = () => (
    <View style={styles.votingContainer}>
      <Text style={styles.votingTitle}>Vote Time</Text>
      <Text style={styles.votingSubtitle}>
        Which song best fits: "{category}"?
      </Text>
      <View style={styles.timerContainer}>
        <Ionicons name="timer-outline" size={24} color="#FFAA00" />
        <Text style={styles.timerText}>{timeLeft}s</Text>
      </View>
      <FlatList
        data={submissions}
        keyExtractor={(item, index) => `${item.playerId}-${index}`}
        renderItem={({ item, index }) => {
          const isOwnSubmission = item.playerId === spotifyId;
          const player = gameState?.players.find((p: any) => p.spotifyId === item.playerId);
          const song = player?.selectedSongs.find((s: any) => s.trackId === item.trackId);
          return (
            <TouchableOpacity
              style={[
                styles.submissionItem,
                selectedVote === item.playerId && styles.selectedVoteItem,
                isOwnSubmission && styles.ownSubmissionItem
              ]}
              onPress={() => !isOwnSubmission && setSelectedVote(item.playerId)}
              disabled={isOwnSubmission}
            >
              <View style={styles.submissionInfo}>
                <Text style={styles.submissionNumber}>
                  {song?.trackName || `Song ${index + 1}`}
                </Text>
                {isOwnSubmission && (
                  <View style={styles.ownSubmissionBadge}>
                    <Text style={styles.ownSubmissionText}>Your Song</Text>
                  </View>
                )}
              </View>
              <View style={styles.selectionIndicator}>
                {selectedVote === item.playerId ? (
                  <Ionicons name="checkmark-circle" size={24} color="#00FFFF" />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.submissionsList}
      />
      <TouchableOpacity
        style={styles.voteButton}
        onPress={handleSubmitVote}
        disabled={!selectedVote}
      >
        <LinearGradient
          colors={selectedVote ? ['#00FFAA', '#00AAFF'] : ['#666666', '#444444']}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>Vote</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderResultsPhase = () => (
    <View style={styles.resultsContainer}>
      {isGameCompleted ? (
        <View style={styles.finalResultsContainer}>
          <Text style={styles.finalResultsTitle}>Game Over!</Text>
          <Text style={styles.finalResultsSubtitle}>Final Standings</Text>
          <FlatList
            data={leaderboard.sort((a, b) => b.points - a.points)}
            keyExtractor={(item) => item.spotifyId}
            renderItem={({ item, index }) => (
              <View style={[
                styles.playerResultItem,
                index === 0 && styles.winnerItem,
                item.spotifyId === spotifyId && styles.currentPlayerItem
              ]}>
                <View style={styles.rankContainer}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.playerResultInfo}>
                  <Text style={styles.playerResultName}>
                    {item.username}
                    {item.spotifyId === spotifyId && " (You)"}
                  </Text>
                </View>
                <View style={styles.pointsContainer}>
                  <Text style={styles.pointsText}>{item.points}</Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.leaderboardList}
          />
          <TouchableOpacity
            style={styles.backToLobbyButton}
            onPress={handleReturnToLobby}
          >
            <LinearGradient
              colors={['#00FFAA', '#00AAFF']}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Return to Lobby</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.roundResultsContainer}>
          <Text style={styles.roundResultsTitle}>Round {round} Results</Text>
          <Text style={styles.roundResultsSubtitle}>"{category}"</Text>
          {roundResults && (
            <FlatList
              data={roundResults.submissions.sort((a: any, b: any) => b.votes.length - a.votes.length)}
              keyExtractor={(item: any) => item.playerId}
              renderItem={({ item, index }) => {
                const isWinner = index === 0;
                const isOwnSubmission = item.playerId === spotifyId;
                const player = gameState?.players.find((p: any) => p.spotifyId === item.playerId);
                const song = player?.selectedSongs.find((s: any) => s.trackId === item.trackId);
                return (
                  <View style={[
                    styles.songResultItem,
                    isWinner && styles.winnerSongItem,
                    isOwnSubmission && styles.ownSongResultItem
                  ]}>
                    <View style={styles.songResultRank}>
                      <Text style={isWinner ? styles.winnerRankText : styles.rankText}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.songResultInfo}>
                      <Text style={styles.songResultName}>
                        {song?.trackName || 'Unknown'} by {player?.username || 'Unknown'}
                        {isOwnSubmission && " (You)"}
                      </Text>
                      <Text style={styles.songResultPoints}>
                        +{isWinner ? 3 : (index === 1 ? 2 : (item.votes.length > 0 ? 1 : 0))} points
                      </Text>
                    </View>
                    <View style={styles.votesContainer}>
                      <Text style={styles.votesCount}>{item.votes.length}</Text>
                      <Ionicons name="heart" size={16} color="#FF5599" />
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={styles.resultsListContainer}
            />
          )}
          <View style={styles.leaderboardPreviewContainer}>
            <Text style={styles.leaderboardPreviewTitle}>Current Standings</Text>
            <FlatList
              data={leaderboard.slice(0, 3)}
              keyExtractor={(item) => item.spotifyId}
              renderItem={({ item, index }) => (
                <View style={styles.leaderboardPreviewItem}>
                  <Text style={styles.leaderboardPreviewRank}>{index + 1}.</Text>
                  <Text style={styles.leaderboardPreviewName}>
                    {item.username}
                    {item.spotifyId === spotifyId && " (You)"}
                  </Text>
                  <Text style={styles.leaderboardPreviewPoints}>{item.points} pts</Text>
                </View>
              )}
            />
          </View>
          <Text style={styles.nextRoundText}>
            Next round starting soon...
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.roundInfo}>
          <Text style={styles.roundText}>Round {round}/{totalRounds}</Text>
        </View>
        <View style={styles.phaseContainer}>
          <Text style={styles.phaseText}>{currentPhase.toUpperCase()}</Text>
          {timeLeft > 0 && currentPhase !== PHASES.PLAYBACK && (
            <Text style={styles.phaseTimerText}>{timeLeft}s</Text>
          )}
        </View>
      </View>
      <View style={styles.mainContent}>
        {renderPhaseContent()}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  currentSongContainer: {
    marginBottom: 24,
  },
  spotifyPlayerContainer: {
    width: '100%',
    height: 80,
    marginBottom: 24,
  },
  noTokenText: {
    fontSize: 16,
    color: '#FF5555',
    textAlign: 'center',
  },
  noSongsText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
  },
  webView: {
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  roundInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roundText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phaseContainer: {
    backgroundColor: 'rgba(0, 170, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00FFFF',
  },
  phaseTimerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFAA00',
    marginLeft: 8,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Category phase styles
  categoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  categoryLabel: {
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00FFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  categoryInstructions: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
  },
  
  // Submission phase styles
  submissionContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  submissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  submissionSubtitle: {
    fontSize: 16,
    color: '#CCDDFF',
    marginBottom: 16,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFAA00',
    marginLeft: 8,
  },
  songsList: {
    paddingBottom: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  selectedSongItem: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00FFFF',
  },
  songImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  songDetails: {
    flex: 1,
    marginLeft: 12,
  },
  songName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#CCDDFF',
    opacity: 0.8,
  },
  selectionIndicator: {
    paddingHorizontal: 8,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  
  // Playback phase styles
  playbackContainer: {
    flex: 1,
    paddingVertical: 20,
    alignItems: 'center',
  },
  playbackTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  playbackSubtitle: {
    fontSize: 16,
    color: '#CCDDFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  songPlaybackItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    width: '100%',
  },
  songPlaybackInfo: {
    marginBottom: 8,
  },
  songPlaybackName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nowPlayingText: {
    fontSize: 14,
    color: '#00FFFF',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  submissionsList: {
    paddingBottom: 16,
  },
  playbackInstructions: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 40,
  },
  
  // Voting phase styles
  votingContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  votingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  votingSubtitle: {
    fontSize: 16,
    color: '#CCDDFF',
    marginBottom: 16,
  },
  submissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  selectedVoteItem: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00FFFF',
  },
  ownSubmissionItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.7,
  },
  submissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submissionNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ownSubmissionBadge: {
    backgroundColor: 'rgba(255, 85, 153, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 12,
  },
  ownSubmissionText: {
    fontSize: 12,
    color: '#FF5599',
  },
  voteButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  
  // Results phase styles
  resultsContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  roundResultsContainer: {
    flex: 1,
  },
  roundResultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  roundResultsSubtitle: {
    fontSize: 16,
    color: '#CCDDFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  resultsListContainer: {
    marginBottom: 24,
  },
  songResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  winnerSongItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  ownSongResultItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#00FFFF',
  },
  songResultRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  winnerRankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  songResultInfo: {
    flex: 1,
  },
  songResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  songResultPoints: {
    fontSize: 14,
    color: '#00FFAA',
  },
  votesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  votesCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 6,
  },
  leaderboardPreviewContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  leaderboardPreviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  leaderboardPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  leaderboardPreviewRank: {
    width: 24,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leaderboardPreviewName: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  leaderboardPreviewPoints: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00FFAA',
  },
  nextRoundText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
  },
  
  // Final results styles
  finalResultsContainer: {
    flex: 1,
  },
  finalResultsTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00FFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  finalResultsSubtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  leaderboardList: {
    marginBottom: 24,
  },
  playerResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  winnerItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  currentPlayerItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#00FFFF',
  },
  rankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerResultInfo: {
    flex: 1,
  },
  playerResultName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pointsContainer: {
    backgroundColor: 'rgba(0, 255, 170, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00FFAA',
  },
  backToLobbyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
  },
  playerContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nowPlayingIcon: {
    marginRight: 8,
  },
  debugText: {
    color: '#CCDDFF',
    fontSize: 12,
    marginBottom: 8,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  songDetailsContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
 
  progressBarContainer: {
    marginTop: 12,
  },
  timeRemaining: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'right',
    marginBottom: 4,
  },
  playersListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  songPlaybackDetails: {
    flex: 1,
  },
  songPlaybackNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  songPlaybackArtist: {
    fontSize: 12,
    color: '#CCDDFF',
  },
  currentPlaybackItem: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#00FFFF',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nowPlayingIndicatorText: {
    fontSize: 12,
    color: '#00FFFF',
    marginLeft: 4,
  },
  miniProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#00FFFF',
  },

});