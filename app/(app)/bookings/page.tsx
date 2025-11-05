import { BookingPageView } from "@/views/bookings/booking-page-view";

type PageProps = {
  searchParams?: { error?: string };
};

export default async function BookingPage({ searchParams }: PageProps) {
  return <BookingPageView basePath="/bookings" searchParams={searchParams} />;
}
