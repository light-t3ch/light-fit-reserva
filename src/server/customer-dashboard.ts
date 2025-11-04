export type CustomerUpcomingSession = {
  id: string;
  trainerName: string;
  locationName: string;
  menu: string;
  start: string;
  status: "BOOKED" | "PENDING" | "COMPLETED" | "CANCELLED";
};

export async function getCustomerUpcomingSessions(
  userId: string,
): Promise<CustomerUpcomingSession[]> {
  const base = Date.now();
  return [
    {
      id: `${userId}-session-1`,
      trainerName: "山田 太郎",
      locationName: "阿波座店",
      menu: "55分パーソナルトレーニング",
      start: new Date(base + 1000 * 60 * 60 * 24).toISOString(),
      status: "BOOKED",
    },
    {
      id: `${userId}-session-2`,
      trainerName: "佐藤 花子",
      locationName: "本町店",
      menu: "25分パーソナルトレーニング",
      start: new Date(base + 1000 * 60 * 60 * 24 * 3).toISOString(),
      status: "PENDING",
    },
  ];
}
