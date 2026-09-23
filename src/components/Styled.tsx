import { forwardRef } from 'react';
import { Text, View, type TextProps, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * Animated components that accept `className`.
 *
 * Registering Reanimated's own `Animated.View` with NativeWind doesn't work:
 * css-interop merges the class styles and the `style` prop into one object,
 * and when that prop holds a `useAnimatedStyle()` result Reanimated sees an
 * animated style and keeps only the animated values, dropping every class.
 *
 * So wrap the other way round. These inner components are written in app
 * JSX, which NativeWind transforms, so `className` resolves on the core
 * View/Text. Reanimated wraps them, strips its animated values out of `style`
 * and passes plain values down, and drives the animation on the native view.
 */
const StyledView = forwardRef<View, ViewProps>(function StyledView(props, ref) {
  return <View ref={ref} {...props} />;
});

const StyledText = forwardRef<Text, TextProps>(function StyledText(props, ref) {
  return <Text ref={ref} {...props} />;
});

export const AnimatedView = Animated.createAnimatedComponent(StyledView);
export const AnimatedText = Animated.createAnimatedComponent(StyledText);
