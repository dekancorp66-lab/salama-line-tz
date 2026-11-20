import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen } from '../src/components/ui/Screen';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import {
  aiApi,
  type AiAnswer,
  type AiConversationTurn,
  type AiLanguage,
} from '../src/api/ai';
import { translateApiError } from '../src/api/errors';
import { useLanguageStore } from '../src/store/languageStore';
import { useTheme, useStyles, type AppTheme } from '../src/theme';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  answer?: AiAnswer;
}

interface AskVariables {
  question: string;
  context: AiConversationTurn[];
  language: AiLanguage;
}

const SUGGESTION_KEYS = [
  'ai.suggestions.childMarriage',
  'ai.suggestions.fgm',
  'ai.suggestions.services',
  'ai.suggestions.education',
] as const;

export default function AiScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const language = useLanguageStore((state) => state.language);
  const nextId = useRef(1);

  const [question, setQuestion] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const [context, setContext] = useState<AiConversationTurn[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const healthQuery = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => aiApi.health(),
    staleTime: 60_000,
    retry: 1,
  });

  const askMutation = useMutation({
    mutationFn: ({ question: text, context: turns, language: lang }: AskVariables) =>
      aiApi.ask({ question: text, context: turns, language: lang }),
    onSuccess: (answer, variables) => {
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: 'assistant', text: answer.answer, answer },
      ]);
      setContext([
        ...variables.context,
        { role: 'assistant', content: answer.answer },
      ]);
    },
  });

  const submit = () => {
    const trimmed = question.trim();
    if (trimmed.length < 3 || trimmed.length > 1200) {
      setValidation(t('ai.validation'));
      return;
    }

    setValidation(null);
    const userTurn: AiConversationTurn = { role: 'user', content: trimmed };
    const nextContext = [...context, userTurn];

    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'user', text: trimmed },
    ]);
    setQuestion('');
    askMutation.mutate({ question: trimmed, context: nextContext, language });
  };

  const clear = () => {
    setMessages([]);
    setContext([]);
    setQuestion('');
    setValidation(null);
    askMutation.reset();
  };

  const healthReady =
    healthQuery.data?.status === 'ok' && healthQuery.data.knowledgeBase?.loaded === true;

  return (
    <Screen>
      <ScreenHeader title={t('ai.title')} subtitle={t('ai.subtitle')} />

      <Card>
        <Text style={styles.cardTitle}>{t('ai.title')}</Text>
        {healthQuery.isLoading ? (
          <Text style={styles.meta}>{t('ai.healthChecking')}</Text>
        ) : null}
        {healthQuery.isError ? (
          <Text style={styles.error}>{t('ai.healthError')}</Text>
        ) : null}
        {healthQuery.data ? (
          <>
            <Text style={healthReady ? styles.statusReady : styles.statusUnavailable}>
              {healthReady ? t('ai.healthReady') : t('ai.healthUnavailable')}
            </Text>
            {healthQuery.data.knowledgeBase?.loaded ? (
              <Text style={styles.meta}>
                {t('ai.knowledgeRecords')}: {healthQuery.data.knowledgeBase.records}
              </Text>
            ) : null}
          </>
        ) : null}
      </Card>

      {messages.length === 0 ? (
        <>
          <Card>
            <Text style={styles.cardTitle}>{t('ai.assistant')}</Text>
            <Text style={styles.body}>{t('ai.intro')}</Text>
            <Text style={styles.disclaimer}>{t('ai.disclaimer')}</Text>
          </Card>
          <Text style={styles.sectionTitle}>{t('ai.suggestionsTitle')}</Text>
          <View style={styles.suggestions}>
            {SUGGESTION_KEYS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={t(key)}
                onPress={() => {
                  setQuestion(t(key));
                  setValidation(null);
                }}
                style={styles.chip}
              >
                <Text style={styles.chipLabel}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {messages.map((message) => (
        <View
          key={message.id}
          style={message.role === 'user' ? styles.userRow : styles.assistantRow}
        >
          <Card
            style={message.role === 'user' ? styles.userCard : styles.assistantCard}
          >
            <Text style={styles.messageRole}>
              {t(message.role === 'user' ? 'ai.you' : 'ai.assistant')}
            </Text>
            <Text style={styles.messageText}>{message.text}</Text>
            {message.answer ? <AnswerDetails answer={message.answer} /> : null}
          </Card>
        </View>
      ))}

      {askMutation.isPending ? (
        <View style={styles.thinking}>
          <ActivityIndicator color={theme.colors.brand} />
          <Text style={styles.meta}>{t('ai.thinking')}</Text>
        </View>
      ) : null}

      {askMutation.isError ? (
        <Text style={styles.error}>{translateApiError(t, askMutation.error)}</Text>
      ) : null}

      <View style={styles.composer}>
        <Text style={styles.label}>{t('ai.questionLabel')}</Text>
        <TextInput
          accessibilityLabel={t('ai.questionLabel')}
          placeholder={t('ai.questionPlaceholder')}
          placeholderTextColor={theme.colors.muted}
          value={question}
          onChangeText={(value) => {
            setQuestion(value);
            setValidation(null);
          }}
          multiline
          maxLength={1200}
          editable={!askMutation.isPending}
          style={styles.input}
        />
        {validation ? <Text style={styles.error}>{validation}</Text> : null}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              label={t('ai.ask')}
              onPress={submit}
              loading={askMutation.isPending}
              disabled={question.trim().length < 3}
              fullWidth
            />
          </View>
          <View style={styles.action}>
            <Button
              label={t('ai.clear')}
              variant="ghost"
              onPress={clear}
              disabled={messages.length === 0 || askMutation.isPending}
              fullWidth
            />
          </View>
        </View>
        <Text style={styles.note}>{t('ai.languageNote')}</Text>
      </View>
    </Screen>
  );
}

function AnswerDetails({ answer }: { answer: AiAnswer }) {
  const { t } = useTranslation();
  const styles = useStyles(makeAnswerStyles);

  const noReliableAnswer = answer.status === 'no_reliable_answer';
  const showSafety =
    answer.status === 'safety_guidance' ||
    answer.safety?.escalate === true ||
    answer.safety?.humanSupportRecommended === true;

  return (
    <View style={styles.details}>
      {noReliableAnswer ? (
        <>
          <Text style={styles.warningTitle}>{t('ai.noAnswerTitle')}</Text>
          <Text style={styles.body}>{t('ai.noAnswerBody')}</Text>
        </>
      ) : null}

      {answer.explanation ? <Text style={styles.body}>{answer.explanation}</Text> : null}
      {answer.guidance ? <Text style={styles.body}>{answer.guidance}</Text> : null}

      {showSafety ? (
        <View style={styles.safety}>
          <Text style={styles.warningTitle}>{t('ai.safetyGuidance')}</Text>
          {answer.safety?.humanSupportRecommended ? (
            <Text style={styles.body}>{t('ai.humanSupport')}</Text>
          ) : null}
          {answer.safety?.escalate ? (
            <Text style={styles.body}>{t('ai.escalate')}</Text>
          ) : null}
        </View>
      ) : null}

      {answer.sources?.length ? (
        <>
          <Text style={styles.sectionTitle}>{t('ai.sources')}</Text>
          {answer.sources.map((source) => (
            <Text key={source.id} style={styles.source}>
              {source.name}
              {source.reference ? ` — ${source.reference}` : ''}
            </Text>
          ))}
        </>
      ) : null}

      {answer.legalReferences?.length ? (
        <>
          <Text style={styles.sectionTitle}>{t('ai.legalReferences')}</Text>
          {answer.legalReferences.map((reference) => (
            <Text
              key={`${reference.source}-${reference.reference}`}
              style={styles.source}
            >
              {reference.source} — {reference.reference}
              {reference.verified ? ` (${t('ai.verified')})` : ''}
            </Text>
          ))}
        </>
      ) : null}

      {answer.generatedBy ? (
        <Text style={styles.meta}>
          {t('ai.generatedBy')}:{' '}
          {t(
            answer.generatedBy === 'configured_llm'
              ? 'ai.configuredLlm'
              : 'ai.groundedFallback',
          )}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  cardTitle: { ...theme.typography.subtitle, color: theme.colors.ink },
  body: { ...theme.typography.body, color: theme.colors.ink, marginBottom: theme.spacing.sm },
  meta: { ...theme.typography.caption, color: theme.colors.muted, marginTop: theme.spacing.xs },
  note: { ...theme.typography.caption, color: theme.colors.muted, marginTop: theme.spacing.md },
  disclaimer: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
  },
  error: { ...theme.typography.caption, color: '#a3203d', marginTop: theme.spacing.sm },
  statusReady: {
    ...theme.typography.body,
    color: theme.colors.brandStrong,
    marginTop: theme.spacing.xs,
  },
  statusUnavailable: {
    ...theme.typography.body,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    ...theme.typography.label,
    color: theme.colors.ink,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  suggestions: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  chip: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
    backgroundColor: theme.colors.soft,
  },
  chipLabel: { ...theme.typography.caption, color: theme.colors.brandStrong },
  userRow: { alignItems: 'flex-end', marginBottom: theme.spacing.md },
  assistantRow: { alignItems: 'flex-start', marginBottom: theme.spacing.md },
  userCard: { maxWidth: '90%', backgroundColor: theme.colors.brandSoft },
  assistantCard: { maxWidth: '100%' },
  messageRole: {
    ...theme.typography.label,
    color: theme.colors.brandStrong,
    marginBottom: theme.spacing.xs,
  },
  messageText: { ...theme.typography.body, color: theme.colors.ink },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  composer: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  label: { ...theme.typography.label, color: theme.colors.ink, marginBottom: theme.spacing.xs },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.ink,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  action: { flex: 1 },
});

const makeAnswerStyles = (theme: AppTheme) => StyleSheet.create({
  details: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  body: { ...theme.typography.body, color: theme.colors.ink, marginBottom: theme.spacing.sm },
  warningTitle: {
    ...theme.typography.label,
    color: theme.colors.brandStrong,
    marginBottom: theme.spacing.xs,
  },
  safety: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandSoft,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: { ...theme.typography.label, color: theme.colors.ink, marginTop: theme.spacing.md },
  source: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  meta: { ...theme.typography.caption, color: theme.colors.muted, marginTop: theme.spacing.md },
});
