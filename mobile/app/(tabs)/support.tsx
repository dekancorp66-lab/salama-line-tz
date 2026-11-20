import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../../src/components/ui/Screen';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { OptionPicker } from '../../src/components/ui/OptionPicker';
import { submitHelpRequest, type HelpRequestReceipt } from '../../src/api/endpoints';
import { translateApiError } from '../../src/api/errors';
import { makeSupportSchema, type SupportFormValues } from '../../src/schemas/supportSchema';
import { TANZANIA_REGIONS, findRegionById } from '../../src/data/locations';
import { useTheme, useStyles, type AppTheme } from '../../src/theme';

const TOPICS = [
  'CHILD_MARRIAGE',
  'FGM',
  'DIGITAL_SAFETY',
  'HEALTH',
  'MENTAL_HEALTH',
  'OTHER',
] as const;

export default function SupportScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const [receipt, setReceipt] = useState<HelpRequestReceipt | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resolver = useMemo(() => zodResolver(makeSupportSchema(t)), [t]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupportFormValues>({
    resolver,
    defaultValues: {
      topic: '',
      details: '',
      regionId: '',
      districtId: '',
      consentToContact: false,
      contact: '',
      anonymousReport: true,
      locationConsentGiven: false,
    },
  });

  const regionId = watch('regionId');
  const consentToContact = watch('consentToContact');
  const region = findRegionById(regionId);

  if (receipt) {
    return (
      <Screen>
        <ScreenHeader title={t('support.done')} />
        <Card>
          <Text style={styles.receiptLabel}>{t('support.referenceTitle')}</Text>
          <Text style={styles.receiptCode}>{receipt.caseCode}</Text>
          <Text style={styles.muted}>{t('support.referenceHint')}</Text>
          <Button
            label={copied ? t('common.copied') : t('common.copy')}
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(receipt.caseCode);
              setCopied(true);
            }}
          />
        </Card>
        <Text style={styles.muted}>{t('support.doneBody')}</Text>
        <Button
          label={t('support.trackNow')}
          onPress={() => router.push(`/(tabs)/requests?code=${receipt.caseCode}` as never)}
        />
      </Screen>
    );
  }

  const onSubmit = async (values: SupportFormValues) => {
    setSubmitError(null);
    const selectedRegion = findRegionById(values.regionId);
    const district = selectedRegion?.districts.find((item) => item.id === values.districtId);
    if (!selectedRegion || !district) {
      setSubmitError(t('support.validation.location'));
      return;
    }

    try {
      const result = await submitHelpRequest({
        topic: values.topic,
        concernSummary: values.details,
        regionId: selectedRegion.id,
        regionName: selectedRegion.name,
        districtId: district.id,
        districtName: district.name,
        channel: 'WEB',
        consentToContact: values.consentToContact,
        contact: values.consentToContact ? values.contact : undefined,
        anonymousReport: !values.consentToContact,
        locationConsentGiven: false,
      });
      setReceipt(result);
    } catch (error) {
      setSubmitError(translateApiError(t, error));
    }
  };

  const locationError =
    errors.regionId || errors.districtId ? t('support.validation.location') : null;

  return (
    <Screen>
      <ScreenHeader title={t('support.title')} subtitle={t('support.intro')} />

      <Card>
        <Text style={styles.section}>{t('safety.minimize')}</Text>
        <Text style={styles.muted}>{t('safety.emergency')}</Text>
      </Card>

      <Controller
        control={control}
        name="topic"
        render={({ field }) => (
          <OptionPicker
            label={t('support.category')}
            value={field.value}
            placeholder={t('support.category')}
            options={TOPICS.map((topic) => ({
              label: t(`support.topics.${topic}`),
              value: topic,
            }))}
            onSelect={field.onChange}
          />
        )}
      />
      {errors.topic ? <Text style={styles.error}>{errors.topic.message}</Text> : null}

      <Controller
        control={control}
        name="regionId"
        render={({ field }) => (
          <OptionPicker
            label={t('support.location')}
            value={field.value}
            placeholder={t('services.allRegions')}
            options={TANZANIA_REGIONS.map((item) => ({ label: item.name, value: item.id }))}
            onSelect={(value) => {
              field.onChange(value);
              setValue('districtId', '');
            }}
          />
        )}
      />
      <Controller
        control={control}
        name="districtId"
        render={({ field }) => (
          <OptionPicker
            label={t('services.district')}
            value={field.value}
            placeholder={t('services.allDistricts')}
            options={(region?.districts ?? []).map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            onSelect={field.onChange}
          />
        )}
      />
      {locationError ? <Text style={styles.error}>{locationError}</Text> : null}

      <Text style={styles.label}>{t('support.details')}</Text>
      <Controller
        control={control}
        name="details"
        render={({ field }) => (
          <TextInput
            accessibilityLabel={t('support.details')}
            placeholder={t('support.detailsPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            value={field.value}
            onChangeText={field.onChange}
            multiline
            maxLength={2000}
            style={styles.textarea}
          />
        )}
      />
      {errors.details ? <Text style={styles.error}>{errors.details.message}</Text> : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consentToContact }}
        onPress={() => {
          const next = !consentToContact;
          setValue('consentToContact', next);
          setValue('anonymousReport', !next);
        }}
        style={styles.checkboxRow}
      >
        <View style={[styles.checkbox, consentToContact && styles.checkboxActive]} />
        <Text style={styles.checkboxLabel}>{t('support.contact')}</Text>
      </Pressable>
      <Text style={styles.muted}>{t('support.contactHint')}</Text>

      {consentToContact ? (
        <Controller
          control={control}
          name="contact"
          render={({ field }) => (
            <TextInput
              accessibilityLabel={t('support.contactValue')}
              placeholder={t('support.contactValue')}
              placeholderTextColor={theme.colors.muted}
              value={field.value}
              onChangeText={field.onChange}
              maxLength={100}
              autoCapitalize="none"
              style={styles.input}
            />
          )}
        />
      ) : null}
      {errors.contact ? <Text style={styles.error}>{errors.contact.message}</Text> : null}

      <Text style={styles.muted}>{t('support.consentWarning')}</Text>

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button
        label={t('support.submit')}
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
    </Screen>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  section: { ...theme.typography.body, color: theme.colors.ink },
  muted: { ...theme.typography.caption, color: theme.colors.muted },
  label: { ...theme.typography.label, color: theme.colors.ink, marginBottom: theme.spacing.xs },
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
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper,
    padding: theme.spacing.md,
    color: theme.colors.ink,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
  },
  checkboxRow: {
    minHeight: theme.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.muted,
  },
  checkboxActive: { backgroundColor: theme.colors.brandFill, borderColor: theme.colors.brandFill },
  checkboxLabel: { ...theme.typography.body, color: theme.colors.ink },
  error: { ...theme.typography.caption, color: '#a3203d', marginBottom: theme.spacing.sm },
  receiptLabel: { ...theme.typography.label, color: theme.colors.muted },
  receiptCode: {
    ...theme.typography.title,
    color: theme.colors.brandStrong,
    letterSpacing: 1,
  },
});
