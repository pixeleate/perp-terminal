import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedView } from '@/components/Styled';

const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const;

/**
 * Press feedback that runs entirely on the UI thread.
 *
 * `Pressable` + `setState` would round-trip through the JS thread, which is the
 * thread that also parses websocket frames on the Markets screen. Under a burst
 * of ticks that shows up as a button that visibly lags the finger. A Reanimated
 * shared value driven by a Gesture Handler tap never touches JS during the
 * animation, so the press stays crisp no matter what the feed is doing.
 */
export function PressableScale({
  children,
  onPress,
  className,
  style,
  disabled = false,
  haptic = 'light',
  scaleTo = 0.96,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: 'none' | 'light' | 'medium' | 'success';
  scaleTo?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean; busy?: boolean };
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const fire = () => {
    if (disabled) return;
    if (haptic !== 'none' && Platform.OS !== 'web') {
      const style =
        haptic === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : haptic === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
      if (haptic === 'success') {
        void Haptics.notificationAsync(style as Haptics.NotificationFeedbackType);
      } else {
        void Haptics.impactAsync(style as Haptics.ImpactFeedbackStyle);
      }
    }
    onPress?.();
  };

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDuration(10_000)
    .onBegin(() => {
      scale.value = withSpring(scaleTo, PRESS_SPRING);
      opacity.value = withTiming(0.85, { duration: 80 });
    })
    .onFinalize((_event, success) => {
      scale.value = withSpring(1, PRESS_SPRING);
      opacity.value = withTiming(1, { duration: 120 });
      if (success) runOnJS(fire)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.45 : opacity.value,
  }));

  return (
    <GestureDetector gesture={tap}>
      <AnimatedView
        className={`justify-center ${className ?? ''}`}
        style={[style, animatedStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, ...accessibilityState }}
        testID={testID}
      >
        {children}
      </AnimatedView>
    </GestureDetector>
  );
}
