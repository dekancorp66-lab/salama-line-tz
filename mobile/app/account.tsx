import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Screen } from '../src/components/ui/Screen';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { ProtectedRoute } from '../src/auth/ProtectedRoute';
import { useAuth } from '../src/auth/AuthProvider';
import { isStaffRole, roleLabelKey } from '../src/auth/roles';
import { useStyles, type AppTheme } from '../src/theme';

export default function AccountScreen() {
  return (
    <ProtectedRoute>
      <AccountContent />
    </ProtectedRoute>
  );
}

function AccountContent() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles(makeStyles);

  const onSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      router.replace('/(tabs)/home' as never);
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('account.title')} subtitle={t('account.subtitle')} />

      <Card>
        <Text style={styles.label}>{t('account.email')}</Text>
        <Text style={styles.value}>{user?.email}</Text>
        <Text style={styles.label}>{t('account.role')}</Text>
        <Text style={styles.value}>{t(roleLabelKey(user?.role))}</Text>
        <Text style={styles.label}>{t('account.session')}</Text>
        <Text style={styles.value}>{t('account.sessionActive')}</Text>
      </Card>

      {isStaffRole(user?.role) ? (
        <Card>
          <Text style={styles.muted}>{t('auth.staffNotice')}</Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={t('account.signOut')}
        variant="secondary"
        loading={busy}
        onPress={() => void onSignOut()}
      />
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  label: { ...theme.typography.label, color: theme.colors.muted },
  value: { ...theme.typography.body, color: theme.colors.ink, marginBottom: theme.spacing.md },
  muted: { ...theme.typography.caption, color: theme.colors.muted },
  error: { ...theme.typography.caption, color: '#a3203d', marginBottom: theme.spacing.sm },
});
