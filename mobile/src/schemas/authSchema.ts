import { z } from 'zod';
import type { Translate } from './supportSchema';

/**
 * Validation mirrors the NestJS DTO bounds so the client fails before sending
 * credentials. Messages are translated at build time to avoid mixed languages.
 */
export function makeLoginSchema(t: Translate) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, t('auth.validation.email'))
      .email(t('auth.validation.email')),
    password: z.string().min(1, t('auth.validation.password')),
  });
}

export function makeRegisterSchema(t: Translate) {
  return z
    .object({
      email: z
        .string()
        .trim()
        .min(1, t('auth.validation.email'))
        .email(t('auth.validation.email')),
      displayName: z
        .string()
        .trim()
        .min(2, t('auth.validation.displayName'))
        .max(80, t('auth.validation.displayName')),
      password: z
        .string()
        .min(12, t('auth.validation.password'))
        .max(128, t('auth.validation.password')),
      confirmPassword: z.string(),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ['confirmPassword'],
      message: t('auth.validation.passwordMatch'),
    });
}

export type LoginFormValues = z.infer<ReturnType<typeof makeLoginSchema>>;
export type RegisterFormValues = z.infer<ReturnType<typeof makeRegisterSchema>>;
