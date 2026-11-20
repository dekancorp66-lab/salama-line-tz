import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { LoadingState } from '../../src/components/ui/Feedback';
import { useAuth } from '../../src/auth/AuthProvider';
import { roleLabelKey } from '../../src/auth/roles';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { status, user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'unknown') {
    return (
      <Screen>
        <ScreenHeader title={t('profile.title')} />
        <LoadingState label={t('common.loading')} />
      </Screen>
    );
  }

  const authenticated = status === 'authenticated';

  const onSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <Card>
        <Text style={styles.title}>
          {authenticated ? user?.displayName ?? user?.email ?? t('account.sessionActive') : t('profile.guest')}
        </Text>
        <Text style={styles.muted}>
          {authenticated ? t(roleLabelKey(user?.role)) : t('auth.publicNotice')}
        </Text>
      </Card>

      {authenticated ? (
        <>
          <Button
            label={t('account.title')}
            onPress={() => router.push('/account' as never)}
          />
          <Button
            label={t('account.signOut')}
            variant="secondary"
            loading={busy}
            onPress={() => void onSignOut()}
          />
        </>
      ) : (
        <>
          <Button
            label={t('auth.signIn')}
            onPress={() => router.push('/auth/sign-in' as never)}
          />
          <Button
            label={t('auth.createAccount')}
            variant="secondary"
            onPress={() => router.push('/auth/register' as never)}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={t('profile.settings')}
        variant="secondary"
        onPress={() => router.push('/settings' as never)}
      />
      <Button
        label={t('settings.theme')}
        variant="secondary"
        onPress={() => router.push('/settings/theme' as never)}
      />
      <Button
        label={t('settings.ai')}
        variant="secondary"
        onPress={() => router.push('/ai' as never)}
      />
      <Button
        label={t('nav.language')}
        variant="secondary"
        onPress={() => router.push('/settings/language' as never)}
      />
      <Button
        label={t('nav.notifications')}
        variant="secondary"
        onPress={() => router.push('/notifications' as never)}
      />
      <Button
        label={t('profile.privacy')}
        variant="secondary"
        onPress={() => router.push('/privacy' as never)}
      />
      <Button
        label={t('home.referrals')}
        variant="secondary"
        onPress={() => router.push('/referral-info' as never)}
      />
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  title: { ...theme.typography.subtitle, color: theme.colors.ink },
  muted: { ...theme.typography.body, color: theme.colors.muted },
  error: { ...theme.typography.caption, color: '#a3203d', marginBottom: theme.spacing.sm },
});
