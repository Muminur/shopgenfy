import { z } from 'zod';
import { SHOPIFY_LIMITS, FORBIDDEN_PATTERNS, SHOPIFY_CATEGORIES } from './constants';

const pricingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('free'),
  }),
  z.object({
    type: z.literal('freemium'),
    price: z.number().positive().optional(),
    currency: z.string().optional(),
    billingCycle: z.enum(['monthly', 'yearly', 'one-time']).optional(),
    trialDays: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal('paid'),
    price: z.number().positive(),
    currency: z.string().min(1),
    billingCycle: z.enum(['monthly', 'yearly', 'one-time']),
    trialDays: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal('subscription'),
    price: z.number().positive(),
    currency: z.string().min(1),
    billingCycle: z.enum(['monthly', 'yearly']),
    trialDays: z.number().int().min(0).optional(),
  }),
]);

const noContactInfo = (value: string) => !FORBIDDEN_PATTERNS.CONTACT_INFO.test(value);
const noUnverifiableClaims = (value: string) => !FORBIDDEN_PATTERNS.UNVERIFIABLE_CLAIMS.test(value);

export const submissionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  appName: z
    .string()
    .min(1, 'App name is required')
    .max(
      SHOPIFY_LIMITS.APP_NAME_MAX,
      `App name must be ${SHOPIFY_LIMITS.APP_NAME_MAX} characters or less`
    ),
  appIntroduction: z
    .string()
    .max(
      SHOPIFY_LIMITS.APP_INTRODUCTION_MAX,
      `App introduction must be ${SHOPIFY_LIMITS.APP_INTRODUCTION_MAX} characters or less`
    ),
  appDescription: z
    .string()
    .max(
      SHOPIFY_LIMITS.APP_DESCRIPTION_MAX,
      `App description must be ${SHOPIFY_LIMITS.APP_DESCRIPTION_MAX} characters or less`
    )
    .refine(noContactInfo, 'Description cannot contain contact information')
    .refine(
      noUnverifiableClaims,
      'Description cannot contain unverifiable claims (best, first, #1, etc.)'
    ),
  featureList: z.array(
    z
      .string()
      .max(
        SHOPIFY_LIMITS.FEATURE_ITEM_MAX,
        `Each feature must be ${SHOPIFY_LIMITS.FEATURE_ITEM_MAX} characters or less`
      )
  ),
  languages: z.array(z.string()),
  worksWith: z
    .array(z.string())
    .max(
      SHOPIFY_LIMITS.WORKS_WITH_MAX_ITEMS,
      `Maximum ${SHOPIFY_LIMITS.WORKS_WITH_MAX_ITEMS} integrations allowed`
    ),
  primaryCategory: z.enum(SHOPIFY_CATEGORIES as unknown as [string, ...string[]]),
  secondaryCategory: z.enum(SHOPIFY_CATEGORIES as unknown as [string, ...string[]]).optional(),
  featureTags: z
    .array(z.string())
    .max(
      SHOPIFY_LIMITS.FEATURE_TAGS_MAX_ITEMS,
      `Maximum ${SHOPIFY_LIMITS.FEATURE_TAGS_MAX_ITEMS} tags allowed`
    ),
  pricing: pricingSchema,
  landingPageUrl: z.string().url('Invalid URL format'),
  status: z.enum(['draft', 'complete', 'exported']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createSubmissionSchema = submissionSchema.omit({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSubmissionSchema = createSubmissionSchema.partial();

export type SubmissionInput = z.infer<typeof createSubmissionSchema>;
export type SubmissionUpdate = z.infer<typeof updateSubmissionSchema>;
export type Submission = z.infer<typeof submissionSchema>;

export function validateSubmission(data: unknown): {
  success: boolean;
  data?: SubmissionInput;
  errors?: z.ZodIssue[];
} {
  const result = createSubmissionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
