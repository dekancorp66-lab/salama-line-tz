import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import { useTheme, useStyles, type AppTheme } from '../../theme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  maxLength?: number;
}

/** Small labelled input used by the auth forms; keeps errors visible inline. */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  autoCapitalize = 'none',
  keyboardType = 'default',
  maxLength,
}: TextFieldProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.muted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  label: { ...theme.typography.label, color: theme.colors.ink, marginBottom: theme.spacing.xs },
  input: {
    minHeight: theme.touchTarget,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
  inputError: { borderColor: '#a3203d' },
  error: { ...theme.typography.caption, color: '#a3203d', marginBottom: theme.spacing.sm },
});
