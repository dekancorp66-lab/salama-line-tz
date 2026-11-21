import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { THEME_MODES, type ThemeMode } from '../../src/store/themeStore';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

const MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
};

const MODE_HINT_KEYS: Record<ThemeMode, string> = {
  light: 'theme.lightHint',
  dark: 'theme.darkHint',
  system: 'theme.systemHint',
};

export default function ThemeSettingsScreen() {
  const { t } = useTranslation();
  const { mode, resolved, setMode } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <Screen>
      <ScreenHeader title={t('theme.title')} subtitle={t('theme.subtitle')} />

      <View style={styles.options} accessibilityRole="radiogroup">
        {THEME_MODES.map((option) => {
          const active = option === mode;
          const label = t(MODE_LABEL_KEYS[option]);

          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={label}
              onPress={() => setMode(option)}
              style={[styles.option, active && styles.optionActive]}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <View style={styles.copy}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                  {label}
                </Text>
                <Text style={styles.hint}>{t(MODE_HINT_KEYS[option])}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        {t('theme.current')}: {t(MODE_LABEL_KEYS[resolved])}
      </Text>
      <Text style={styles.note}>{t('theme.note')}</Text>
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
    paddingVertical: theme.spacing.md,
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
  copy: { flex: 1, gap: theme.spacing.xs },
  optionLabel: { ...theme.typography.body, color: theme.colors.ink },
  optionLabelActive: { color: theme.colors.brandStrong },
  hint: { ...theme.typography.caption, color: theme.colors.muted },
  note: { ...theme.typography.body, color: theme.colors.muted, marginBottom: theme.spacing.md },
});
