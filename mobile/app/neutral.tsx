import { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/ui/Screen';
import { Button } from '../src/components/ui/Button';
import { useQuickExit } from '../src/hooks/useQuickExit';
import { useTheme, useStyles, type AppTheme } from '../src/theme';

/**
 * Neutral destination for Quick Exit. It contains no request details,
 * referrals, personal information or navigation history back to them.
 */
export default function NeutralScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { returnToApp } = useQuickExit();

  useEffect(() => {
    // Keep the user on the neutral screen when the Android hardware back
    // button is pressed. There is deliberately no sensitive screen to return to.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>S</Text>
        </View>
        <Text style={styles.title}>{t('quickExit.neutralTitle')}</Text>
        <Text style={styles.body}>{t('quickExit.neutralBody')}</Text>
      </View>

      <Button label={t('quickExit.return')} onPress={returnToApp} fullWidth />
      <Text style={styles.help}>{t('quickExit.returnHelp')}</Text>
      <Text style={styles.limitation}>{t('quickExit.limitation')}</Text>
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxl,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { ...theme.typography.display, color: theme.colors.brandStrong },
  title: { ...theme.typography.title, color: theme.colors.ink, textAlign: 'center' },
  body: { ...theme.typography.body, color: theme.colors.muted, textAlign: 'center' },
  help: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  limitation: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
});
