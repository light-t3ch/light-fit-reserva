import Stripe from "stripe";

export function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY が設定されていません。");
  }

  return new Stripe(apiKey, {
    apiVersion: "2023-10-16",
  });
}
