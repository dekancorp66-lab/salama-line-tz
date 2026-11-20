import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useStyles, type AppTheme } from '../../theme';
import { AppHeader } from '../AppHeader';
import { QuickExitButton } from '../QuickExitButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  showQuickExit?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  action,
  showQuickExit = true,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  // The centered app bar already shows the app name on Home, so avoid saying
  // it twice while keeping the screen subtitle and one-press Quick Exit.
  const repeatsAppName = title === t('app.name');

  return (
    <View style={styles.wrapper}>
      <AppHeader />
      <View style={styles.metaRow}>
        <View style={styles.headings}>
          {repeatsAppName ? null : <Text style={styles.title}>{title}</Text>}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showQuickExit ? <QuickExitButton /> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  wrapper: { marginBottom: theme.spacing.lg, gap: theme.spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
  headings: { flex: 1, gap: theme.spacing.xs },
  title: { ...theme.typography.title, color: theme.colors.ink },
  subtitle: { ...theme.typography.body, color: theme.colors.muted },
  action: { marginTop: theme.spacing.xs },
});
