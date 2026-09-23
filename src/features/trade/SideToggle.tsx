import { useEffect } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { AnimatedText, AnimatedView } from '@/components/Styled';
import { colors } from '@/lib/theme';

import type { OrderSide } from './ordersStore';

const SPRING = { damping: 20, stiffness: 260, mass: 0.7 } as const;
// Kept as a module constant: worklets can't synchronously call JS-thread
// functions, so nothing here may be computed through a helper.
const TRACK_INSET = 4;

const LABEL = 'font-semibold text-base tracking-[-0.15px]';

const THUMB_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.6,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

/**
 * Segmented buy/sell control. The thumb is one absolutely-positioned view whose
 * translateX and colour are both driven by a single shared value, so the slide
 * and the red↔green crossfade stay in lockstep without any JS-thread work.
 */
export function SideToggle({
  value,
  onChange,
}: {
  value: OrderSide;
  onChange: (side: OrderSide) => void;
}) {
  const progress = useSharedValue(value === 'buy' ? 0 : 1);
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(value === 'buy' ? 0 : 1, SPRING);
  }, [value, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    trackWidth.value = event.nativeEvent.layout.width;
  };

  const thumbStyle = useAnimatedStyle(() => {
    // trackWidth is 0 until onLayout fires; clamp so the thumb never goes negative.
    const half = Math.max(0, (trackWidth.value - TRACK_INSET * 2 - 2) / 2);
    return {
      width: half,
      transform: [{ translateX: progress.value * half }],
      backgroundColor: interpolateColor(progress.value, [0, 1], [colors.up, colors.down]),
    };
  });

  const buyLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.onTint, colors.textSecondary]),
  }));
  const sellLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, colors.onTint]),
  }));

  return (
    <View
      className="h-11 flex-row rounded-md border border-[#FFFFFF0F] bg-surface p-1"
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      {/* Offsets sit 1pt inside TRACK_INSET: absolute children start inside the border. */}
      <AnimatedView
        className="absolute bottom-[3px] left-[3px] top-[3px] rounded-[9px]"
        style={[THUMB_SHADOW, thumbStyle]}
        pointerEvents="none"
      />
      <PressableScale
        className="flex-1 items-center"
        scaleTo={0.97}
        onPress={() => onChange('buy')}
        accessibilityLabel="Buy"
        accessibilityHint="Sets the order side to buy, opening or adding to a long"
        accessibilityState={{ selected: value === 'buy' }}
        testID="side-buy"
      >
        <AnimatedText className={LABEL} style={buyLabelStyle}>
          Buy
        </AnimatedText>
      </PressableScale>
      <PressableScale
        className="flex-1 items-center"
        scaleTo={0.97}
        onPress={() => onChange('sell')}
        accessibilityLabel="Sell"
        accessibilityHint="Sets the order side to sell, opening or adding to a short"
        accessibilityState={{ selected: value === 'sell' }}
        testID="side-sell"
      >
        <AnimatedText className={LABEL} style={sellLabelStyle}>
          Sell
        </AnimatedText>
      </PressableScale>
    </View>
  );
}

export function SideBadge({ side }: { side: OrderSide }) {
  const tint = side === 'buy' ? colors.up : colors.down;
  return (
    <View className="rounded-xs px-1.5 py-0.5" style={{ backgroundColor: `${tint}1F` }}>
      <Text className="font-semibold text-caption" style={{ color: tint }}>
        {side === 'buy' ? 'Buy' : 'Sell'}
      </Text>
    </View>
  );
}
