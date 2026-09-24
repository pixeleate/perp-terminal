import { router } from 'expo-router';

import { TradeScreen } from '@/features/trade/TradeScreen';
import { useSelectedCoin } from '@/features/trade/selectionStore';

/** The trade ticket for whichever market was last tapped on Markets. */
export default function TradeTab() {
  const coin = useSelectedCoin();
  return <TradeScreen coin={coin} onBack={() => router.navigate('/')} />;
}
