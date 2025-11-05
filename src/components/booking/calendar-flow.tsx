"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ja } from "date-fns/locale";

import type { TrainerAvailability } from "@/server/availability";

const MENU_LABELS: Record<string, { label: string; description: string; duration: string }> = {
  PT_55: {
    label: "55分パーソナルトレーニング",
    description: "標準的なパーソナルトレーニングセッション",
    duration: "55分",
  },
  PT_25: {
    label: "25分パーソナルトレーニング",
    description: "短時間で効率よくトレーニング",
    duration: "25分",
  },
  COUNSELING: {
    label: "カウンセリング",
    description: "初回のカウンセリング・ご相談にご利用ください",
    duration: "35分",
  },
  TRIAL_90: {
    label: "体験パーソナル 90分",
    description: "初めてのお客様向けの体験プログラム",
    duration: "90分",
  },
  TRIAL: {
    label: "体験パーソナル",
    description: "体験セッションをご希望のお客様向け",
    duration: "55分",
  },
  ENROLLMENT: {
    label: "入会時セッション",
    description: "入会時の特別セッションやオリエンテーション",
    duration: "55分",
  },
};

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

type BookingCalendarFlowProps = {
  availability: TrainerAvailability[];
  basePath: string;
};

type TrainerOption = {
  id: string;
  name: string;
  location: string;
  slotCount: number;
};

type SlotView = {
  slotId: string;
  trainerId: string;
  trainerName: string;
  locationName: string;
  start: string;
  end: string;
  bookingType: string;
  durationMinutes: number;
  isBookable: boolean;
};

function buildTrainerOptions(availability: TrainerAvailability[]): TrainerOption[] {
  const trainers = availability.map((trainer) => ({
    id: trainer.trainerId,
    name: trainer.trainerName,
    location: trainer.locationName,
    slotCount: trainer.slots.filter((slot) => slot.isBookable).length,
  }));

  const totalSlots = trainers.reduce((sum, trainer) => sum + trainer.slotCount, 0);

  return [
    {
      id: "any",
      name: "指名なし",
      location: "全スタッフから自動で割り当て",
      slotCount: totalSlots,
    },
    ...trainers,
  ];
}

function buildSlotViews(availability: TrainerAvailability[]): SlotView[] {
  return availability.flatMap((trainer) =>
    trainer.slots.map((slot) => ({
      slotId: slot.slotId,
      trainerId: trainer.trainerId,
      trainerName: trainer.trainerName,
      locationName: trainer.locationName,
      start: slot.start,
      end: slot.end,
      bookingType: slot.bookingType,
      durationMinutes: slot.durationMinutes,
      isBookable: slot.isBookable,
    })),
  );
}

function uniqueBookingTypes(slots: SlotView[]) {
  return Array.from(new Set(slots.filter((slot) => slot.isBookable).map((slot) => slot.bookingType)));
}

function getMenuOptions(slots: SlotView[], selectedTrainerId: string) {
  const filtered =
    selectedTrainerId === "any" ? slots : slots.filter((slot) => slot.trainerId === selectedTrainerId);

  const types = uniqueBookingTypes(filtered);

  return types.map((type) => ({
    value: type,
    ...(MENU_LABELS[type] ?? { label: type, description: "", duration: "" }),
  }));
}

type CalendarCell = {
  date: Date;
  inMonth: boolean;
  hasAvailability: boolean;
};

function buildCalendarMatrix(month: Date, availableDates: Date[]): CalendarCell[][] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) =>
    days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => ({
      date: day,
      inMonth: isSameMonth(day, monthStart),
      hasAvailability: availableDates.some((available) => isSameDay(available, day)),
    })),
  );
}

function formatTimeRange(startIso: string, endIso: string) {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  return `${format(start, "HH:mm", { locale: ja })}〜${format(end, "HH:mm", { locale: ja })}`;
}

