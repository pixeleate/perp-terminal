import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { Text, View, type DimensionValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { AnimatedView } from '@/components/Styled';
import { formatPercent } from '@/lib/format';
import { colors } from '@/lib/theme';

export function Card({
  children,
  className,
  style,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View
      className={`rounded-lg border border-line bg-surface ${padded ? 'p-4' : ''} ${className ?? ''}`}
      style={style}
    >
      {children}
    </View>
  );
}

/** The large in-screen title ("Markets") the design uses instead of a nav bar. */
export function ScreenTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="min-h-[45px] flex-row items-center justify-between">
      <Text
        className="font-semibold text-title tracking-[-0.9px] text-fg"
        accessibilityRole="header"
      >
        {children}
      </Text>
      {right}
    </View>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View className="mb-2 mt-6 flex-row items-baseline justify-between">
      <Text className="font-semibold text-base tracking-[-0.15px] text-fg">{children}</Text>
      {hint ? <Text className="font-regular text-xs text-fg-muted">{hint}</Text> : null}
    </View>
  );
}

const TONE = {
  neutral: colors.textSecondary,
  up: colors.up,
  down: colors.down,
  accent: colors.accent,
  warn: colors.warn,
} as const;

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: keyof typeof TONE }) {
  const toneColor = TONE[tone];
  return (
    <View className="self-start rounded-xs px-2 py-[3px]" style={{ backgroundColor: `${toneColor}1F` }}>
      <Text className="font-medium text-caption tracking-[0.22px]" style={{ color: toneColor }}>
        {label}
      </Text>
    </View>
  );
}

/** Green/red 24h change chip used in market rows and the trade header. */
export function ChangeBadge({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const tint = value >= 0 ? colors.up : colors.down;
  // Typographic minus, as in the design.
  const label = formatPercent(value).replace('-', '−');
  return (
    <View
      className={
        size === 'md'
          ? 'h-6 justify-center self-start rounded-xs px-2'
          : 'h-5 justify-center self-end rounded-xs px-1.5'
      }
      style={{ backgroundColor: `${tint}1F` }}
    >
      <Text
        className={`font-medium ${size === 'md' ? 'text-sm tracking-[-0.13px]' : 'text-xs tracking-[-0.12px]'}`}
        style={{ color: tint, fontVariant: ['tabular-nums'] }}
      >
        {label}
      </Text>
    </View>
  );
}

export function KeyValue({
  label,
  value,
  valueStyle,
  accessibilityHint,
  divider = false,
}: {
  label: string;
  value: string;
  valueStyle?: StyleProp<TextStyle>;
  accessibilityHint?: string;
  /** Hairline above the row, as in the trade ticket's fee table. */
  divider?: boolean;
}) {
  return (
    <View
      className={`min-h-8 flex-row items-center justify-between gap-4 ${divider ? 'border-t border-[#FFFFFF0D]' : ''}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={accessibilityHint}
    >
      <Text className="font-regular text-sm text-fg-muted">{label}</Text>
      <Text
        className="shrink text-right font-medium text-sm text-fg"
        style={[{ fontVariant: ['tabular-nums'] }, valueStyle]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const BANNER_TONE = {
  neutral: colors.textSecondary,
  warn: colors.warn,
  accent: colors.accent,
} as const;

export function Banner({
  tone = 'neutral',
  title,
  body,
}: {
  tone?: keyof typeof BANNER_TONE;
  title: string;
  body: string;
}) {
  const toneColor = BANNER_TONE[tone];
  return (
    <View
      className="gap-1 rounded-md border p-3"
      style={{ borderColor: `${toneColor}33`, backgroundColor: `${toneColor}0D` }}
    >
      <Text className="font-semibold text-caption tracking-[0.44px]" style={{ color: toneColor }}>
        {title}
      </Text>
      <Text className="font-regular text-xs text-fg-secondary">{body}</Text>
    </View>
  );
}

const BUTTON = {
  neutral: { box: 'border-line bg-raised', text: 'text-fg-secondary' },
  accent: { box: 'border-[#FFFFFF29] bg-accent-muted', text: 'text-accent' },
  danger: { box: 'border-[#FB718566] bg-[#FB718514]', text: 'text-down' },
} as const;

/** Secondary action button for the Wallet and Settings cards. */
export function Button({
  variant = 'neutral',
  label,
  children,
  className,
  ...pressable
}: {
  variant?: keyof typeof BUTTON;
  /** Text label; pass `children` instead for custom content such as a spinner. */
  label?: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof PressableScale>, 'children' | 'className' | 'style'>) {
  const tone = BUTTON[variant];
  return (
    <PressableScale
      className={`items-center rounded-md border py-3 ${tone.box} ${className ?? ''}`}
      {...pressable}
    >
      {children ?? <Text className={`font-semibold text-sm ${tone.text}`}>{label}</Text>}
    </PressableScale>
  );
}

/** Centered two-line message for empty and error list states. */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View className="items-center gap-1 px-5 pt-16" accessible accessibilityRole="text">
      <Text className="text-center font-medium text-base text-fg">{title}</Text>
      {body ? <Text className="text-center font-regular text-sm text-fg-muted">{body}</Text> : null}
    </View>
  );
}

/**
 * Placeholder block for loading states. The pulse runs on the UI thread, and
 * every skeleton shares the same timing so a screen of them breathes together.
 */
export function Skeleton({
  width,
  height,
  radius = 4,
  className,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
  className?: string;
}) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <AnimatedView
      className={`bg-[#FFFFFF0D] ${className ?? ''}`}
      style={[{ width, height, borderRadius: radius }, pulse]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
