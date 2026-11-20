import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { TextField } from '../../src/components/ui/TextField';
import { useAuth } from '../../src/auth/AuthProvider';
import { translateApiError } from '../../src/api/errors';
import {
  makeLoginSchema,
  type LoginFormValues,
} from '../../src/schemas/authSchema';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function SignInScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resolver = useMemo(() => zodResolver(makeLoginSchema(t)), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver,
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      await signIn(values);
      router.replace('/(tabs)/home' as never);
    } catch (error) {
      // Never render server text directly; only a mapped, translated key.
      setSubmitError(translateApiError(t, error));
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')} />

      <Card>
        <Text style={styles.muted}>{t('auth.publicNotice')}</Text>
      </Card>

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label={t('auth.email')}
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="email-address"
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label={t('auth.password')}
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            error={errors.password?.message}
          />
        )}
      />

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button
        label={t('auth.signIn')}
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
      <Button
        label={t('auth.noAccount')}
        variant="secondary"
        onPress={() => router.push('/auth/register' as never)}
      />
      <Text style={styles.muted}>{t('auth.recoveryUnavailable')}</Text>
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  muted: { ...theme.typography.caption, color: theme.colors.muted },
  error: { ...theme.typography.caption, color: '#a3203d', marginBottom: theme.spacing.sm },
});
