export type RevenueItem = {
  label: string;
  amount: number;
  deltaPercentage: number;
};

export type UpcomingBooking = {
  id: string;
  customerName: string;
  trainerName: string;
  locationName: string;
  menu: string;
  start: string;
  status: "BOOKED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED";
};

export async function getRevenueBreakdown(tenantId: string): Promise<RevenueItem[]> {
  return [
    { label: "今月の売上", amount: 1280000, deltaPercentage: 12.5 },
    { label: "サブスク", amount: 960000, deltaPercentage: 8.1 },
    { label: "都度利用", amount: 320000, deltaPercentage: 25.4 },
  ];
}

export async function getUpcomingBookings(tenantId: string): Promise<UpcomingBooking[]> {
  return [
    {
      id: "booking_1",
      customerName: "田中 実",
      trainerName: "山田 太郎",
      locationName: "本町店",
      menu: "55分パーソナルトレーニング",
      start: new Date().toISOString(),
      status: "BOOKED",
    },
    {
      id: "booking_2",
      customerName: "鈴木 詩織",
      trainerName: "佐藤 花子",
      locationName: "阿波座店",
      menu: "25分パーソナルトレーニング",
      start: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
      status: "BOOKED",
    },
  ];
}
