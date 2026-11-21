import { z } from 'zod';

export type Translate = (key: string) => string;

/** Schema is built with translated messages so validation never mixes languages. */
export function makeSupportSchema(t: Translate) {
  return z
    .object({
      topic: z.string().min(1, t('support.validation.topic')),
      details: z.string().trim().min(3, t('support.validation.details')),
      regionId: z.string().min(1, t('support.validation.location')),
      districtId: z.string().min(1, t('support.validation.location')),
      consentToContact: z.boolean(),
      contact: z.string().trim().max(100),
      anonymousReport: z.boolean(),
      locationConsentGiven: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (value.consentToContact && value.contact.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['contact'],
          message: t('support.validation.contact'),
        });
      }
    });
}

export type SupportFormValues = z.infer<ReturnType<typeof makeSupportSchema>>;
