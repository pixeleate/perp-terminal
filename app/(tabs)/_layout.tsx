import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/Icon';
import { colors, fonts } from '@/lib/theme';

function tabIcon(inactive: IconName, active: IconName) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={focused ? active : inactive} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // Every screen draws its own large title, as in the design.
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: 'rgba(7,8,10,0.9)',
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
        },
        tabBarItemStyle: { paddingTop: 8 },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.1, marginTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Markets',
          tabBarAccessibilityLabel: 'Markets',
          tabBarIcon: tabIcon('tabMarkets', 'tabMarketsActive'),
        }}
      />
      <Tabs.Screen
        name="trade"
        options={{
          title: 'Trade',
          tabBarAccessibilityLabel: 'Trade',
          tabBarIcon: tabIcon('tabTrade', 'tabTradeActive'),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarAccessibilityLabel: 'Wallet',
          tabBarIcon: tabIcon('tabWallet', 'tabWalletActive'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: tabIcon('tabSettings', 'tabSettingsActive'),
        }}
      />
    </Tabs>
  );
}
