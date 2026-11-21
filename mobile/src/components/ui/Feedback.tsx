import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme, useStyles, type AppTheme } from '../../theme';
import { Button } from './Button';

export function LoadingState({ label }: { label: string }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.colors.brand} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.muted}>{body}</Text> : null}
    </View>
  );
}

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{message}</Text>
      {retryLabel && onRetry ? (
        <Button label={retryLabel} onPress={onRetry} variant="secondary" />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  centered: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: { ...theme.typography.subtitle, color: theme.colors.ink, textAlign: 'center' },
  muted: { ...theme.typography.body, color: theme.colors.muted, textAlign: 'center' },
});
