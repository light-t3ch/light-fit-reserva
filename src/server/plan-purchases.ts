import { addMonths, set, startOfMonth } from "date-fns";
import type {
  BillingCadence,
  Plan,
  PlanCategory,
  PlanCreditAllocation,
  PlanPurchase,
  Prisma,
} from "@prisma/client";
import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { getPlanDefinition, PlanBehavior } from "@/server/plan-catalog";

const JST_OFFSET_MINUTES = 9 * 60;

export type CustomerContext = {
  id: string;
  tenantId: string;
  locationId: string;
  locationSlug: string;
  locationName: string;
  stripeCustomerId: string | null;
  email: string | null;
  fullName: string;
};

export type PlanCatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: PlanCategory;
  billingCadence: BillingCadence;
  sessionCategory: Plan["sessionCategory"];
  durationMinutes: number;
  baseCredits: number;
  stripePriceId: string;
  price?: {
    amount: number | null;
    currency: string | null;
    recurringInterval: Stripe.Price.Recurring.Interval | null;
    intervalCount: number | null;
    isRecurring: boolean;
  };
  /** Stripe側で価格が取得できた場合のみtrue */
  isPurchasable: boolean;
  /** 管理者向けに表示するための制限理由 */
  unavailableReason?: "MISSING_PRICE";
  behavior?: PlanBehavior;
};

export async function getCustomerContextForUser(userId: string): Promise<CustomerContext | null> {
  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: {
      id: true,
      tenantId: true,
      locationId: true,
      firstName: true,
      lastName: true,
      email: true,
      stripeCustomerId: true,
      location: { select: { slug: true, name: true } },
    },
  });

  if (!customer || !customer.locationId || !customer.location?.slug) {
    return null;
  }

  const fullName = `${customer.lastName ?? ""}${customer.firstName ? ` ${customer.firstName}` : ""}`.trim();

  return {
    id: customer.id,
    tenantId: customer.tenantId,
    locationId: customer.locationId,
    locationSlug: customer.location.slug,
    locationName: customer.location.name,
    stripeCustomerId: customer.stripeCustomerId,
    email: customer.email ?? null,
    fullName: fullName.length > 0 ? fullName : "",
  };
}

