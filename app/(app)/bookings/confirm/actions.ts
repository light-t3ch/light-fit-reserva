"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { BookingError, createBookingFromSlot } from "@/server/bookings";

const ERROR_REDIRECTS: Record<string, string> = {
  SLOT_NOT_FOUND: "slot_missing",
  SLOT_UNAVAILABLE: "slot_unavailable",
  NO_AVAILABLE_CREDIT: "no_credit",
  CUSTOMER_NOT_FOUND: "no_customer",
  UNKNOWN: "unknown",
};

export async function confirmBookingAction(formData: FormData) {
  const slotId = formData.get("slotId");

  if (typeof slotId !== "string" || slotId.length === 0) {
    redirect("/bookings?error=slot_missing");
  }

  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  try {
    const booking = await createBookingFromSlot({ slotId, userId: session.user.id });

    revalidatePath("/bookings");
    revalidatePath("/portal");
    revalidatePath("/dashboard");

    redirect(`/bookings/complete?bookingId=${booking.id}`);
  } catch (error) {
    const code = error instanceof BookingError ? error.code : "UNKNOWN";
    const mapped = ERROR_REDIRECTS[code] ?? ERROR_REDIRECTS.UNKNOWN;
    redirect(`/bookings/confirm?slot=${encodeURIComponent(slotId)}&error=${mapped}`);
  }
}
