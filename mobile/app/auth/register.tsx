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
  makeRegisterSchema,
  type RegisterFormValues,
} from '../../src/schemas/authSchema';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function RegisterScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { register: registerAccount } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resolver = useMemo(() => zodResolver(makeRegisterSchema(t)), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver,
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      displayName: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitError(null);
    try {
      // Only public account fields are sent. No role may be chosen in the UI.
      await registerAccount({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
      router.replace('/(tabs)/home' as never);
    } catch (error) {
      setSubmitError(translateApiError(t, error));
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('auth.createTitle')} subtitle={t('auth.createSubtitle')} />

      <Card>
        <Text style={styles.muted}>{t('auth.staffNotice')}</Text>
        <Text style={styles.muted}>{t('auth.publicNotice')}</Text>
      </Card>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label={t('auth.displayName')}
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="words"
            maxLength={80}
            error={errors.displayName?.message}
          />
        )}
      />
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
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <TextField
            label={t('auth.confirmPassword')}
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            error={errors.confirmPassword?.message}
          />
        )}
      />

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button
        label={t('auth.createAccount')}
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
      <Button
        label={t('auth.haveAccount')}
        variant="secondary"
        onPress={() => router.push('/auth/sign-in' as never)}
      />
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  muted: { ...theme.typography.caption, color: theme.colors.muted },
  error: { ...theme.typography.caption, color: '#a3203d', marginBottom: theme.spacing.sm },
});
