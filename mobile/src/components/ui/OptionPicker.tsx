import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme, useStyles, type AppTheme } from '../../theme';

export interface Option {
  label: string;
  value: string;
}

interface OptionPickerProps {
  label: string;
  value: string;
  options: Option[];
  placeholder?: string;
  onSelect: (value: string) => void;
}

export function OptionPicker({
  label,
  value,
  options,
  placeholder,
  onSelect,
}: OptionPickerProps) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder ?? '' }}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected?.label ?? placeholder ?? '—'}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modal}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={styles.close}
          >
            <Text style={styles.closeLabel}>{placeholder ?? label}</Text>
          </Pressable>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <Text style={styles.optionLabel}>{item.label}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  wrapper: { gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  label: { ...theme.typography.label, color: theme.colors.ink },
  trigger: {
    minHeight: theme.touchTarget,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.paper,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  value: { ...theme.typography.body, color: theme.colors.ink },
  placeholder: { ...theme.typography.body, color: theme.colors.muted },
  modal: { flex: 1, backgroundColor: theme.colors.paper },
  close: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  closeLabel: { ...theme.typography.subtitle, color: theme.colors.brandStrong },
  option: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  pressed: { backgroundColor: theme.colors.brandSoft },
  optionLabel: { ...theme.typography.body, color: theme.colors.ink },
});
