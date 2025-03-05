// app/game/play/[roomCode].js
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
  Animated,
  Dimensions,
  Switch
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useGameState } from '../../utils/game-state-manager';
import { PHASES } from '../../utils/types';

export default function GamePlayScreen() {
  const params = useLocalSearchParams();
  const roomCode = typeof params.roomCode === 'string' ? params.roomCode : '';
  const spotifyId = typeof params.spotifyId === 'string' ? params.spotifyId : '';
  const username = typeof params.username === 'string' ? params.username : '';
  
  const [token, setToken] = useState(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  
  const router = useRouter();

  // Use our custom game state hook
  const {
    currentPhase,
    timeLeft,
    category,
    round,
    totalRounds,
    mySongs,
    submissions,
    currentPlayingIndex,
    songProgress,
    selectedSongForSubmission,
    selectedVote,
    roundResults,
    leaderboard,
    isGameCompleted,
    voteSubmitted,
    submissionComplete,
    isManualProgression,
    isLoading,
    error,
    players,
    
    // State setters
    setSelectedSongForSubmission,
    setSelectedVote,
    
    // Actions
    submitSong,
    submitVote,
    manualProgressPhase,
    toggleManualProgression
  } = useGameState(
    roomCode,
    spotifyId,
    (errorMsg) => Alert.alert('Error', errorMsg)
  );

  // Get Spotify token on mount
  useEffect(() => {
    SecureStore.getItemAsync('spotify_token').then(token => {
      setToken(token);
    });
  }, []);

  // Run animation when phase changes
  useEffect(() => {
    // Reset animations
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    slideAnim.setValue(Dimensions.get('window').width);
    
    // Run animations
    Animated.parallel([
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 400, 
        useNativeDriver: true 
      }),
      Animated.timing(scaleAnim, { 
        toValue: 1, 
        duration: 400, 
        useNativeDriver: true 
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      })
    ]).start();
  }, [currentPhase, fadeAnim, scaleAnim, slideAnim]);

  // Handle song submission
  const handleSubmitSong = () => {
    if (!selectedSongForSubmission) {
      Alert.alert('Select a song', 'Please select a song to submit');
      return;
    }
    submitSong(selectedSongForSubmission);
  };

  // Handle vote submission
  const handleSubmitVote = () => {
    if (!selectedVote) {
      Alert.alert('Select a song', 'Please vote for a song');
      return;
    }
    submitVote(selectedVote);
  };

  // Handle manual phase progression (for test mode)
  const handleManualProgress = () => {
    manualProgressPhase();
  };

  // Handle return to lobby
  const handleReturnToLobby = () => {
    router.replace('/game');
  };

  // Toggle manual progression
  const handleToggleManualProgression = () => {
    toggleManualProgression();
  };

  // Loading state
  if (isLoading) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FFFF" />
        <Text style={styles.loadingText}>Loading game...</Text>
      </LinearGradient>
    );
  }

  // Error state
  if (error) {
    return (
      <LinearGradient colors={['#1A2151', '#323B71']} style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color="#FF5555" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleReturnToLobby}
        >
          <Text style={styles.backButtonText}>Return to Lobby</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // Render different content based on current phase
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
      case PHASES.COMPLETED:
        return renderCompletedPhase();
      default:
        return (
          <View style={styles.defaultContainer}>
            <ActivityIndicator size="large" color="#00FFFF" />
            <Text style={styles.defaultText}>Waiting for next phase...</Text>
          </View>
        );
    }
  };

  // CATEGORY PHASE
  const renderCategoryPhase = () => (
    <Animated.View 
      style={[
        styles.categoryContainer, 
        { 
          opacity: fadeAnim, 
          transform: [
            { scale: scaleAnim },
            { translateX: slideAnim }
          ] 
        }
      ]}
    >
      <Text style={styles.categoryLabel}>This Round's Category:</Text>
      <Text style={styles.categoryText}>{category}</Text>
      <View style={styles.categoryIconContainer}>
        <Ionicons name="musical-notes" size={64} color="#00FFFF" />
      </View>
      <Text style={styles.categoryInstructions}>
        Get ready to pick your best song that matches this category!
      </Text>
      
      {isManualProgression && (
        <TouchableOpacity
          style={styles.progressButton}
          onPress={handleManualProgress}
        >
          <LinearGradient
            colors={['#00FFAA', '#00AAFF']}
            style={styles.progressButtonGradient}
          >
            <Text style={styles.progressButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // SUBMISSION PHASE
  const renderSubmissionPhase = () => (
    <Animated.View 
      style={[
        styles.submissionContainer,
        { transform: [{ translateX: slideAnim }] }
      ]}
    >
      {/* Phase header */}
      <View style={styles.phaseHeader}>
        <View style={styles.roundIndicator}>
          <Text style={styles.roundIndicatorText}>Round {round}</Text>
        </View>
        {!isManualProgression && (
          <View style={styles.timerContainer}>
            <Ionicons name="timer-outline" size={20} color="#FFAA00" />
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>
        )}
      </View>
      
      {/* Category */}
      <Text style={styles.categoryText}>"{category}"</Text>
      
      {/* Song selection */}
      {mySongs.length === 0 ? (
        <View style={styles.noSongsContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#FF5555" />
          <Text style={styles.noSongsText}>
            No songs available. Please ensure you selected songs in the lobby.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.instructionText}>
            Select a song that best matches this category:
          </Text>
          
          <FlatList
            data={mySongs}
            keyExtractor={(item) => item.trackId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.songItem,
                  selectedSongForSubmission === item.trackId && styles.selectedSongItem,
                  submissionComplete && styles.disabledSongItem
                ]}
                onPress={() => {
                  if (!submissionComplete) {
                    setSelectedSongForSubmission(item.trackId);
                  }
                }}
                disabled={submissionComplete}
              >
                <Image
                  source={{ uri: item.trackImage || 'https://via.placeholder.com/60' }}
                  style={styles.songImage}
                />
                <View style={styles.songDetails}>
                  <Text style={styles.songName} numberOfLines={1}>
                    {item.trackName}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {item.trackArtist}
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
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedSongForSubmission || submissionComplete) && styles.disabledButton
            ]}
            onPress={handleSubmitSong}
            disabled={!selectedSongForSubmission || submissionComplete}
          >
            <LinearGradient
              colors={
                submissionComplete 
                  ? ['#666666', '#444444'] 
                  : (selectedSongForSubmission ? ['#00FFAA', '#00AAFF'] : ['#666666', '#444444'])
              }
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>
                {submissionComplete ? 'Submitted' : 'Submit'}
              </Text>
              {submissionComplete ? (
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
      
      {isManualProgression && (
        <TouchableOpacity
          style={styles.progressButton}
          onPress={handleManualProgress}
        >
          <LinearGradient
            colors={['#00FFAA', '#00AAFF']}
            style={styles.progressButtonGradient}
          >
            <Text style={styles.progressButtonText}>Skip to Next Phase</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // PLAYBACK PHASE
  const renderPlaybackPhase = () => (
    <Animated.View 
      style={[
        styles.playbackContainer,
        { transform: [{ translateX: slideAnim }] }
      ]}
    >
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
              // Find song details from player who submitted it
              const submission = submissions[currentPlayingIndex];
              // Get player who submitted this song
              const player = players?.find(p => p.spotifyId === submission?.playerId);
              
              if (player && player.username) {
                return (
                  <Text style={styles.playerNameText}>
                    Submitted by: {player.username}
                    {player.spotifyId === spotifyId ? " (You)" : ""}
                  </Text>
                );
              }
              return null;
            })()}
          </View>
          
          {!isManualProgression && (
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
          )}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color="#FF5555" />
          <Text style={styles.noSongsText}>No submissions to play</Text>
        </View>
      )}
      
      <Text style={styles.playbackInstructions}>
        Get ready to vote for your favorite song in this category!
      </Text>
      
      {isManualProgression && (
        <TouchableOpacity
          style={styles.progressButton}
          onPress={handleManualProgress}
        >
          <LinearGradient
            colors={['#00FFAA', '#00AAFF']}
            style={styles.progressButtonGradient}
          >
            <Text style={styles.progressButtonText}>
              {currentPlayingIndex < submissions.length - 1 ? 'Next Song' : 'Skip to Voting'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // VOTING PHASE
  const renderVotingPhase = () => (
    <Animated.View 
      style={[
        styles.votingContainer,
        { transform: [{ translateX: slideAnim }] }
      ]}
    >
      <View style={styles.phaseHeader}>
        <View style={styles.roundIndicator}>
          <Text style={styles.roundIndicatorText}>Round {round}</Text>
        </View>
        {!isManualProgression && (
          <View style={styles.timerContainer}>
            <Ionicons name="timer-outline" size={20} color="#FFAA00" />
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.categoryText}>"{category}"</Text>
      
      {voteSubmitted ? (
        <View style={styles.voteSubmittedContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#00FF00" />
          <Text style={styles.voteSubmittedText}>Vote Submitted!</Text>
          <Text style={styles.waitingForOthersText}>
            Waiting for other players to vote...
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.instructionText}>
            Vote for your favorite song (you cannot vote for your own):
          </Text>
          
          <FlatList
            data={submissions}
            keyExtractor={(item, index) => `${item.playerId}-${index}`}
            renderItem={({ item, index }) => {
              const isOwnSubmission = item.playerId === spotifyId;
              // Get player who submitted this song
              const player = players.find(p => p.spotifyId === item.playerId);
              
              return (
                <TouchableOpacity
                  style={[
                    styles.votingItem,
                    selectedVote === item.playerId && styles.selectedVoteItem,
                    isOwnSubmission && styles.ownSubmissionItem
                  ]}
                  onPress={() => !isOwnSubmission && setSelectedVote(item.playerId)}
                  disabled={isOwnSubmission}
                >
                  <View style={styles.votingItemContent}>
                    <View style={styles.votingItemNumber}>
                      <Text style={styles.votingItemNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.votingItemInfo}>
                      <Text style={styles.votingItemTitle}>Song {index + 1}</Text>
                      <Text style={styles.votingItemSubmitter}>
                        by {player?.username || 'Unknown'}
                        {isOwnSubmission ? " (Your submission)" : ""}
                      </Text>
                    </View>
                  </View>
                  {!isOwnSubmission && (
                    <View style={styles.selectionIndicator}>
                      {selectedVote === item.playerId ? (
                        <Ionicons name="checkmark-circle" size={28} color="#00FFFF" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={28} color="#FFFFFF" />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.votingList}
          />
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              !selectedVote && styles.disabledButton
            ]}
            onPress={handleSubmitVote}
            disabled={!selectedVote}
          >
            <LinearGradient
              colors={selectedVote ? ['#00FFAA', '#00AAFF'] : ['#666666', '#444444']}
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>Submit Vote</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
      
      {isManualProgression && (
        <TouchableOpacity
          style={styles.progressButton}
          onPress={handleManualProgress}
        >
          <LinearGradient
            colors={['#00FFAA', '#00AAFF']}
            style={styles.progressButtonGradient}
          >
            <Text style={styles.progressButtonText}>Skip to Results</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // RESULTS PHASE
  const renderResultsPhase = () => (
    <Animated.View 
      style={[
        styles.resultsContainer,
        { transform: [{ translateX: slideAnim }] }
      ]}
    >
      <Text style={styles.resultsTitle}>Round {round} Results</Text>
      <Text style={styles.resultsSubtitle}>"{category}"</Text>
      
      {roundResults && roundResults.submissions && (
        <FlatList
          data={roundResults.submissions.sort((a, b) => (b.votes ? b.votes.length : 0) - (a.votes ? a.votes.length : 0))}
          keyExtractor={(item) => item.playerId}
          renderItem={({ item, index }) => {
            const isWinner = index === 0;
            const isOwnSubmission = item.playerId === spotifyId;
            const player = players.find(p => p.spotifyId === item.playerId);
            
            return (
              <View style={[
                styles.resultItem,
                isWinner && styles.winnerResultItem,
                isOwnSubmission && styles.ownResultItem
              ]}>
                <View style={styles.resultRankContainer}>
                  <Text style={[
                    styles.resultRankText,
                    isWinner && styles.winnerRankText
                  ]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultPlayerName}>
                    {player?.username || 'Unknown'}
                    {isOwnSubmission ? " (You)" : ""}
                  </Text>
                  <Text style={styles.resultPoints}>
                    {item.votes?.length || 0} {(item.votes?.length || 0) === 1 ? 'vote' : 'votes'} • 
                    +{isWinner ? 3 : (index === 1 ? 2 : ((item.votes?.length || 0) > 0 ? 1 : 0))} points
                  </Text>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={() => (
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsHeaderText}>Final Rankings</Text>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={styles.leaderboardContainer}>
              <Text style={styles.leaderboardTitle}>Current Standings</Text>
              {leaderboard && leaderboard.length > 0 && (
                <FlatList
                  data={leaderboard.slice(0, 3)}
                  keyExtractor={(item) => item.spotifyId}
                  renderItem={({ item, index }) => (
                    <View style={styles.leaderboardItem}>
                      <Text style={[
                        styles.leaderboardRank,
                        index === 0 ? styles.goldText : (index === 1 ? styles.silverText : styles.bronzeText)
                      ]}>
                        {index + 1}.
                      </Text>
                      <Text style={styles.leaderboardName}>
                        {item.username}
                        {item.spotifyId === spotifyId && " (You)"}
                      </Text>
                      <Text style={styles.leaderboardPoints}>{item.points} pts</Text>
                    </View>
                  )}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}
          contentContainerStyle={styles.resultsList}
        />
      )}
      
      {isManualProgression && (
        <TouchableOpacity
          style={styles.progressButton}
          onPress={handleManualProgress}
        >
          <LinearGradient
            colors={['#00FFAA', '#00AAFF']}
            style={styles.progressButtonGradient}
          >
            <Text style={styles.progressButtonText}>
              {round < totalRounds ? 'Next Round' : 'End Game'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // COMPLETED PHASE
  const renderCompletedPhase = () => (
    <Animated.View 
      style={[
        styles.completedContainer,
        { transform: [{ translateX: slideAnim }] }
      ]}
    >
      <Text style={styles.completedTitle}>Game Over!</Text>
      <Text style={styles.completedSubtitle}>Final Standings</Text>
      
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.spotifyId}
        renderItem={({ item, index }) => (
          <View style={[
            styles.finalRankingItem,
            index === 0 && styles.winnerItem,
            item.spotifyId === spotifyId && styles.currentPlayerItem
          ]}>
            <View style={[
              styles.finalRankContainer,
              index === 0 ? styles.goldRank : (index === 1 ? styles.silverRank : (index === 2 ? styles.bronzeRank : {}))
            ]}>
              <Text style={styles.finalRankText}>{index + 1}</Text>
            </View>
            <View style={styles.finalPlayerInfo}>
              <Text style={styles.finalPlayerName}>
                {item.username}
                {item.spotifyId === spotifyId && " (You)"}
              </Text>
            </View>
            <View style={styles.finalPointsContainer}>
              <Text style={styles.finalPointsText}>{item.points}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.finalRankingsList}
      />
      
      <TouchableOpacity
        style={styles.returnButton}
        onPress={handleReturnToLobby}
      >
        <LinearGradient
          colors={['#00FFAA', '#00AAFF']}
          style={styles.returnButtonGradient}
        >
          <Text style={styles.returnButtonText}>Return to Lobby</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <LinearGradient colors={['#1A2151', '#323B71']} style={styles.container}>
      {/* Game header */}
      <View style={styles.header}>
        <Text style={styles.gameTitle}>Song Wars</Text>
        <View style={styles.roundInfo}>
          <Text style={styles.roundText}>Round {round}/{totalRounds}</Text>
        </View>
        <View style={styles.phaseInfo}>
          <Text style={styles.phaseText}>{currentPhase.toUpperCase()}</Text>
          {!isManualProgression && timeLeft > 0 && (
            <Text style={styles.phaseTimerText}>{timeLeft}s</Text>
          )}
        </View>
        
        {/* Test mode control */}
        <View style={styles.testModeContainer}>
          <Text style={styles.testModeLabel}>Manual Mode</Text>
          <Switch
            value={isManualProgression}
            onValueChange={handleToggleManualProgression}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isManualProgression ? '#0058AA' : '#f4f3f4'}
          />
        </View>
      </View>
      
      {/* Main content area */}
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
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#00FFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  roundInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  roundText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phaseInfo: {
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
  testModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  testModeLabel: {
    fontSize: 12,
    color: '#CCDDFF',
    marginRight: 8,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
  },
  
  // Category phase
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
    textAlign: 'center',
  },
  categoryText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#00FFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  categoryIconContainer: {
    marginVertical: 30,
  },
  categoryInstructions: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 20,
  },
  progressButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 30,
  },
  progressButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  progressButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  
  // Submission phase
  submissionContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roundIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roundIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFAA00',
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginVertical: 12,
  },
  noSongsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noSongsText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 12,
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
  disabledSongItem: {
    opacity: 0.6,
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
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  
  // Playback phase
  playbackContainer: {
    flex: 1,
    paddingVertical: 20,
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
  nowPlayingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00FFFF',
  },
  spotifyPlayerContainer: {
    width: '100%',
    height: 80,
    marginBottom: 12,
  },
  webView: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  songDetailsContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  playerNameText: {
    fontSize: 14,
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
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  playbackInstructions: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 20,
  },
  noTokenText: {
    fontSize: 16,
    color: '#FF5555',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Voting phase
  votingContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  votingList: {
    paddingBottom: 16,
  },
  votingItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  votingItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  votingItemNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  votingItemNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  votingItemInfo: {
    flex: 1,
  },
  votingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  votingItemSubmitter: {
    fontSize: 14,
    color: '#CCDDFF',
    opacity: 0.8,
    marginTop: 2,
  },
  selectedVoteItem: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00FFFF',
  },
  ownSubmissionItem: {
    backgroundColor: 'rgba(255, 85, 153, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#FF5599',
  },
  voteSubmittedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  voteSubmittedText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00FF00',
    marginTop: 16,
    marginBottom: 8,
  },
  waitingForOthersText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
  },
  
  // Results phase
  resultsContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: 16,
    color: '#CCDDFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  resultsHeader: {
    paddingVertical: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultsHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultsList: {
    paddingBottom: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  winnerResultItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  ownResultItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#00FFFF',
  },
  resultRankContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultRankText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  winnerRankText: {
    color: '#FFD700',
  },
  resultInfo: {
    flex: 1,
  },
  resultPlayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  resultPoints: {
    fontSize: 14,
    color: '#00FFAA',
  },
  leaderboardContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  leaderboardRank: {
    width: 24,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goldText: {
    color: '#FFD700',
  },
  silverText: {
    color: '#C0C0C0',
  },
  bronzeText: {
    color: '#CD7F32',
  },
  leaderboardName: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  leaderboardPoints: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00FFAA',
  },
  
  // Completed phase
  completedContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  completedTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00FFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  completedSubtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  finalRankingsList: {
    paddingBottom: 16,
  },
  finalRankingItem: {
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
    borderLeftWidth: 3,
    borderLeftColor: '#00FFFF',
  },
  finalRankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goldRank: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  silverRank: {
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    borderWidth: 1,
    borderColor: '#C0C0C0',
  },
  bronzeRank: {
    backgroundColor: 'rgba(205, 127, 50, 0.2)',
    borderWidth: 1,
    borderColor: '#CD7F32',
  },
  finalRankText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  finalPlayerInfo: {
    flex: 1,
  },
  finalPlayerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  finalPointsContainer: {
    backgroundColor: 'rgba(0, 255, 170, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  finalPointsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00FFAA',
  },
  returnButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  returnButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  returnButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});