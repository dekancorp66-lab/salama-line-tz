import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTheme, useStyles, type AppTheme } from '../src/theme';
import { useOnboardingStore } from '../src/store/onboardingStore';

export default function Index() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const completed = useOnboardingStore((state) => state.completed);
  const [hydrated, setHydrated] = useState(() =>
    useOnboardingStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useOnboardingStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsubscribe;
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return <Redirect href={completed ? '/(tabs)/home' : '/onboarding/welcome'} />;
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
