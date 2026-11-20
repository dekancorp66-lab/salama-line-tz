import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/ui/Screen';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { Card } from '../src/components/ui/Card';
import { useTheme, useStyles, type AppTheme } from '../src/theme';

export default function ReferralInfoScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('home.referrals')} subtitle={t('home.referralsBody')} />

      <Card>
        <Text style={styles.body}>{t('requests.referralBody')}</Text>
      </Card>
      <Card>
        <Text style={styles.body}>{t('safety.confidential')}</Text>
        <Text style={styles.body}>{t('safety.anonymous')}</Text>
      </Card>
      <Card>
        <Text style={styles.body}>{t('safety.emergency')}</Text>
      </Card>
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  body: { ...theme.typography.body, color: theme.colors.muted },
});
