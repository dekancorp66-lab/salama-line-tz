import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useStyles, type AppTheme } from '../theme';
import { useQuickExit } from '../hooks/useQuickExit';

/**
 * One-press exit. Available on every sensitive screen from a single header
 * component, so it never requires navigating through another menu.
 */
export function QuickExitButton() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { exit } = useQuickExit();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('quickExit.button')}
      accessibilityHint={t('quickExit.description')}
      onPress={exit}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{t('quickExit.button')}</Text>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  button: {
    minHeight: theme.touchTarget,
    minWidth: theme.touchTarget,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
    backgroundColor: theme.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: theme.colors.brandSoft },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.brandStrong,
  },
});
