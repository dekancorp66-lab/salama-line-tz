import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useStyles, type AppTheme } from '../theme';
import { getThemeToggleTarget } from '../theme/toggle';

/** Width is shared with AppHeader so the centered app name stays centered. */
export const THEME_TOGGLE_WIDTH = 76;

const SLOT = 34;
const GAP = 2;
const INSET = 3;

function MoonGlyph({ color, cutout }: { color: string; cutout: string }) {
  return (
    <View style={glyphStyles.moonWrap}>
      <View style={[glyphStyles.moonDisc, { backgroundColor: color }]} />
      <View style={[glyphStyles.moonCutout, { backgroundColor: cutout }]} />
    </View>
  );
}

function SunGlyph({ color }: { color: string }) {
  return (
    <View style={glyphStyles.sunWrap}>
      <View style={[glyphStyles.sunRayTop, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunRayBottom, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunRayLeft, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunRayRight, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunCorner, glyphStyles.sunCornerTL, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunCorner, glyphStyles.sunCornerTR, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunCorner, glyphStyles.sunCornerBL, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunCorner, glyphStyles.sunCornerBR, { backgroundColor: color }]} />
      <View style={[glyphStyles.sunCore, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Top-right appearance switch. Both Sun and Moon are visible; the icon for the
 * mode the user will get is highlighted. These glyphs are drawn with Views, so
 * the theme control stays clear even when the icon font cannot be downloaded.
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
  const active = theme.colors.brandStrong;
  const inactive = theme.colors.muted;
  const cutout = isDark ? theme.colors.brandSoft : theme.colors.paper;

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
          <MoonGlyph color={isDark ? inactive : active} cutout={cutout} />
        </View>
        <View style={styles.slot}>
          <SunGlyph color={isDark ? active : inactive} />
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

const glyphStyles = StyleSheet.create({
  moonWrap: { width: 20, height: 20, overflow: 'hidden' },
  moonDisc: { position: 'absolute', left: 1, top: 1, width: 18, height: 18, borderRadius: 9 },
  moonCutout: { position: 'absolute', left: 7, top: 0, width: 16, height: 16, borderRadius: 8 },
  sunWrap: { width: 20, height: 20 },
  sunRayTop: { position: 'absolute', left: 9, top: 0, width: 2, height: 4, borderRadius: 1 },
  sunRayBottom: { position: 'absolute', left: 9, top: 16, width: 2, height: 4, borderRadius: 1 },
  sunRayLeft: { position: 'absolute', left: 0, top: 9, width: 4, height: 2, borderRadius: 1 },
  sunRayRight: { position: 'absolute', left: 16, top: 9, width: 4, height: 2, borderRadius: 1 },
  sunCorner: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5 },
  sunCornerTL: { left: 2, top: 2 },
  sunCornerTR: { left: 15, top: 2 },
  sunCornerBL: { left: 2, top: 15 },
  sunCornerBR: { left: 15, top: 15 },
  sunCore: { position: 'absolute', left: 5.5, top: 5.5, width: 9, height: 9, borderRadius: 5 },
});
