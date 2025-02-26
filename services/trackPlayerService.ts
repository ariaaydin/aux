// services/trackPlayerService.ts
import TrackPlayer, { 
    Event, 
    RepeatMode, 
    State, 
    Capability,
    IOSCategory,
    IOSCategoryOptions
  } from 'react-native-track-player';
  
  // Define track type
  export interface Track {
    id: string;
    url: string;
    title: string;
    artist: string;
    artwork?: string;
  }
  
  // Configure the TrackPlayer
  export const setupPlayer = async (): Promise<boolean> => {
    try {
      await TrackPlayer.setupPlayer({
        // Options for iOS
        iosCategory: IOSCategory.Playback,
        iosCategoryOptions: [
          IOSCategoryOptions.AllowAirPlay,
          IOSCategoryOptions.AllowBluetooth,
          IOSCategoryOptions.AllowBluetoothA2DP
        ],
      });
      
      await TrackPlayer.updateOptions({
        // Remove stopWithApp as it's not in the UpdateOptions type
        capabilities: [
          Capability.Play,
          Capability.Pause,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause
        ],
        // Android specific options can be added here if needed
        // android: { ... }
      });
      
      return true;
    } catch (error) {
      console.error('Error setting up the player:', error);
      return false;
    }
  };
  
  // Event handler for playback states
  export const playbackService = async () => {
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  };