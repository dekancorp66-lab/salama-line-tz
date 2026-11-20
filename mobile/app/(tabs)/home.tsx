import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();

  const cards = [
    {
      title: t('home.getHelp'),
      body: t('home.getHelpBody'),
      icon: 'chatbubble-ellipses-outline',
      href: '/(tabs)/support',
    },
    {
      title: t('home.ai'),
      body: t('home.aiBody'),
      icon: 'sparkles-outline',
      href: '/ai',
    },
    {
      title: t('home.learn'),
      body: t('home.learnBody'),
      icon: 'book-outline',
      href: '/(tabs)/learn',
    },
    {
      title: t('home.services'),
      body: t('home.servicesBody'),
      icon: 'business-outline',
      href: '/services',
    },
    {
      title: t('home.requests'),
      body: t('home.requestsBody'),
      icon: 'clipboard-outline',
      href: '/(tabs)/requests',
    },
    {
      title: t('home.referrals'),
      body: t('home.referralsBody'),
      icon: 'swap-horizontal-outline',
      href: '/referral-info',
    },
    {
      title: t('home.notifications'),
      body: t('settings.notificationsBody'),
      icon: 'notifications-outline',
      href: '/notifications',
    },
  ];

  return (
    <Screen>
      <ScreenHeader title={t('app.name')} subtitle={t('home.subtitle')} />

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('app.tagline')}</Text>
        <Text style={styles.safety}>{t('safety.emergency')}</Text>
      </View>

      <View style={styles.grid}>
        {cards.map((card) => (
          <Card
            key={card.href}
            accessibilityLabel={card.title}
            onPress={() => router.push(card.href as never)}
          >
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardBody}>{card.body}</Text>
          </Card>
        ))}
      </View>

      <Card onPress={() => router.push('/(tabs)/profile' as never)}>
        <Text style={styles.cardTitle}>{t('home.profile')}</Text>
      </Card>
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  hero: {
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
    borderRadius: theme.radius.panel,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  heroTitle: { ...theme.typography.subtitle, color: theme.colors.brandStrong },
  safety: { ...theme.typography.caption, color: theme.colors.muted },
  grid: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  cardTitle: { ...theme.typography.subtitle, color: theme.colors.ink },
  cardBody: { ...theme.typography.body, color: theme.colors.muted },
});
