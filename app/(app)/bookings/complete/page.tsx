import { BookingCompletePageView } from "@/views/bookings/complete-page-view";

type PageProps = {
  searchParams?: {
    bookingId?: string;
  };
};

export default async function BookingCompletePage({ searchParams }: PageProps) {
  return <BookingCompletePageView basePath="/bookings" searchParams={searchParams} />;
}
