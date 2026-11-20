import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme, useStyles, type AppTheme } from '../theme';
import { getThemeToggleTarget } from '../theme/toggle';

/**
 * Top-right appearance switch. It uses the single persisted theme store and
 * shows the action available to the user: Moon in light mode, Sun in dark mode.
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

  const moonOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const sunOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const moonRotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });
  const sunRotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        theme.resolved === 'dark' ? t('header.themeToLight') : t('header.themeToDark')
      }
      accessibilityHint={t('header.themeHint')}
      hitSlop={8}
      onPress={() => theme.setMode(getThemeToggleTarget(theme.resolved))}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Animated.View
        style={[styles.icon, { opacity: moonOpacity, transform: [{ rotate: moonRotation }] }]}
      >
        <Ionicons name="moon-outline" size={20} color={theme.colors.brandStrong} />
      </Animated.View>
      <Animated.View
        style={[
          styles.icon,
          styles.iconOverlay,
          { opacity: sunOpacity, transform: [{ rotate: sunRotation }] },
        ]}
      >
        <Ionicons name="sunny-outline" size={20} color={theme.colors.brandStrong} />
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  button: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
  },
  pressed: { opacity: 0.75 },
  icon: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
