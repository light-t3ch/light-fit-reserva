import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleSubscriptionUpdated,
} from "@/server/plan-purchases";

const RELEVANT_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "invoice.paid",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: NextRequest) {
  const configuredSecrets = (process.env.STRIPE_WEBHOOK_SECRET ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (configuredSecrets.length === 0) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = getStripeClient();

  let event: Stripe.Event | null = null;
  const payload = await request.text();

  let verificationError: unknown;

  for (const secret of configuredSecrets) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
      verificationError = undefined;
      break;
    } catch (error) {
      verificationError = error;
    }
  }

  if (!event) {
    // eslint-disable-next-line no-console
    console.error("Stripe webhook signature verification failed", verificationError);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const verifiedEvent = event;

  if (!RELEVANT_EVENTS.has(verifiedEvent.type)) {
    return NextResponse.json({ received: true });
  }

  try {
    const shouldProcess = await logStripeEvent(verifiedEvent);

    if (!shouldProcess) {
      return NextResponse.json({ received: true });
    }

    switch (verifiedEvent.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(verifiedEvent.data.object as Stripe.Checkout.Session);
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(verifiedEvent.data.object as Stripe.Invoice);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionUpdated(verifiedEvent.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Stripe webhook handling failed", error);
    await prisma.stripeEventLog
      .delete({ where: { id: verifiedEvent.id } })
      .catch(() => undefined);

    return NextResponse.json({ error: "Webhook handling error." }, { status: 500 });
  }
}

async function logStripeEvent(event: Stripe.Event) {
  try {
    await prisma.stripeEventLog.create({
      data: {
        id: event.id,
        type: event.type,
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}
