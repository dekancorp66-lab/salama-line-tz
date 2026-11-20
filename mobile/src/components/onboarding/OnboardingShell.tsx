import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../AppHeader';
import { Screen } from '../ui/Screen';
import { useTheme, useStyles, type AppTheme } from '../../theme';

interface OnboardingShellProps {
  eyebrow: string;
  title: string;
  body: string;
  step: number;
  total: number;
  children?: ReactNode;
}

export function OnboardingShell({
  eyebrow,
  title,
  body,
  step,
  total,
  children,
}: OnboardingShellProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Screen>
      <AppHeader style={styles.header} />

      <View style={styles.top}>
        <View style={styles.mark}>
          <Text style={styles.markText}>S</Text>
        </View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <View style={styles.progress}>
        {Array.from({ length: total }).map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === step - 1 && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.actions}>{children}</View>
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  header: { marginBottom: theme.spacing.lg },
  top: { gap: theme.spacing.md, marginBottom: theme.spacing.xxl },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { ...theme.typography.display, color: theme.colors.brandStrong },
  eyebrow: { ...theme.typography.label, color: theme.colors.brand, letterSpacing: 1 },
  copy: { gap: theme.spacing.md, flex: 1 },
  title: { ...theme.typography.display, color: theme.colors.ink },
  body: { ...theme.typography.body, color: theme.colors.muted },
  progress: { flexDirection: 'row', gap: theme.spacing.sm, marginVertical: theme.spacing.xl },
  dot: {
    height: 6,
    flex: 1,
    borderRadius: 3,
    backgroundColor: theme.colors.line,
  },
  dotActive: { backgroundColor: theme.colors.brandFill },
  actions: { gap: theme.spacing.md },
});
