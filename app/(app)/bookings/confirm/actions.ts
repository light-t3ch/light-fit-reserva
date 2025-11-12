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
  LOCATION_MISMATCH: "location_mismatch",
  UNKNOWN: "unknown",
};

export async function confirmBookingAction(formData: FormData) {
  const slotId = formData.get("slotId");
  const requestedBasePath = formData.get("basePath");

  const normalizedBasePath = (() => {
    if (typeof requestedBasePath !== "string" || requestedBasePath.length === 0) {
      return "/bookings";
    }
    const withLeading = requestedBasePath.startsWith("/") ? requestedBasePath : `/${requestedBasePath}`;
    const trimmed = withLeading.replace(/\/$/, "");
    return ["/bookings", "/portal/bookings"].includes(trimmed) ? trimmed : "/bookings";
  })();

  if (typeof slotId !== "string" || slotId.length === 0) {
    redirect(`${normalizedBasePath}?error=slot_missing`);
  }

  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  try {
    const booking = await createBookingFromSlot({ slotId, userId: session.user.id });

    revalidatePath(normalizedBasePath);
    revalidatePath("/portal");
    revalidatePath("/dashboard");

    redirect(`${normalizedBasePath}/complete?bookingId=${booking.id}`);
  } catch (error) {
    const code = error instanceof BookingError ? error.code : "UNKNOWN";
    const mapped = ERROR_REDIRECTS[code] ?? ERROR_REDIRECTS.UNKNOWN;
    redirect(`${normalizedBasePath}/confirm?slot=${encodeURIComponent(slotId)}&error=${mapped}`);
  }
}
