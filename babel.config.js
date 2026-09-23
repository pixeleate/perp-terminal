module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind: route JSX through its runtime so `className` becomes style.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin must be listed last. Reanimated 4 compiles
    // worklets through react-native-worklets rather than its own plugin.
    plugins: ['react-native-worklets/plugin'],
  };
};
