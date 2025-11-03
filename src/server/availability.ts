import { addMinutes, formatISO, set } from "date-fns";

export type TrainerAvailabilitySlot = {
  slotId: string;
  start: string;
  end: string;
  durationMinutes: number;
  isBookable: boolean;
  bookingType: "PT_55" | "PT_25" | "COUNSELING" | "TRIAL";
};

export type TrainerAvailability = {
  trainerId: string;
  trainerName: string;
  locationName: string;
  slots: TrainerAvailabilitySlot[];
};

export async function getTenantAvailability(tenantId: string): Promise<TrainerAvailability[]> {
  const baseDate = set(new Date(), { hours: 7, minutes: 0, seconds: 0, milliseconds: 0 });
  const trainers = [
    { id: "trainer_1", name: "山田 太郎", location: "本町店" },
    { id: "trainer_2", name: "佐藤 花子", location: "阿波座店" },
  ];

  return trainers.map((trainer, idx) => {
    const firstSlotStart = addMinutes(baseDate, idx * 60);
    const slots: TrainerAvailabilitySlot[] = Array.from({ length: 6 }).map((_, slotIdx) => {
      const start = addMinutes(firstSlotStart, slotIdx * 60);
      const durationMinutes = slotIdx % 2 === 0 ? 55 : 25;
      const bookingType = durationMinutes === 55 ? "PT_55" : "PT_25";
      const end = addMinutes(start, durationMinutes);
      return {
        slotId: `${trainer.id}_${formatISO(start)}`,
        start: start.toISOString(),
        end: end.toISOString(),
        durationMinutes,
        bookingType,
        isBookable: slotIdx !== 2,
      } satisfies TrainerAvailabilitySlot;
    });

    return {
      trainerId: trainer.id,
      trainerName: trainer.name,
      locationName: trainer.location,
      slots,
    } satisfies TrainerAvailability;
  });
}
