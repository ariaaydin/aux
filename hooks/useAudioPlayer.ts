// hooks/useAudioPlayer.ts
import { useState, useEffect } from 'react';
// import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';
import { setupPlayer } from '../services/trackPlayerService';

export interface TrackInfo {
  id: string;
  name: string;
  artists: string;
  albumArt?: string;
}

export const useAudioPlayer = () => {
  return {
    isPlayerReady: false,
    isPlaying: false,
    currentTrack: null,
    playTrack: async () => console.log('Play disabled'),
    togglePlayback: async () => console.log('Toggle disabled'),
    stopPlayback: async () => console.log('Stop disabled'),
  };
};
