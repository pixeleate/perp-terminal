import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { TradeScreen } from '@/features/trade/TradeScreen';
import { selectionStore } from '@/features/trade/selectionStore';

/**
 * Deep-link entry (`perpterminal://market/BTC`). Renders the same trade screen
 * as the Trade tab and marks the coin as selected so the list agrees.
 */
export default function MarketDetailScreen() {
  const params = useLocalSearchParams<{ coin: string }>();
  const coin = (params.coin ?? '').toUpperCase();

  useEffect(() => {
    if (coin) selectionStore.select(coin);
  }, [coin]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TradeScreen
        coin={coin}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </>
  );
}
