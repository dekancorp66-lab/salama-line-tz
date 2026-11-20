import { useEffect, useRef } from 'react';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { AppProviders } from '../src/providers/AppProviders';
import { PrivacyOverlay } from '../src/components/PrivacyOverlay';
import { buildNeutralResetAction, buildReturnResetAction } from '../src/navigation/quickExit';
import { useSafetyStore } from '../src/store/safetyStore';

// Expo Router walks Stack children with React.Children.toArray and expects each
// child to be a Stack.Screen. A JSX Fragment is reported as an unknown child
// whose type is Symbol(react.fragment), which crashes Hermes on string
// coercion. Keep screens in a plain keyed array instead of a Fragment.
const normalScreens = [
  <Stack.Screen key="index" name="index" />,
  <Stack.Screen key="onboarding" name="onboarding" />,
  <Stack.Screen key="auth" name="auth" />,
  <Stack.Screen key="account" name="account" />,
  <Stack.Screen key="ai" name="ai" />,
  <Stack.Screen key="tabs" name="(tabs)" />,
  <Stack.Screen key="settings" name="settings" />,
  <Stack.Screen key="services" name="services" />,
  <Stack.Screen key="content" name="content/[id]" />,
  <Stack.Screen key="referral-info" name="referral-info" />,
  <Stack.Screen key="notifications" name="notifications" />,
  <Stack.Screen key="privacy" name="privacy" />,
  <Stack.Screen key="neutral" name="neutral" />,
];

const neutralScreen = <Stack.Screen name="neutral" />;

export default function RootLayout() {
  const quickExitActive = useSafetyStore((state) => state.quickExitActive);
  const navigationRef = useNavigationContainerRef();
  const wasActive = useRef(false);

  useEffect(() => {
    if (!navigationRef.isReady()) return;

    if (quickExitActive) {
      wasActive.current = true;
      // Replace the whole stack: no sensitive screen remains in history.
      navigationRef.reset(buildNeutralResetAction() as never);
      return;
    }

    if (wasActive.current) {
      wasActive.current = false;
      // A fresh normal stack; the index route applies the onboarding redirect.
      navigationRef.reset(buildReturnResetAction() as never);
    }
  }, [quickExitActive, navigationRef]);

  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        {quickExitActive ? neutralScreen : normalScreens}
      </Stack>
      <PrivacyOverlay />
    </AppProviders>
  );
}
