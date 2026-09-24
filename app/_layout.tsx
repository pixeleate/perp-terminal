import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { analytics } from '@/lib/analytics/analytics';
import { useScreenTracking } from '@/lib/analytics/useScreenTracking';
import { initSentry, wrapRoot } from '@/lib/observability/sentry';
import { AuthProvider } from '@/lib/privy/AuthProvider';
import { colors, fonts } from '@/lib/theme';

// Both are no-ops without their respective keys, and both must run before the
// first render so early errors and the first screen view are captured.
initSentry();
analytics.init();

function RootLayout() {
  useScreenTracking();
  // Bundled with the JS, so this resolves in a frame or two. On failure the
  // app still renders — text just falls back to the system font.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    analytics.capture('app_opened');
  }, []);

  if (!fontsLoaded && !fontError) {
    return <View className="flex-1 bg-bg" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.semibold },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="market/[coin]"
              options={{ presentation: 'card', title: '' }}
            />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
