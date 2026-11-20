import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import {
  trackCase,
  type CaseTrackingResult,
  type PublicCaseStatus,
} from '../../src/api/endpoints';
import { translateApiError } from '../../src/api/errors';
import { isValidCaseCode, normalizeCaseCode } from '../../src/utils/caseCode';
import { useLanguageStore } from '../../src/store/languageStore';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

const STATUS_KEYS: Record<PublicCaseStatus, string> = {
  RECEIVED: 'requests.received',
  UNDER_REVIEW: 'requests.underReview',
  IN_PROGRESS: 'requests.inProgress',
  CLOSED: 'requests.closed',
};

export default function RequestsScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<CaseTrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.code && !code) {
      setCode(normalizeCaseCode(params.code));
    }
    // Only adopt the incoming code once; navigation must not reset the user's text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  const mutation = useMutation({
    mutationFn: (value: string) => trackCase(value),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (cause) => {
      setError(translateApiError(t, cause));
    },
  });

  const submit = () => {
    const normalized = normalizeCaseCode(code);
    if (!isValidCaseCode(normalized)) {
      setError(t('requests.invalid'));
      return;
    }
    mutation.mutate(normalized);
  };

  const refresh = async () => {
    const normalized = normalizeCaseCode(code);
    if (!isValidCaseCode(normalized)) return;
    try {
      setResult(await trackCase(normalized));
      setError(null);
    } catch (cause) {
      setError(translateApiError(t, cause));
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('requests.title')} subtitle={t('requests.intro')} />

      <Text style={styles.label}>{t('requests.reference')}</Text>
      <TextInput
        accessibilityLabel={t('requests.reference')}
        placeholder={t('requests.referencePlaceholder')}
        placeholderTextColor={theme.colors.muted}
        value={code}
        onChangeText={(value) => setCode(normalizeCaseCode(value))}
        autoCapitalize="characters"
        maxLength={24}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={t('requests.track')} loading={mutation.isPending} onPress={submit} />

      {result ? (
        <Card>
          <Text style={styles.caption}>{t('requests.status')}</Text>
          <Text style={styles.status}>{t(STATUS_KEYS[result.status])}</Text>
          <Text style={styles.muted}>{t('requests.submitted')}: {formatDate(result.submittedAt, language)}</Text>
          <Text style={styles.muted}>{t('requests.updated')}: {formatDate(result.lastUpdatedAt, language)}</Text>
          {result.needsMoreInformation ? (
            <Text style={styles.note}>{t('requests.needsInfo')}</Text>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <Button label={t('common.retry')} variant="secondary" onPress={() => void refresh()} />
      ) : null}

      <Card>
        <Text style={styles.subtitle}>{t('requests.referralInfo')}</Text>
        <Text style={styles.muted}>{t('requests.referralBody')}</Text>
      </Card>
    </Screen>
  );
}

function formatDate(value: string, language: 'en' | 'sw'): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-TZ');
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  label: { ...theme.typography.label, color: theme.colors.ink, marginBottom: theme.spacing.xs },
  input: {
    minHeight: theme.touchTarget,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.ink,
    marginBottom: theme.spacing.md,
  },
  error: { ...theme.typography.caption, color: '#a3203d', marginBottom: theme.spacing.sm },
  caption: { ...theme.typography.caption, color: theme.colors.muted },
  status: { ...theme.typography.title, color: theme.colors.brandStrong },
  muted: { ...theme.typography.body, color: theme.colors.muted },
  note: { ...theme.typography.body, color: theme.colors.ink },
  subtitle: { ...theme.typography.subtitle, color: theme.colors.ink },
});
