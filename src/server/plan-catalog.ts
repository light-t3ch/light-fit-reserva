import type {
  BillingCadence,
  CreditBucket,
  PlanCategory,
  SessionCategory,
} from "@prisma/client";

import { LOCATION_SEEDS } from "@/server/location-seeds";

export type PlanAllocationDefinition = {
  bucket: CreditBucket;
  creditType: SessionCategory;
  quantity: number;
  effectiveDay?: number;
};

export type PlanBehavior = {
  /**
   * 21日24:00（=22日0:00 JST）以降の購入では今月分を付与せず、来月分のみを確保する。
   */
  deferCurrentAllocationAfter21?: boolean;
  /**
   * 購入可能な店舗スラッグを制限する場合に指定。
   */
  allowedLocationSlugs?: string[];
};

export type PlanDefinition = {
  slug: string;
  name: string;
  description?: string;
  category: PlanCategory;
  sessionCategory: SessionCategory;
  billingCadence: BillingCadence;
  durationMinutes: number;
  baseCredits: number;
  stripePriceEnv?: string;
  allocations: PlanAllocationDefinition[];
  behavior?: PlanBehavior;
};

export type ResolvedPlanSeed = PlanDefinition & {
  stripePriceId: string | null;
};

const BASE_PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    slug: "pt-55-monthly-4",
    name: "55分 × 4回 / 月",
    category: "SUBSCRIPTION",
    sessionCategory: "PT_55",
    billingCadence: "MONTHLY",
    durationMinutes: 55,
    baseCredits: 4,
    stripePriceEnv: "STRIPE_PRICE_PT55_MONTHLY_4",
    allocations: [
      { bucket: "CURRENT", creditType: "PT_55", quantity: 4 },
      { bucket: "NEXT", creditType: "PT_55", quantity: 4, effectiveDay: 22 },
    ],
    behavior: { deferCurrentAllocationAfter21: true },
  },
  {
    slug: "pt-25-monthly-4",
    name: "25分 × 4回 / 月",
    category: "SUBSCRIPTION",
    sessionCategory: "PT_25",
    billingCadence: "MONTHLY",
    durationMinutes: 25,
    baseCredits: 4,
    stripePriceEnv: "STRIPE_PRICE_PT25_MONTHLY_4",
    allocations: [
      { bucket: "CURRENT", creditType: "PT_25", quantity: 4 },
      { bucket: "NEXT", creditType: "PT_25", quantity: 4, effectiveDay: 22 },
    ],
    behavior: { deferCurrentAllocationAfter21: true },
  },
  {
    slug: "pt-55-monthly-8",
    name: "55分 × 8回 / 月",
    category: "SUBSCRIPTION",
    sessionCategory: "PT_55",
    billingCadence: "MONTHLY",
    durationMinutes: 55,
    baseCredits: 8,
    stripePriceEnv: "STRIPE_PRICE_PT55_MONTHLY_8",
    allocations: [
      { bucket: "CURRENT", creditType: "PT_55", quantity: 8 },
      { bucket: "NEXT", creditType: "PT_55", quantity: 8, effectiveDay: 22 },
    ],
    behavior: { deferCurrentAllocationAfter21: true },
  },
  {
    slug: "pt-25-monthly-8",
    name: "25分 × 8回 / 月",
    category: "SUBSCRIPTION",
    sessionCategory: "PT_25",
    billingCadence: "MONTHLY",
    durationMinutes: 25,
    baseCredits: 8,
    stripePriceEnv: "STRIPE_PRICE_PT25_MONTHLY_8",
    allocations: [
      { bucket: "CURRENT", creditType: "PT_25", quantity: 8 },
      { bucket: "NEXT", creditType: "PT_25", quantity: 8, effectiveDay: 22 },
    ],
    behavior: { deferCurrentAllocationAfter21: true },
  },
  {
    slug: "pt-55-package-8",
    name: "55分 × 8回",
    category: "PACKAGE",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 8,
    stripePriceEnv: "STRIPE_PRICE_PT55_PACKAGE_8",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_55", quantity: 8 }],
  },
  {
    slug: "pt-55-package-4",
    name: "55分 × 4回",
    category: "PACKAGE",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 4,
    stripePriceEnv: "STRIPE_PRICE_PT55_PACKAGE_4",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_55", quantity: 4 }],
  },
  {
    slug: "pt-55-package-3",
    name: "55分 × 3回",
    category: "PACKAGE",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 3,
    stripePriceEnv: "STRIPE_PRICE_PT55_PACKAGE_3",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_55", quantity: 3 }],
  },
  {
    slug: "pt-55-package-2",
    name: "55分 × 2回",
    category: "PACKAGE",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 2,
    stripePriceEnv: "STRIPE_PRICE_PT55_PACKAGE_2",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_55", quantity: 2 }],
  },
  {
    slug: "pt-55-package-1",
    name: "55分 × 1回",
    category: "PACKAGE",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT55_PACKAGE_1",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_55", quantity: 1 }],
  },
  {
    slug: "pt-25-package-4",
    name: "25分 × 4回",
    category: "PACKAGE",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 4,
    stripePriceEnv: "STRIPE_PRICE_PT25_PACKAGE_4",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_25", quantity: 4 }],
  },
  {
    slug: "pt-25-package-3",
    name: "25分 × 3回",
    category: "PACKAGE",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 3,
    stripePriceEnv: "STRIPE_PRICE_PT25_PACKAGE_3",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_25", quantity: 3 }],
  },
  {
    slug: "pt-25-package-2",
    name: "25分 × 2回",
    category: "PACKAGE",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 2,
    stripePriceEnv: "STRIPE_PRICE_PT25_PACKAGE_2",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_25", quantity: 2 }],
  },
  {
    slug: "pt-25-package-1",
    name: "25分 × 1回",
    category: "PACKAGE",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT25_PACKAGE_1",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_25", quantity: 1 }],
  },
  {
    slug: "pt-25-package-8",
    name: "25分 × 8回",
    category: "PACKAGE",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 8,
    stripePriceEnv: "STRIPE_PRICE_PT25_PACKAGE_8",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_25", quantity: 8 }],
  },
  {
    slug: "trial-pt-90-1",
    name: "体験パーソナルトレーニング90分 × 1回きり",
    category: "TRIAL",
    sessionCategory: "TRIAL_90",
    billingCadence: "ONE_TIME",
    durationMinutes: 90,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_TRIAL_90_SINGLE",
    allocations: [{ bucket: "IMMEDIATE", creditType: "TRIAL_90", quantity: 1 }],
  },
  {
    slug: "counseling-once",
    name: "無料カウンセリング35分 × 1回きり",
    category: "TRIAL",
    sessionCategory: "COUNSELING",
    billingCadence: "ONE_TIME",
    durationMinutes: 35,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_COUNSELING_35_SINGLE",
    allocations: [{ bucket: "IMMEDIATE", creditType: "COUNSELING", quantity: 1 }],
  },
  {
    slug: "pt-55-drop-in",
    name: "都度利用55分 × 1回",
    category: "ADDON",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT55_DROPIN",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_55", quantity: 1 }],
  },
  {
    slug: "pt-25-drop-in",
    name: "都度利用25分 × 1回",
    category: "ADDON",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT25_DROPIN",
    allocations: [{ bucket: "IMMEDIATE", creditType: "PT_25", quantity: 1 }],
  },
  {
    slug: "pt-55-special-after22",
    name: "22日以降でも今月に足す特別追加1回 55分",
    category: "ADDON",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT55_ADDON_AFTER22",
    allocations: [{ bucket: "CURRENT", creditType: "PT_55", quantity: 1 }],
  },
  {
    slug: "pt-25-special-after22",
    name: "22日以降でも今月に足す特別追加1回 25分",
    category: "ADDON",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT25_ADDON_AFTER22",
    allocations: [{ bucket: "CURRENT", creditType: "PT_25", quantity: 1 }],
  },
  {
    slug: "pt-55-entry-prorated-1",
    name: "入会時のみ 日割り用55分 × 1回",
    category: "ADDON",
    sessionCategory: "PT_55",
    billingCadence: "ONE_TIME",
    durationMinutes: 55,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT55_ENTRY_1",
    allocations: [{ bucket: "CURRENT", creditType: "PT_55", quantity: 1 }],
  },
  {
    slug: "pt-25-entry-prorated-1",
    name: "入会時のみ 日割り用25分 × 1回",
    category: "ADDON",
    sessionCategory: "PT_25",
    billingCadence: "ONE_TIME",
    durationMinutes: 25,
    baseCredits: 1,
    stripePriceEnv: "STRIPE_PRICE_PT25_ENTRY_1",
    allocations: [{ bucket: "CURRENT", creditType: "PT_25", quantity: 1 }],
  },
];

const ENROLLMENT_DEFINITIONS: PlanDefinition[] = LOCATION_SEEDS.map((location) => {
  const envKey = `STRIPE_PRICE_ENROLLMENT_${location.slug.replace(/-/g, "_").toUpperCase()}`;
  return {
    slug: `enrollment-${location.slug}`,
    name: `入会金（${location.name}）`,
    category: "ENROLLMENT",
    sessionCategory: "ENROLLMENT",
    billingCadence: "ONE_TIME",
    durationMinutes: 0,
    baseCredits: 0,
    stripePriceEnv: envKey,
    allocations: [],
    behavior: { allowedLocationSlugs: [location.slug] },
  } satisfies PlanDefinition;
});

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  ...BASE_PLAN_DEFINITIONS,
  ...ENROLLMENT_DEFINITIONS,
];

export function resolvePlanSeeds(): ResolvedPlanSeed[] {
  return PLAN_DEFINITIONS.map((definition) => ({
    ...definition,
    stripePriceId: definition.stripePriceEnv
      ? process.env[definition.stripePriceEnv] ?? null
      : null,
  }));
}

export function getPlanDefinition(slug: string): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find((definition) => definition.slug === slug);
}
