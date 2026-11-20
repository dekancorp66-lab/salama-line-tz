import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme, useStyles, type AppTheme } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  fullWidth = false,
}: ButtonProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.onDark : theme.colors.brand} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  base: {
    minHeight: theme.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  fullWidth: { width: '100%' },
  primary: { backgroundColor: theme.colors.brandFill },
  secondary: {
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
  },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  label: { ...theme.typography.button },
  primaryLabel: { color: theme.colors.onDark },
  secondaryLabel: { color: theme.colors.brandStrong },
  ghostLabel: { color: theme.colors.brand },
});
