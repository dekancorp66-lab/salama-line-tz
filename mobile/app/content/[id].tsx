import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/Feedback';
import { listApprovedContent } from '../../src/api/endpoints';
import { translateApiError } from '../../src/api/errors';
import { useLanguageStore } from '../../src/store/languageStore';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function ContentDetailScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['content', language],
    queryFn: () => listApprovedContent(language),
  });

  const item = data?.find((entry) => entry.id === id);

  return (
    <Screen>
      <ScreenHeader title={item?.title ?? t('learn.title')} showQuickExit />
      {isLoading ? <LoadingState label={t('common.loading')} /> : null}
      {isError ? (
        <ErrorState
          message={translateApiError(t, error)}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : null}
      {!isLoading && !isError && !item ? <EmptyState title={t('learn.empty')} /> : null}
      {item ? (
        <>
          <Text style={styles.topic}>{item.topic}</Text>
          <Text style={styles.body}>{item.fullText}</Text>
          <Text style={styles.source}>
            {t('learn.source')}: {item.sourceName}
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  topic: {
    ...theme.typography.label,
    color: theme.colors.brand,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.md,
  },
  body: { ...theme.typography.body, color: theme.colors.ink, lineHeight: 26 },
  source: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.xl,
  },
});