export async function listPlanCatalogForCustomer(
  userId: string,
): Promise<{ customer: CustomerContext | null; plans: PlanCatalogItem[] }> {
  const context = await getCustomerContextForUser(userId);

  if (!context) {
    return { customer: null, plans: [] };
  }

  const plans = await prisma.plan.findMany({
    where: {
      tenantId: context.tenantId,
      isActive: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const priceIds = Array.from(
    new Set(
      plans
        .map((plan) => plan.stripePriceId)
        .filter((priceId): priceId is string => Boolean(priceId)),
    ),
  );

  const priceMap = await fetchStripePrices(priceIds);

  const items: PlanCatalogItem[] = [];

  for (const plan of plans) {
    const definition = getPlanDefinition(plan.slug);

    if (definition?.behavior?.allowedLocationSlugs?.length) {
      if (!definition.behavior.allowedLocationSlugs.includes(context.locationSlug)) {
        continue;
      }
    }

    if (!plan.stripePriceId) {
      continue;
    }

    const price = priceMap[plan.stripePriceId];
    const isPurchasable = Boolean(price);

    items.push({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      category: plan.category,
      billingCadence: plan.billingCadence,
      sessionCategory: plan.sessionCategory,
      durationMinutes: plan.durationMinutes,
      baseCredits: plan.baseCredits,
      stripePriceId: plan.stripePriceId,
      price: price
        ? {
            amount: price.unit_amount ?? null,
            currency: price.currency ?? null,
            recurringInterval: price.recurring?.interval ?? null,
            intervalCount: price.recurring?.interval_count ?? null,
            isRecurring: Boolean(price.recurring),
          }
        : undefined,
      isPurchasable,
      unavailableReason: isPurchasable ? undefined : "MISSING_PRICE",
      behavior: definition?.behavior,
    });
  }

  return { customer: context, plans: items };
}

export async function createCheckoutSessionForPlan(options: {
  userId: string;
  planSlug: string;
  origin: string;
  successPath?: string;
  cancelPath?: string;
}): Promise<{ url: string } | null> {
  const { userId, planSlug, origin } = options;
  const successPath = options.successPath ?? "/portal/plans/success";
  const cancelPath = options.cancelPath ?? "/portal/plans";

  const context = await getCustomerContextForUser(userId);
  if (!context) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const plan = await prisma.plan.findFirst({
    where: { tenantId: context.tenantId, slug: planSlug, isActive: true },
  });

  if (!plan || !plan.stripePriceId) {
    throw new Error("PLAN_NOT_AVAILABLE");
  }

  const definition = getPlanDefinition(plan.slug);

  if (definition?.behavior?.allowedLocationSlugs?.length) {
    if (!definition.behavior.allowedLocationSlugs.includes(context.locationSlug)) {
      throw new Error("PLAN_NOT_AVAILABLE_FOR_LOCATION");
    }
  }

  const stripe = getStripeClient();
  const stripeCustomerId = await getOrCreateStripeCustomer(context, stripe);

  await assertStripePriceExists(stripe, plan.stripePriceId);

  const metadata = {
    tenantId: context.tenantId,
    customerId: context.id,
    locationId: context.locationId,
    locationSlug: context.locationSlug,
    planId: plan.id,
    planSlug: plan.slug,
    planCategory: plan.category,
    billingCadence: plan.billingCadence,
    userId,
    priceId: plan.stripePriceId,
  } satisfies Record<string, string>;

  const mode: Stripe.Checkout.SessionCreateParams.Mode =
    plan.billingCadence === "MONTHLY" ? "subscription" : "payment";

  const successUrl = new URL(successPath, ensureOrigin(origin));
  successUrl.searchParams.set("plan", plan.slug);
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

  const cancelUrl = new URL(cancelPath, ensureOrigin(origin));
  cancelUrl.searchParams.set("plan", plan.slug);
  cancelUrl.searchParams.set("cancelled", "1");

  const params: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomerId,
    mode,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    client_reference_id: plan.slug,
    metadata,
    allow_promotion_codes: false,
  };

  if (mode === "subscription") {
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = { metadata };
  }

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    return null;
  }

  return { url: session.url };
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const tenantId = metadata.tenantId;
  const customerId = metadata.customerId;
  const planSlug = metadata.planSlug;
  const locationId = metadata.locationId;

  if (!tenantId || !customerId || !planSlug || !locationId) {
    throw new Error("CHECKOUT_METADATA_INCOMPLETE");
  }

  const plan = await prisma.plan.findFirst({
    where: { tenantId, slug: planSlug },
    include: { allocations: true },
  });

  if (!plan) {
    throw new Error("PLAN_NOT_FOUND_FOR_CHECKOUT");
  }

  const existingBySession = await prisma.planPurchase.findFirst({
    where: { stripeCheckoutSessionId: session.id },
  });

  if (existingBySession) {
    return existingBySession;
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  if (subscriptionId) {
    const existingBySubscription = await prisma.planPurchase.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (existingBySubscription) {
      await prisma.planPurchase.update({
        where: { id: existingBySubscription.id },
        data: {
          stripeCheckoutSessionId: existingBySubscription.stripeCheckoutSessionId ?? session.id,
        },
      });

      return existingBySubscription;
    }
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, tenantId: true, stripeCustomerId: true },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND_FOR_CHECKOUT");
  }

  if (typeof session.customer === "string" && session.customer !== customer.stripeCustomerId) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { stripeCustomerId: session.customer },
    });
  }

  const stripe = getStripeClient();
  const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;

  const purchasedAt = session.created ? new Date(session.created * 1000) : new Date();
  const currentPeriodStart = subscription
    ? new Date(subscription.current_period_start * 1000)
    : purchasedAt;
  const currentPeriodEnd = subscription ? new Date(subscription.current_period_end * 1000) : null;

  const planPurchase = await prisma.planPurchase.create({
    data: {
      tenantId,
      customerId,
      planId: plan.id,
      locationId,
      billingCadence: plan.billingCadence,
      status: subscription?.status ?? "completed",
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingAt: currentPeriodEnd,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: metadata.priceId ?? plan.stripePriceId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripeInvoiceId: typeof session.invoice === "string" ? session.invoice : null,
      metadata: {
        checkoutSessionId: session.id,
        mode: session.mode,
        priceId: metadata.priceId ?? plan.stripePriceId,
      },
    },
  });

  const definition = getPlanDefinition(plan.slug);

  await applyPlanAllocations({
    plan,
    planPurchase,
    purchasedAt,
    behavior: definition?.behavior,
    referenceId: session.id,
    reason: `${plan.name}の購入`,
  });

  return planPurchase;
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle") {
    return;
  }

  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;

  if (!subscriptionId) {
    return;
  }

  const planPurchase = await prisma.planPurchase.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { plan: { include: { allocations: true } } },
  });

  if (!planPurchase) {
    return;
  }

  const period = invoice.lines.data[0]?.period;
  const periodStart = period ? new Date(period.start * 1000) : new Date(invoice.created * 1000);
  const periodEnd = period ? new Date(period.end * 1000) : null;

  await prisma.planPurchase.update({
    where: { id: planPurchase.id },
    data: {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      stripeInvoiceId: invoice.id,
      metadata: {
        ...(planPurchase.metadata as Record<string, unknown> | null),
        lastInvoiceId: invoice.id,
      },
    },
  });

  const definition = getPlanDefinition(planPurchase.plan.slug);

  await applyPlanAllocations({
    plan: planPurchase.plan,
    planPurchase,
    purchasedAt: new Date(invoice.created * 1000),
    behavior: definition?.behavior,
    referenceId: invoice.id,
    reason: `${planPurchase.plan.name}の月次請求`,
  });
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const planPurchase = await prisma.planPurchase.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!planPurchase) {
    return;
  }

  await prisma.planPurchase.update({
    where: { id: planPurchase.id },
    data: {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      nextBillingAt: new Date(subscription.current_period_end * 1000),
      metadata: {
        ...(planPurchase.metadata as Record<string, unknown> | null),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    },
  });
}

