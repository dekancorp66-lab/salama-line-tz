import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { OnboardingShell } from '../../src/components/onboarding/OnboardingShell';
import { Button } from '../../src/components/ui/Button';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <OnboardingShell
      eyebrow={t('app.name')}
      title={t('onboarding.welcomeTitle')}
      body={t('onboarding.welcomeBody')}
      step={1}
      total={3}
    >
      <Button
        label={t('common.continue')}
        onPress={() => router.push('/onboarding/language')}
      />
    </OnboardingShell>
  );
}
