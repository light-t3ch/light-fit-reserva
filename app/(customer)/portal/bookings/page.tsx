import { BookingPageView } from "@/views/bookings/booking-page-view";

type PageProps = {
  searchParams?: { error?: string };
};

export default async function CustomerBookingPage({ searchParams }: PageProps) {
  return <BookingPageView basePath="/portal/bookings" searchParams={searchParams} />;
}
