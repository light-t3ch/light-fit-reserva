import { ConfirmBookingPageView } from "@/views/bookings/confirm-page-view";

type PageProps = {
  searchParams?: {
    slot?: string;
    error?: string;
  };
};

export default async function ConfirmBookingPage({ searchParams }: PageProps) {
  return <ConfirmBookingPageView basePath="/bookings" searchParams={searchParams} />;
}
