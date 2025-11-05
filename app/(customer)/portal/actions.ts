"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";

import { getServerAuthSession } from "@/lib/auth";
import { BookingError, cancelBookingForCustomer } from "@/server/bookings";

const ERROR_QUERY: Record<BookingError["code"] | "UNKNOWN" | "MISSING_BOOKING", string> = {
  SLOT_NOT_FOUND: "slot_missing",
  SLOT_UNAVAILABLE: "slot_unavailable",
  NO_AVAILABLE_CREDIT: "no_credit",
  CUSTOMER_NOT_FOUND: "no_customer",
  BOOKING_NOT_FOUND: "not_found",
  BOOKING_NOT_CANCELLABLE: "not_cancellable",
  CANCELLATION_WINDOW_CLOSED: "window_closed",
  LOCATION_MISMATCH: "location_mismatch",
  UNKNOWN: "unknown",
  MISSING_BOOKING: "missing",
};

function normalizeRedirectPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.length === 0) {
    return "/portal";
  }

  return value.startsWith("/portal") ? value : "/portal";
}

export async function cancelBookingAction(formData: FormData) {
  const bookingId = formData.get("bookingId");
  const redirectTo = normalizeRedirectPath(formData.get("redirectTo"));

  if (typeof bookingId !== "string" || bookingId.length === 0) {
    redirect(`${redirectTo}?cancel_error=${ERROR_QUERY.MISSING_BOOKING}`);
  }

  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  try {
    const result = await cancelBookingForCustomer({
      bookingId,
      userId: session.user.id,
    });

    revalidatePath("/portal");
    revalidatePath("/portal/bookings");
    revalidatePath("/bookings");
    revalidatePath("/dashboard");

    const query = result.creditRestored ? "refunded" : "consumed";
    redirect(`${redirectTo}?cancelled=${query}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const code = error instanceof BookingError ? error.code : "UNKNOWN";
    const mapped = ERROR_QUERY[code] ?? ERROR_QUERY.UNKNOWN;
    redirect(`${redirectTo}?cancel_error=${mapped}`);
  }
}
