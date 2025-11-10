"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeRedirectPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.length === 0) {
    return "/customers";
  }
  return value.startsWith("/customers") ? value : "/customers";
}

export async function updateCustomerLocationAction(formData: FormData) {
  const customerId = formData.get("customerId");
  const locationId = formData.get("locationId");
  const redirectTo = normalizeRedirectPath(formData.get("redirectTo"));

  if (typeof customerId !== "string" || customerId.length === 0) {
    redirect(`${redirectTo}?error=missing_customer`);
  }

  const session = await getServerAuthSession();

  if (!session?.user?.id || session.user.role === "CUSTOMER") {
    redirect("/auth/sign-in");
  }

  const tenantId = session.user.tenantId;

  if (!tenantId) {
    redirect(`${redirectTo}?error=unauthorized`);
  }

  const adminLocationId = session.user.locationId;

  const [customer, newLocation] = await Promise.all([
    prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
        ...(adminLocationId ? { locationId: adminLocationId } : {}),
      },
      select: { id: true, locationId: true },
    }),
    typeof locationId === "string" && locationId.length > 0
      ? prisma.location.findFirst({
          where: { id: locationId, tenantId },
          select: { id: true },
        })
      : null,
  ]);

  if (!customer) {
    redirect(`${redirectTo}?error=not_found`);
  }

  if (!newLocation) {
    redirect(`${redirectTo}?error=invalid_location`);
  }

  if (customer.locationId === newLocation.id) {
    redirect(`${redirectTo}?updated=1`);
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { locationId: newLocation.id },
  });

  revalidatePath("/customers");
  revalidatePath("/portal");
  revalidatePath("/dashboard");

  redirect(`${redirectTo}?updated=1`);
}
