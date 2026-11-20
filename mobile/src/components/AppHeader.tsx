import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MENU_LINKS, isMenuLinkAllowed } from '../navigation/menu';
import { useTheme, useStyles, type AppTheme } from '../theme';
import { THEME_TOGGLE_WIDTH, ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared app bar: menu on the left, app name centered, theme toggle on the
 * right. The menu is a plain Modal over the existing expo-router navigation;
 * no drawer/navigation library is introduced. Safe-area spacing comes from the
 * Screen wrapper and from the modal's SafeAreaView.
 */
export function AppHeader({ style }: AppHeaderProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const goTo = (href: string) => {
    closeMenu();
    router.push(href as never);
  };

  return (
    <View style={[styles.header, style]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('menu.open')}
            accessibilityHint={t('menu.hint')}
            hitSlop={8}
            onPress={openMenu}
            style={({ pressed }) => [styles.control, pressed && styles.pressed]}
          >
            <View style={styles.hamburger}>
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
            </View>
          </Pressable>
        </View>

        <View style={styles.center}>
          <Text style={styles.appName} numberOfLines={1}>
            {t('app.name')}
          </Text>
        </View>

        <View style={[styles.side, styles.sideRight]}>
          <ThemeToggle />
        </View>
      </View>

      <Modal
        visible={menuOpen}
        animationType="fade"
        transparent
        onRequestClose={closeMenu}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom', 'left', 'right']}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('menu.close')}
            onPress={closeMenu}
            style={styles.backdrop}
          />
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{t('menu.title')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('menu.close')}
                hitSlop={8}
                onPress={closeMenu}
                style={({ pressed }) => [styles.closeControl, pressed && styles.pressed]}
              >
                <Ionicons name="close-outline" size={20} color={theme.colors.brandStrong} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.links}>
              {MENU_LINKS.filter(isMenuLinkAllowed).map((link) => (
                <Pressable
                  key={link.href}
                  accessibilityRole="button"
                  accessibilityLabel={t(link.labelKey)}
                  onPress={() => goTo(link.href)}
                  style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
                >
                  <Ionicons name={link.icon as never} size={19} color={theme.colors.brand} />
                  <Text style={styles.linkLabel}>{t(link.labelKey)}</Text>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={17}
                    color={theme.colors.muted}
                  />
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.note}>{t('menu.note')}</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  header: {
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.touchTarget,
  },
  side: {
    width: THEME_TOGGLE_WIDTH,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  appName: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  control: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
  },
  closeControl: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  modalSafe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.inverse,
    opacity: 0.35,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '86%',
    maxWidth: 340,
    backgroundColor: theme.colors.paper,
    borderRightWidth: 1,
    borderRightColor: theme.colors.line,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  panelTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
  },
  links: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  link: {
    minHeight: theme.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  linkPressed: { backgroundColor: theme.colors.brandSoft },
  linkLabel: {
    flex: 1,
    ...theme.typography.label,
    color: theme.colors.ink,
  },
  note: {
    ...theme.typography.caption,
    color: theme.colors.muted,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    paddingTop: theme.spacing.md,
  },
});