export function BookingCalendarFlow({ availability, basePath }: BookingCalendarFlowProps) {
  const slotViews = useMemo(() => buildSlotViews(availability), [availability]);
  const trainerOptions = useMemo(() => buildTrainerOptions(availability), [availability]);

  const [selectedTrainer, setSelectedTrainer] = useState(() => trainerOptions[0]?.id ?? "any");
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const menuOptions = useMemo(() => getMenuOptions(slotViews, selectedTrainer), [slotViews, selectedTrainer]);

  useEffect(() => {
    if (!selectedMenu && menuOptions.length > 0) {
      setSelectedMenu(menuOptions[0].value);
    }
    if (selectedMenu && menuOptions.every((option) => option.value !== selectedMenu)) {
      setSelectedMenu(menuOptions[0]?.value ?? null);
    }
  }, [menuOptions, selectedMenu]);

  const availableSlots = useMemo(() => {
    const effectiveMenu = selectedMenu ?? menuOptions[0]?.value ?? null;

    if (!effectiveMenu) {
      return [];
    }

    const filteredByTrainer =
      selectedTrainer === "any"
        ? slotViews
        : slotViews.filter((slot) => slot.trainerId === selectedTrainer);

    return filteredByTrainer
      .filter((slot) => slot.bookingType === effectiveMenu && slot.isBookable)
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  }, [slotViews, selectedTrainer, selectedMenu, menuOptions]);

  const availableDates = useMemo(() => {
    return Array.from(
      new Set(
        availableSlots.map((slot) => {
          const date = parseISO(slot.start);
          return format(date, "yyyy-MM-dd");
        }),
      ),
    )
      .map((dateString) => parseISO(`${dateString}T00:00:00`))
      .sort((a, b) => a.getTime() - b.getTime());
  }, [availableSlots]);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
      setVisibleMonth(availableDates[0]);
    }
    if (selectedDate && availableDates.length > 0) {
      const match = availableDates.find((date) => isSameDay(date, selectedDate));
      if (!match) {
        setSelectedDate(availableDates[0]);
        setVisibleMonth(availableDates[0]);
      }
    }
    if (availableDates.length === 0) {
      setSelectedDate(null);
    }
  }, [availableDates, selectedDate]);

  const handleTrainerChange = (trainerId: string) => {
    setSelectedTrainer(trainerId);
    setSelectedMenu(null);
    setSelectedDate(null);
  };

  const handleMenuChange = (menu: string) => {
    setSelectedMenu(menu);
    setSelectedDate(null);
  };

  const cells = useMemo(() => buildCalendarMatrix(visibleMonth, availableDates), [visibleMonth, availableDates]);

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return availableSlots.filter((slot) => slot.start.startsWith(dateKey));
  }, [availableSlots, selectedDate]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">STEP 1</span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">スタッフを選択</h2>
            <p className="mt-1 text-sm text-slate-600">指名なし、またはご希望のトレーナーをお選びください。</p>
          </div>
          <p className="hidden text-xs text-slate-500 md:block">空き枠 {trainerOptions[0]?.slotCount ?? 0} 件</p>
        </header>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {trainerOptions.map((trainer) => (
            <button
              key={trainer.id}
              type="button"
              onClick={() => handleTrainerChange(trainer.id)}
              className={`flex w-full flex-col rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selectedTrainer === trainer.id
                  ? "border-brand-400 bg-brand-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-brand-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{trainer.name}</p>
                <span className="text-xs font-medium text-brand-600">空き {trainer.slotCount} 件</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{trainer.location}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-3">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">STEP 2</span>
          <h2 className="text-lg font-bold text-slate-900">メニューを選択</h2>
        </header>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {menuOptions.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              選択したスタッフに予約可能なメニューがありません。
            </p>
          )}
          {menuOptions.map((menu) => (
            <button
              key={menu.value}
              type="button"
              onClick={() => handleMenuChange(menu.value)}
              className={`flex w-full flex-col rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                (selectedMenu ?? menuOptions[0]?.value) === menu.value
                  ? "border-brand-400 bg-brand-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-brand-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{menu.label}</p>
                {menu.duration && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-600">{menu.duration}</span>
                )}
              </div>
              {menu.description && <p className="mt-2 text-xs text-slate-500">{menu.description}</p>}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">STEP 3</span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">日時を選択</h2>
            <p className="mt-1 text-sm text-slate-600">カレンダーから日付を選び、下の一覧からご希望の時間をお選びください。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
            >
              前の月
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
            >
              次の月
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1.8fr]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {format(visibleMonth, "yyyy年M月", { locale: ja })}
              </div>
              <table className="w-full table-fixed border-collapse text-center text-sm">
                <thead>
                  <tr className="bg-white text-xs text-slate-500">
                    {WEEKDAY_LABELS.map((weekday) => (
                      <th key={weekday} className="px-2 py-2 font-medium">
                        {weekday}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cells.map((week, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      {week.map((cell) => {
                        const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
                        const disabled = !cell.hasAvailability;
                        return (
                          <td key={cell.date.toISOString()} className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (disabled) return;
                                setSelectedDate(cell.date);
                              }}
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                                isSelected
                                  ? "bg-brand-500 text-white"
                                  : disabled
                                    ? "text-slate-300"
                                    : "text-slate-700 hover:bg-brand-50 hover:text-brand-600"
                              } ${cell.inMonth ? "" : "opacity-40"}`}
                              disabled={disabled}
                            >
                              {format(cell.date, "d", { locale: ja })}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-slate-200">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {selectedDate
                  ? `${format(selectedDate, "M月d日 (EEE)", { locale: ja })} の空き枠`
                  : "日付を選択してください"}
              </div>
              <div className="space-y-3 p-4">
                {selectedDate && slotsForSelectedDate.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    選択した日付に予約可能な時間はありません。
                  </p>
                )}
                {!selectedDate && (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    カレンダーから日付を選択すると時間が表示されます。
                  </p>
                )}
                {slotsForSelectedDate.map((slot) => (
                  <Link
                    key={slot.slotId}
                    href={`${basePath}/confirm?slot=${encodeURIComponent(slot.slotId)}`}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                        {MENU_LABELS[slot.bookingType]?.duration ?? `${slot.durationMinutes}分`}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{formatTimeRange(slot.start, slot.end)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {selectedTrainer === "any" && <span>担当: {slot.trainerName}</span>}
                      <span>店舗: {slot.locationName}</span>
                    </div>
                  </Link>
                ))}
                {selectedDate && slotsForSelectedDate.length > 0 && (
                  <p className="pt-2 text-xs text-slate-500">※ 予約確認画面でお客様情報をご入力いただきます。</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
