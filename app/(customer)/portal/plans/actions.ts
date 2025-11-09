"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { createCheckoutSessionForPlan } from "@/server/plan-purchases";

function getOrigin() {
  const headersList = headers();
  const proto = headersList.get("x-forwarded-proto") ?? headersList.get("x-forwarded-protocol") ?? "https";
  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("x-forwarded-hostname") ?? headersList.get("host");

  if (!host) {
    return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  }

  return `${proto}://${host}`;
}

const ERROR_CODES: Record<string, string> = {
  CUSTOMER_NOT_FOUND: "customer_missing",
  PLAN_NOT_AVAILABLE: "plan_unavailable",
  PLAN_NOT_AVAILABLE_FOR_LOCATION: "plan_location",
  CHECKOUT_METADATA_INCOMPLETE: "metadata",
};

export async function startPlanCheckout(formData: FormData) {
  const planSlug = formData.get("plan")?.toString();

  if (!planSlug) {
    redirect("/portal/plans?error=plan_required");
  }

  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  if (session.user.role !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const origin = getOrigin();

  try {
    const checkout = await createCheckoutSessionForPlan({
      userId: session.user.id,
      planSlug: planSlug!,
      origin,
    });

    if (!checkout?.url) {
      redirect("/portal/plans?error=checkout_unavailable");
    }

    redirect(checkout.url);
  } catch (error) {
    const message = (error as Error).message;
    const code = ERROR_CODES[message] ?? "unknown";
    redirect(`/portal/plans?error=${code}`);
  }
}
