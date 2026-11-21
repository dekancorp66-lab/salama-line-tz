import { type ComponentProps } from 'react';
import { type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();

  const icon = (name: IconName) =>
    ({ color, size }: { color: ColorValue; size: number }) => (
      <Ionicons name={name} size={size} color={(color as string) ?? theme.colors.muted} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brandFill,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.paper,
          borderTopColor: theme.colors.line,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t('nav.home'), tabBarIcon: icon('home-outline') }}
      />
      <Tabs.Screen
        name="learn"
        options={{ title: t('nav.learn'), tabBarIcon: icon('book-outline') }}
      />
      <Tabs.Screen
        name="support"
        options={{ title: t('nav.support'), tabBarIcon: icon('chatbubble-outline') }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: t('nav.requests'), tabBarIcon: icon('clipboard-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('nav.profile'), tabBarIcon: icon('person-outline') }}
      />
    </Tabs>
  );
}
