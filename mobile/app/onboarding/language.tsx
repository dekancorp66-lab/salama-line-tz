import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { OnboardingShell } from '../../src/components/onboarding/OnboardingShell';
import { Button } from '../../src/components/ui/Button';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from '../../src/i18n';
import { useLanguageStore } from '../../src/store/languageStore';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

export default function OnboardingLanguageScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const savedLanguage = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [selected, setSelected] = useState<Language>(savedLanguage);

  const confirm = () => {
    // The only language mutation path is this explicit user confirmation.
    setLanguage(selected);
    router.push('/onboarding/privacy');
  };

  return (
    <OnboardingShell
      eyebrow={t('nav.language')}
      title={t('onboarding.languageTitle')}
      body={t('onboarding.languageBody')}
      step={2}
      total={3}
    >
      <View style={styles.options} accessibilityRole="radiogroup">
        {SUPPORTED_LANGUAGES.map((language) => {
          const active = selected === language;
          return (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={LANGUAGE_NAMES[language]}
              onPress={() => setSelected(language)}
              style={({ pressed }) => [
                styles.option,
                active && styles.optionActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {LANGUAGE_NAMES[language]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button label={t('language.confirm')} onPress={confirm} />
    </OnboardingShell>
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
  pressed: { opacity: 0.75 },
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
});
