import { BookingCompletePageView } from "@/views/bookings/complete-page-view";

type PageProps = {
  searchParams?: {
    bookingId?: string;
  };
};

export default async function CustomerBookingCompletePage({ searchParams }: PageProps) {
  return <BookingCompletePageView basePath="/portal/bookings" searchParams={searchParams} />;
}
