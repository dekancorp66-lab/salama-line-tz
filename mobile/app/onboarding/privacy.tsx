import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { OnboardingShell } from '../../src/components/onboarding/OnboardingShell';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { StyleSheet, Text } from 'react-native';
import { useStyles, type AppTheme } from '../../src/theme';
import { useOnboardingStore } from '../../src/store/onboardingStore';

export default function OnboardingPrivacyScreen() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const complete = useOnboardingStore((state) => state.complete);

  const finish = () => {
    complete();
    router.replace('/(tabs)/home');
  };

  return (
    <OnboardingShell
      eyebrow={t('nav.privacy')}
      title={t('onboarding.privacyTitle')}
      body={t('onboarding.privacyBody')}
      step={3}
      total={3}
    >
      <Card>
        <Text style={styles.note}>{t('safety.minimize')}</Text>
        <Text style={styles.note}>{t('safety.emergency')}</Text>
      </Card>
      <Button label={t('onboarding.getStarted')} onPress={finish} />
    </OnboardingShell>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  note: { ...theme.typography.body, color: theme.colors.muted },
});
