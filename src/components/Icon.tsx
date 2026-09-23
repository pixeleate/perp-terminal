import { Canvas, ImageSVG, useSVG } from '@shopify/react-native-skia';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Icons are the SVGs exported from the Figma file, rendered through Skia so
 * the app does not take on react-native-svg as a second native dependency.
 * Each entry carries the asset's own root size, which is what it renders at.
 */
const ICONS = {
  back: { source: require('../../assets/icons/back.svg'), size: 22 },
  chevronDown: { source: require('../../assets/icons/chevron-down.svg'), size: 14 },
  clear: { source: require('../../assets/icons/clear.svg'), size: 14 },
  filter: { source: require('../../assets/icons/filter.svg'), size: 16 },
  search: { source: require('../../assets/icons/search.svg'), size: 16 },
  star: { source: require('../../assets/icons/star.svg'), size: 17 },
  starFilled: { source: require('../../assets/icons/star-filled.svg'), size: 17 },
  stepper: { source: require('../../assets/icons/stepper.svg'), size: 12 },
  tabMarkets: { source: require('../../assets/icons/tab-markets.svg'), size: 21 },
  tabMarketsActive: { source: require('../../assets/icons/tab-markets-active.svg'), size: 21 },
  tabTrade: { source: require('../../assets/icons/tab-trade.svg'), size: 21 },
  tabTradeActive: { source: require('../../assets/icons/tab-trade-active.svg'), size: 21 },
  tabWallet: { source: require('../../assets/icons/tab-wallet.svg'), size: 21 },
  tabWalletActive: { source: require('../../assets/icons/tab-wallet-active.svg'), size: 21 },
  tabSettings: { source: require('../../assets/icons/tab-settings.svg'), size: 21 },
  tabSettingsActive: { source: require('../../assets/icons/tab-settings-active.svg'), size: 21 },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, style }: { name: IconName; style?: StyleProp<ViewStyle> }) {
  const { source, size } = ICONS[name];
  const svg = useSVG(source);

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      {svg ? (
        <Canvas style={{ width: size, height: size }}>
          <ImageSVG svg={svg} x={0} y={0} width={size} height={size} />
        </Canvas>
      ) : null}
    </View>
  );
}
