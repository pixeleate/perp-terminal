import * as Haptics from 'expo-haptics';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { AnimatedView } from '@/components/Styled';

const HOLD_MS = 550;

/**
 * Hold-to-confirm instead of a plain tap.
 *
 * On a trading surface a mis-tap is expensive, and a confirmation dialog kills
 * the flow. Holding gives the user an undo window they can feel, and the fill
 * bar is a continuous signal of how much longer to hold — the kind of thing
 * that only reads well when the animation is frame-accurate, which is why the
 * progress value lives on the UI thread rather than in React state.
 */
export function HoldToConfirm({
  label,
  tint,
  disabled = false,
  onConfirm,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: {
  label: string;
  tint: string;
  disabled?: boolean;
  onConfirm: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}) {
  const progress = useSharedValue(0);

  const confirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const hold = Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(HOLD_MS)
    .maxDistance(24)
    .onBegin(() => {
      progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
    })
    .onStart(() => {
      runOnJS(confirm)();
    })
    .onFinalize(() => {
      progress.value = withTiming(0, { duration: 180 });
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <GestureDetector gesture={hold}>
      <View
        // Enabled: filled with the side colour plus the design's top highlight.
        className={`h-14 items-center justify-center overflow-hidden rounded-lg ${
          disabled ? 'border border-[#FFFFFF0F] bg-raised' : 'border-t border-t-[rgba(255,255,255,0.3)]'
        }`}
        style={disabled ? undefined : { backgroundColor: tint }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint ?? 'Press and hold for half a second to confirm'}
        accessibilityState={{ disabled }}
        testID={testID}
      >
        {/* Holding brightens the button left to right. */}
        <AnimatedView
          className="absolute bottom-0 left-0 top-0 bg-[rgba(255,255,255,0.28)]"
          style={fillStyle}
          pointerEvents="none"
        />
        <Text
          className={`px-3 font-semibold text-lg tracking-[-0.255px] ${disabled ? 'text-fg-muted' : 'text-on-tint'}`}
        >
          {label}
        </Text>
      </View>
    </GestureDetector>
  );
}
