// app/(tabs)/_layout.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const BACKEND_SONG_ENDPOINT = 'http://localhost:3000/api/songOfTheDay';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // null = loading, false = not submitted, true = submitted
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkSOTD() {
      try {
        const token = await SecureStore.getItemAsync('spotify_token');
        if (!token) {
          // If there is no token, you might redirect to your auth flow.
          setHasSubmitted(false);
          return;
        }
        // Fetch Spotify user info.
        const resUser = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resUser.ok) {
          setHasSubmitted(false);
          return;
        }
        const userData = await resUser.json();
        const spotifyId = userData.id;
        // Fetch SOTD submission status from your backend.
        const resSOTD = await fetch(`${BACKEND_SONG_ENDPOINT}?spotifyId=${spotifyId}`);
        if (resSOTD.ok) {
          const data = await resSOTD.json();
          // Assume your backend returns a { post: ... } only if a song was submitted today.
          setHasSubmitted(!!data.post);
        } else {
          setHasSubmitted(false);
        }
      } catch (error) {
        console.error('Error checking SOTD submission status:', error);
        setHasSubmitted(false);
      }
    }
    checkSOTD();
  }, []);

  // While we’re checking, show a loading indicator.
  if (hasSubmitted === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Common tab screen options
  const screenOptions = {
    tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
    headerShown: false,
    tabBarButton: HapticTab,
    tabBarBackground: TabBarBackground,
    tabBarStyle: Platform.select({
      ios: { position: 'absolute' as 'absolute' },
      default: {},
      
    }),
  };

  // If no SOTD submitted for today, show only the SOTD submission tab.
  if (!hasSubmitted) {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="song-of-the-day" // This should match your SOTD submission route name.
          options={{
            title: 'SOTD',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="music.note.list" color={color} />
            ),
          }}
        />
      </Tabs>
    );
  }

  // Otherwise, show the Feed and Account tabs.
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="feed" // This should match your Feed route.
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account" // Make sure you have an Account route.
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
