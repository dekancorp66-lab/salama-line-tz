import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import i18n, { DEFAULT_LANGUAGE, isLanguage } from '../i18n';
import { useLanguageStore } from '../store/languageStore';
import { useTheme, useStyles, type AppTheme } from '../theme';

/**
 * Applies the saved language before sensitive UI is rendered. The device
 * locale is deliberately never consulted.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const language = useLanguageStore((state) => state.language);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const apply = (value: unknown) => {
      if (!active) return;
      const next = isLanguage(value) ? value : DEFAULT_LANGUAGE;
      void i18n.changeLanguage(next);
      setReady(true);
    };

    const unsubscribe = useLanguageStore.persist.onFinishHydration((state) => {
      apply(state?.language);
    });

    if (useLanguageStore.persist.hasHydrated()) {
      apply(useLanguageStore.getState().language);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (ready) void i18n.changeLanguage(language);
  }, [language, ready]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.paper,
  },
});
