import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} />
      <Button
        label={t('settings.language')}
        variant="secondary"
        onPress={() => router.push('/settings/language' as never)}
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
        label={t('settings.notifications')}
        variant="secondary"
        onPress={() => router.push('/notifications' as never)}
      />
      <Button
        label={t('settings.privacy')}
        variant="secondary"
        onPress={() => router.push('/privacy' as never)}
      />
    </Screen>
  );
}
