import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../src/components/ui/Screen';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { Card } from '../src/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../src/components/ui/Feedback';
import { listPublicServices, type ServiceType } from '../src/api/endpoints';
import { translateApiError } from '../src/api/errors';
import { useTheme, useStyles, type AppTheme } from '../src/theme';

const TYPES: Array<ServiceType | null> = [
  null,
  'CLINIC',
  'LEGAL_AID',
  'SOCIAL_WELFARE',
  'SHELTER',
  'COUNSELLING',
  'OTHER',
];

export default function ServicesScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [type, setType] = useState<ServiceType | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: () => listPublicServices(),
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const regionTerm = region.trim().toLowerCase();
    const districtTerm = district.trim().toLowerCase();

    return (data ?? []).filter((service) => {
      const matchesType = !type || service.type === type;
      const matchesRegion = !regionTerm || service.region.toLowerCase().includes(regionTerm);
      const matchesDistrict =
        !districtTerm || service.districtCode.toLowerCase().includes(districtTerm);
      const matchesTerm =
        !term ||
        service.name.toLowerCase().includes(term) ||
        (service.address ?? '').toLowerCase().includes(term);
      return matchesType && matchesRegion && matchesDistrict && matchesTerm;
    });
  }, [data, search, region, district, type]);

  return (
    <Screen>
      <ScreenHeader title={t('services.title')} subtitle={t('services.intro')} />

      <TextInput
        accessibilityLabel={t('services.searchPlaceholder')}
        placeholder={t('services.searchPlaceholder')}
        placeholderTextColor={theme.colors.muted}
        value={search}
        onChangeText={setSearch}
        style={styles.input}
      />
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={t('services.region')}
          placeholder={t('services.allRegions')}
          placeholderTextColor={theme.colors.muted}
          value={region}
          onChangeText={setRegion}
          style={[styles.input, styles.half]}
        />
        <TextInput
          accessibilityLabel={t('services.district')}
          placeholder={t('services.allDistricts')}
          placeholderTextColor={theme.colors.muted}
          value={district}
          onChangeText={setDistrict}
          style={[styles.input, styles.half]}
        />
      </View>

      <View style={styles.chips}>
        {TYPES.map((item) => (
          <Pressable
            key={item ?? 'all'}
            accessibilityRole="button"
            onPress={() => setType(item)}
            style={[styles.chip, type === item && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, type === item && styles.chipLabelActive]}>
              {item ?? t('services.allTypes')}
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
        <EmptyState title={t('services.empty')} />
      ) : null}

      {visible.map((service) => (
        <Card key={service.id}>
          <Text style={styles.name}>{service.name}</Text>
          <Text style={styles.meta}>
            {service.type} · {service.region} · {service.districtCode}
          </Text>
          {service.address ? <Text style={styles.body}>{service.address}</Text> : null}
          {service.openingHours ? (
            <Text style={styles.body}>
              {t('services.hours')}: {service.openingHours}
            </Text>
          ) : null}
          {service.phonePublic ? (
            <Text style={styles.phone}>
              {t('services.phone')}: {service.phonePublic}
            </Text>
          ) : null}
          <Text style={styles.verified}>
            {t('services.verified')}: {service.verificationOrg}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  input: {
    minHeight: theme.touchTarget,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.ink,
    marginBottom: theme.spacing.md,
  },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  half: { flex: 1 },
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
  name: { ...theme.typography.subtitle, color: theme.colors.ink },
  meta: { ...theme.typography.caption, color: theme.colors.brand },
  body: { ...theme.typography.body, color: theme.colors.muted },
  phone: { ...theme.typography.body, color: theme.colors.brandStrong },
  verified: { ...theme.typography.caption, color: theme.colors.muted },
});
