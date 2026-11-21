import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/Feedback';
import { listApprovedContent } from '../../src/api/endpoints';
import { translateApiError } from '../../src/api/errors';
import { useLanguageStore } from '../../src/store/languageStore';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function LearnScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['content', language],
    queryFn: () => listApprovedContent(language),
  });

  const topics = useMemo(() => {
    const unique = new Set((data ?? []).map((item) => item.topic));
    return [null, ...Array.from(unique)];
  }, [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((item) => {
      const matchesTopic = !topic || item.topic === topic;
      const matchesTerm =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.shortText.toLowerCase().includes(term);
      return matchesTopic && matchesTerm;
    });
  }, [data, search, topic]);

  return (
    <Screen>
      <ScreenHeader title={t('learn.title')} subtitle={t('learn.intro')} />

      <TextInput
        accessibilityLabel={t('learn.searchPlaceholder')}
        placeholder={t('learn.searchPlaceholder')}
        placeholderTextColor={theme.colors.muted}
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <View style={styles.chips}>
        {topics.map((item) => (
          <Pressable
            key={item ?? 'all'}
            accessibilityRole="button"
            onPress={() => setTopic(item)}
            style={[styles.chip, topic === item && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, topic === item && styles.chipLabelActive]}>
              {item ?? t('learn.all')}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? <LoadingState label={t('common.loading')} /> : null}
      {isError ? (
        <ErrorState
          message={translateApiError(t, error)}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : null}
      {!isLoading && !isError && visible.length === 0 ? (
        <EmptyState title={t('learn.empty')} />
      ) : null}

      {visible.map((item) => (
        <Card
          key={item.id}
          accessibilityLabel={item.title}
          onPress={() => router.push(`/content/${item.id}` as never)}
        >
          <Text style={styles.topic}>{item.topic}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.shortText}</Text>
          <Text style={styles.source}>
            {t('learn.source')}: {item.sourceName}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  search: {
    minHeight: theme.touchTarget,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.ink,
    marginBottom: theme.spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.paper,
  },
  chipActive: { backgroundColor: theme.colors.brandSoft, borderColor: theme.colors.brandLine },
  chipLabel: { ...theme.typography.caption, color: theme.colors.muted },
  chipLabelActive: { color: theme.colors.brandStrong },
  topic: { ...theme.typography.caption, color: theme.colors.brand, textTransform: 'uppercase' },
  title: { ...theme.typography.subtitle, color: theme.colors.ink },
  body: { ...theme.typography.body, color: theme.colors.muted },
  source: { ...theme.typography.caption, color: theme.colors.muted },
});
