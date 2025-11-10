import { ConfirmBookingPageView } from "@/views/bookings/confirm-page-view";

type PageProps = {
  searchParams?: {
    slot?: string;
    error?: string;
  };
};

export default async function CustomerConfirmBookingPage({ searchParams }: PageProps) {
  return <ConfirmBookingPageView basePath="/portal/bookings" searchParams={searchParams} />;
}
