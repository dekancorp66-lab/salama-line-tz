import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { Screen } from '../src/components/ui/Screen';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import {
  NOTIFICATION_CATEGORIES,
  useNotificationPreferencesStore,
} from '../src/store/notificationPreferencesStore';
import { useTheme, useStyles, type AppTheme } from '../src/theme';

/**
 * Notification preferences are neutral by design: no request, referral or
 * personal details are ever placed in a notification body or preview.
 * This build has no server push delivery; device permission is local only.
 */
export default function NotificationsScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);
  const {
    enabled,
    categories,
    deviceConsent,
    setEnabled,
    toggleCategory,
    setDeviceConsent,
  } = useNotificationPreferencesStore();

  const requestPermission = async () => {
    if (!deviceConsent) return;
    const result = await Notifications.requestPermissionsAsync();
    setPermission(result.status);
  };

  return (
    <Screen>
      <ScreenHeader title={t('notifications.title')} subtitle={t('notifications.intro')} />

      <Card>
        <Text style={styles.body}>{t('notifications.preferencesTitle')}</Text>
        <Text style={styles.muted}>{t('notifications.preferencesBody')}</Text>
      </Card>

      <Card>
        <Text style={styles.section}>{t('notifications.inAppSection')}</Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: enabled }}
          onPress={() => setEnabled(!enabled)}
          style={styles.checkboxRow}
        >
          <View style={[styles.checkbox, enabled && styles.checkboxActive]} />
          <Text style={styles.body}>{t('notifications.inAppSection')}</Text>
        </Pressable>
        <Text style={styles.muted}>{t('notifications.inAppUnavailable')}</Text>

        {NOTIFICATION_CATEGORIES.map((category) => (
          <Pressable
            key={category}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: categories[category] }}
            onPress={() => toggleCategory(category)}
            style={styles.checkboxRow}
          >
            <View
              style={[
                styles.checkbox,
                categories[category] && styles.checkboxActive,
              ]}
            />
            <Text style={styles.body}>{t(`notifications.categories.${category}`)}</Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>{t('notifications.deviceSection')}</Text>
        <Text style={styles.muted}>{t('notifications.consentBody')}</Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: deviceConsent }}
          onPress={() => setDeviceConsent(!deviceConsent)}
          style={styles.checkboxRow}
        >
          <View
            style={[styles.checkbox, deviceConsent && styles.checkboxActive]}
          />
          <Text style={styles.body}>{t('notifications.consentTitle')}</Text>
        </Pressable>
        <Button
          label={t('notifications.allow')}
          variant="secondary"
          disabled={!deviceConsent}
          onPress={() => void requestPermission()}
        />
        {permission ? (
          <Text style={styles.status}>
            {permission === 'granted'
              ? t('notifications.permissionGranted')
              : t('notifications.permissionDenied')}
          </Text>
        ) : null}
        <Text style={styles.muted}>{t('notifications.pushUnavailable')}</Text>
      </Card>

      <Card>
        <Text style={styles.body}>{t('notifications.sample')}</Text>
        <Text style={styles.muted}>{t('notifications.deepLinkHint')}</Text>
      </Card>
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  section: { ...theme.typography.label, color: theme.colors.ink },
  body: { ...theme.typography.body, color: theme.colors.ink },
  muted: { ...theme.typography.caption, color: theme.colors.muted },
  status: { ...theme.typography.caption, color: theme.colors.brandStrong },
  checkboxRow: {
    minHeight: theme.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.muted,
  },
  checkboxActive: {
    backgroundColor: theme.colors.brandFill,
    borderColor: theme.colors.brandFill,
  },
});
