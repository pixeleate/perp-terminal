import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenTitle } from '@/components/ui';

import { EvmCard } from '@/features/wallet/EvmCard';
import { PrivyCard } from '@/features/wallet/PrivyCard';
import { SolanaCard } from '@/features/wallet/SolanaCard';
import { space } from '@/lib/theme';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="px-5 pb-16"
      contentContainerStyle={{ paddingTop: insets.top + space(2) }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenTitle>Wallet</ScreenTitle>
      <PrivyCard />
      <SolanaCard />
      <EvmCard />
    </ScrollView>
  );
}
