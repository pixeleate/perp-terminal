/**
 * Runtime access to the design tokens, for the styles that can't be a
 * className: Reanimated worklets, Skia paint, colours picked from state
 * (buy vs sell), and props like `placeholderTextColor`. Static styling goes
 * through NativeWind classes, which read the same values via
 * `tailwind.config.js`.
 */
import tokens from './tokens';

export const colors = tokens.colors;
export const radius = tokens.radius;
export const fonts = tokens.fonts;

export const space = (n: number) => n * 4;
