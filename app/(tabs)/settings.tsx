import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button, Card, KeyValue, Pill, ScreenTitle, SectionTitle } from '@/components/ui';
import { ordersStore } from '@/features/trade/ordersStore';
import { analytics, useAnalyticsLog } from '@/lib/analytics/analytics';
import { featureStatuses } from '@/lib/env';
import { captureException, captureMessage, isSentryEnabled } from '@/lib/observability/sentry';
import { isPrivyAvailable } from '@/lib/privy/sdk';
import { colors, space } from '@/lib/theme';

const LABEL = 'font-semibold text-sm text-fg';
const DETAIL = 'font-regular text-caption text-fg-faint';

class SpikeTestError extends Error {
  constructor() {
    super('PerpTerminal — deliberate test error from Settings');
    this.name = 'SpikeTestError';
  }
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [debug, setDebug] = useState(analytics.debugEnabled);
  const [lastAction, setLastAction] = useState<string>();
  const log = useAnalyticsLog();
  const statuses = featureStatuses();

  const toggleDebug = (next: boolean) => {
    setDebug(next);
    analytics.setDebug(next);
  };

  const throwHandled = () => {
    try {
      throw new SpikeTestError();
    } catch (error) {
      captureException(error, { source: 'settings.test_button' });
      setLastAction(
        isSentryEnabled()
          ? 'Exception sent to Sentry.'
          : 'No DSN configured — logged to console instead.',
      );
    }
  };

  const sendMessage = () => {
    captureMessage('PerpTerminal — test message from Settings', { source: 'settings' });
    setLastAction(
      isSentryEnabled() ? 'Message sent to Sentry.' : 'No DSN configured — logged to console.',
    );
  };

  const crash = () => {
    // Unhandled on purpose: this is the path that proves the global handler is
    // wired, not just manual capture calls.
    setTimeout(() => {
      throw new SpikeTestError();
    }, 0);
    setLastAction('Unhandled error thrown — check the red screen / Sentry issues.');
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="px-5 pb-16"
      contentContainerStyle={{ paddingTop: insets.top + space(2) }}
    >
      <ScreenTitle>Settings</ScreenTitle>
      <SectionTitle hint="what is actually wired up">Environment</SectionTitle>
      <Card>
        {statuses.map((status, index) => (
          <View
            key={status.id}
            className={`gap-1 py-2.5 ${index > 0 ? 'border-t border-[#FFFFFF0D]' : ''}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className={LABEL}>{status.label}</Text>
              <Pill
                label={status.configured ? 'Configured' : 'Stub'}
                tone={status.configured ? 'up' : 'warn'}
              />
            </View>
            <Text className={DETAIL} numberOfLines={2}>
              {status.detail}
            </Text>
          </View>
        ))}
      </Card>

      <SectionTitle hint={isSentryEnabled() ? 'live' : 'no DSN — no-op'}>Sentry</SectionTitle>
      <Card>
        <View className="mb-2 flex-row gap-2">
          <Button
            variant="accent"
            label="Handled error"
            className="mt-2 flex-1"
            onPress={throwHandled}
            accessibilityLabel="Send a handled test exception to Sentry"
            testID="sentry-handled"
          />
          <Button
            label="Test message"
            className="mt-2 flex-1"
            onPress={sendMessage}
            accessibilityLabel="Send a test message to Sentry"
          />
        </View>
        <Button
          variant="danger"
          label="Throw unhandled error"
          onPress={crash}
          accessibilityLabel="Throw an unhandled error"
          accessibilityHint="Triggers the global error handler. In development this shows a red screen."
          testID="sentry-crash"
        />
        {lastAction ? <Text className="mt-3 font-regular text-xs text-fg-secondary">{lastAction}</Text> : null}
      </Card>

      <SectionTitle hint={analytics.enabled ? 'live' : 'no key — local only'}>PostHog</SectionTitle>
      <Card>
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className={LABEL}>Debug logging</Text>
            <Text className={DETAIL}>Echo every captured event to the console.</Text>
          </View>
          <Switch
            value={debug}
            onValueChange={toggleDebug}
            trackColor={{ true: colors.up, false: colors.surfaceRaised }}
            accessibilityLabel="PostHog debug logging"
          />
        </View>

        <Text className="mb-2 mt-4 font-semibold text-caption tracking-[0.4px] text-fg-muted">Recent events ({log.length})</Text>
        {log.length === 0 ? (
          <Text className={DETAIL}>Nothing captured yet — go place a simulated order.</Text>
        ) : (
          log.slice(0, 8).map((event) => (
            <View key={event.id} className="flex-row justify-between gap-3 py-[3px]">
              <Text className="shrink font-mono text-xs text-fg" numberOfLines={1}>
                {event.name}
              </Text>
              <Text className="font-regular text-2xs text-fg-faint">{event.delivered ? 'sent' : 'local'}</Text>
            </View>
          ))
        )}
      </Card>

      <SectionTitle>Build</SectionTitle>
      <Card>
        <KeyValue label="Platform" value={`${Platform.OS} ${Platform.Version}`} />
        <KeyValue divider label="Expo SDK" value={Constants.expoConfig?.sdkVersion ?? 'unknown'} />
        <KeyValue divider label="App version" value={Constants.expoConfig?.version ?? '—'} />
        <KeyValue
          divider
          label="Runtime"
          value={Constants.appOwnership === 'expo' ? 'Expo Go' : 'dev client / standalone'}
        />
        <KeyValue divider label="Privy native modules" value={isPrivyAvailable ? 'available' : 'unavailable'} />
      </Card>

      <View className="mt-5">
        <Banner
          tone="accent"
          title="SPIKE, NOT A PRODUCT"
          body="No real money, no mainnet trading, no App Store readiness claimed. Market data is real; orders, fills and the Solana keypair are local."
        />
      </View>

      <Button
        label="Clear simulated orders"
        className="mt-2"
        onPress={() => {
          ordersStore.clear();
          setLastAction('Simulated orders cleared.');
        }}
        accessibilityLabel="Clear simulated orders"
      />
    </ScrollView>
  );
}
