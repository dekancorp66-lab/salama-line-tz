import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme, useStyles, type AppTheme } from '../theme';
import { getThemeToggleTarget } from '../theme/toggle';

/** Width is shared with AppHeader so the centered app name stays centered. */
export const THEME_TOGGLE_WIDTH = 76;

const SLOT = 34;
const GAP = 2;
const INSET = 3;

/**
 * Top-right appearance switch. Both Sun and Moon are visible; the icon for the
 * mode the user will get is highlighted. It uses the single persisted theme
 * store: Moon is active in light mode, Sun is active in dark mode.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const progress = useRef(new Animated.Value(theme.resolved === 'dark' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: theme.resolved === 'dark' ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [progress, theme.resolved]);

  const highlightX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SLOT + GAP],
  });
  const isDark = theme.resolved === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? t('header.themeToLight') : t('header.themeToDark')}
      accessibilityHint={t('header.themeHint')}
      hitSlop={8}
      onPress={() => theme.setMode(getThemeToggleTarget(theme.resolved))}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.highlight, { transform: [{ translateX: highlightX }] }]} />
      <View style={styles.slots}>
        <View style={styles.slot}>
          <Ionicons
            name="moon-outline"
            size={19}
            color={isDark ? theme.colors.muted : theme.colors.brandStrong}
          />
        </View>
        <View style={styles.slot}>
          <Ionicons
            name="sunny-outline"
            size={19}
            color={isDark ? theme.colors.brandStrong : theme.colors.muted}
          />
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  button: {
    width: THEME_TOGGLE_WIDTH,
    height: theme.touchTarget,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
    paddingHorizontal: INSET,
    paddingVertical: INSET,
  },
  pressed: { opacity: 0.75 },
  slots: {
    flex: 1,
    flexDirection: 'row',
    gap: GAP,
  },
  slot: {
    width: SLOT,
    height: SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    top: INSET,
    left: INSET,
    width: SLOT,
    height: SLOT,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.paper,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
  },
});
