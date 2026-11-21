import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type Language,
} from '../../src/i18n';
import { useLanguageStore } from '../../src/store/languageStore';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function LanguageSettingsScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const savedLanguage = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [selected, setSelected] = useState<Language>(savedLanguage);
  const [confirmed, setConfirmed] = useState(false);

  const confirm = () => {
    setLanguage(selected);
    setConfirmed(true);
  };

  return (
    <Screen>
      <ScreenHeader title={t('language.title')} subtitle={t('language.subtitle')} />

      <View style={styles.options} accessibilityRole="radiogroup">
        {SUPPORTED_LANGUAGES.map((language) => {
          const active = selected === language;
          return (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={LANGUAGE_NAMES[language]}
              onPress={() => {
                setSelected(language);
                setConfirmed(false);
              }}
              style={[styles.option, active && styles.optionActive]}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {LANGUAGE_NAMES[language]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>{t('language.note')}</Text>
      <Text style={styles.note}>{t('language.deviceNote')}</Text>
      {confirmed ? <Text style={styles.success}>{t('language.changed')}</Text> : null}

      <Button label={t('language.confirm')} onPress={confirm} />
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  options: { gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  option: {
    minHeight: theme.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.paper,
  },
  optionActive: {
    borderColor: theme.colors.brandFill,
    backgroundColor: theme.colors.brandSoft,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.muted,
  },
  radioActive: {
    borderColor: theme.colors.brandFill,
    backgroundColor: theme.colors.brandFill,
  },
  optionLabel: { ...theme.typography.body, color: theme.colors.ink },
  optionLabelActive: { color: theme.colors.brandStrong },
  note: { ...theme.typography.body, color: theme.colors.muted, marginBottom: theme.spacing.md },
  success: {
    ...theme.typography.body,
    color: theme.colors.brandStrong,
    marginBottom: theme.spacing.md,
  },
});
