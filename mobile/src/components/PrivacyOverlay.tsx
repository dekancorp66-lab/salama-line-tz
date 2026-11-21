import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useStyles, type AppTheme } from '../theme';
import { useAppState } from '../hooks/useAppState';

/**
 * Covers the app when it leaves the foreground so recent-app previews never
 * show sensitive content. Quick Exit is handled separately: it replaces the
 * navigation stack with the neutral screen, which must remain interactive so
 * the user can return. This is not a substitute for OS-level privacy.
 */
export function PrivacyOverlay() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const appState = useAppState();

  if (appState === 'active') return null;

  return (
    <View
      style={styles.overlay}
      importantForAccessibility="yes"
      accessibilityLabel={t('quickExit.neutralTitle')}
    >
      <View style={styles.mark}>
        <Text style={styles.markText}>S</Text>
      </View>
      <Text style={styles.title}>{t('app.name')}</Text>
      <Text style={styles.body}>{t('quickExit.neutralBody')}</Text>
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: theme.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { ...theme.typography.title, color: theme.colors.brandStrong },
  title: { ...theme.typography.title, color: theme.colors.ink },
  body: { ...theme.typography.body, color: theme.colors.muted, textAlign: 'center' },
});