function ensureOrigin(origin: string) {
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    return origin;
  }
  return `https://${origin}`;
}

function isDeletedStripeCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): customer is Stripe.DeletedCustomer {
  return "deleted" in customer && customer.deleted === true;
}

async function getOrCreateStripeCustomer(context: CustomerContext, stripe: Stripe): Promise<string> {
  if (context.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(context.stripeCustomerId);
      if (!isDeletedStripeCustomer(existing)) {
        return context.stripeCustomerId;
      }
    } catch (error) {
      // continue to creation
    }
  }

  const customer = await stripe.customers.create({
    email: context.email ?? undefined,
    name: context.fullName || undefined,
    metadata: {
      tenantId: context.tenantId,
      customerId: context.id,
      locationId: context.locationId,
    },
  });

  await prisma.customer.update({
    where: { id: context.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

async function fetchStripePrices(priceIds: string[]): Promise<Record<string, Stripe.Price>> {
  if (priceIds.length === 0) {
    return {};
  }

  try {
    const stripe = getStripeClient();
    const map: Record<string, Stripe.Price> = {};

    await Promise.all(
      priceIds.map(async (priceId) => {
        try {
          const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
          map[price.id] = price;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("Failed to retrieve Stripe price", priceId, error);
        }
      }),
    );

    return map;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Stripe client unavailable for price fetch", error);
    return {};
  }
}

async function assertStripePriceExists(stripe: Stripe, priceId: string) {
  try {
    await stripe.prices.retrieve(priceId, { expand: ["product"] });
  } catch (error) {
    if (isMissingStripePriceError(error)) {
      throw new Error("PRICE_NOT_CONFIGURED");
    }
    throw error;
  }
}

function isMissingStripePriceError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: string;
    raw?: { code?: string; param?: string };
  } & Partial<Error>;

  const code = maybeError.code ?? maybeError.raw?.code;
  const param = maybeError.raw?.param;
  const message = typeof maybeError.message === "string" ? maybeError.message : "";

  if (code === "resource_missing" && (param === "price" || message.includes("No such price"))) {
    return true;
  }

  return false;
}

async function applyPlanAllocations(options: {
  plan: Plan & { allocations: PlanCreditAllocation[] };
  planPurchase: PlanPurchase;
  purchasedAt: Date;
  behavior?: PlanBehavior;
  referenceId: string;
  reason: string;
}) {
  const { plan, planPurchase, purchasedAt, behavior, referenceId, reason } = options;

  if (plan.allocations.length === 0) {
    return;
  }

  const shouldDeferCurrent =
    Boolean(behavior?.deferCurrentAllocationAfter21) && isAfter21Cutoff(purchasedAt);

  const entries: Prisma.CreditLedgerEntryCreateManyInput[] = [];

  for (const allocation of plan.allocations) {
    if (allocation.bucket === "CURRENT" && shouldDeferCurrent) {
      continue;
    }

    entries.push({
      tenantId: planPurchase.tenantId,
      customerId: planPurchase.customerId,
      planPurchaseId: planPurchase.id,
      locationId: planPurchase.locationId,
      bucket: allocation.bucket,
      creditType: allocation.creditType,
      quantity: allocation.quantity,
      eventType: "PURCHASE_ALLOCATION",
      occurredAt: computeAllocationDate(allocation, purchasedAt),
      memo: `${reason} (ref: ${referenceId})`,
    });
  }

  if (entries.length === 0) {
    return;
  }

  await prisma.creditLedgerEntry.createMany({ data: entries });
}

function computeAllocationDate(allocation: PlanCreditAllocation, purchasedAt: Date) {
  if (allocation.bucket === "IMMEDIATE") {
    return purchasedAt;
  }

  if (allocation.bucket === "CURRENT") {
    return purchasedAt;
  }

  const base = startOfMonth(addMonths(purchasedAt, 1));

  if (allocation.effectiveDay && allocation.effectiveDay >= 1 && allocation.effectiveDay <= 31) {
    return set(base, { date: allocation.effectiveDay, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
  }

  return base;
}

function isAfter21Cutoff(date: Date) {
  const millis = date.getTime();
  const jstMillis = millis + JST_OFFSET_MINUTES * 60 * 1000;
  const jstDate = new Date(jstMillis);
  const cutoff = Date.UTC(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), 22, 0, 0, 0);
  return jstMillis >= cutoff;
}
