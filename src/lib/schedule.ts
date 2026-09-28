import { addDays, differenceInCalendarDays, format, parseISO, startOfDay, startOfWeek } from "date-fns";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Swatch = {
  id: string;
  name: string;
  bg: string;
  fg: string;
};

/** Fifteen bar colours. Dark text so the pastel stays readable. */
export const PALETTE: Swatch[] = [
  { id: "mint", name: "Mint", bg: "#5eecc0", fg: "#0f3d2e" },
  { id: "clay", name: "Clay", bg: "#ffb088", fg: "#6b2b12" },
  { id: "sky", name: "Sky", bg: "#9fd0ff", fg: "#16325c" },
  { id: "gold", name: "Gold", bg: "#ffe08a", fg: "#5c3b07" },
  { id: "lilac", name: "Lilac", bg: "#d7c0ff", fg: "#3b2170" },
  { id: "pink", name: "Pink", bg: "#f9a8d4", fg: "#6b2148" },
  { id: "leaf", name: "Leaf", bg: "#86efac", fg: "#14532d" },
  { id: "coral", name: "Coral", bg: "#ff8b7a", fg: "#7f1d1d" },
  { id: "ice", name: "Ice", bg: "#7dd3fc", fg: "#0c4a6e" },
  { id: "lime", name: "Lime", bg: "#d9f99d", fg: "#3f6212" },
  { id: "amber", name: "Amber", bg: "#fcd34d", fg: "#78350f" },
  { id: "violet", name: "Violet", bg: "#c4b5fd", fg: "#4c1d95" },
  { id: "rose", name: "Rose", bg: "#fda4af", fg: "#9f1239" },
  { id: "teal", name: "Teal", bg: "#5eead4", fg: "#115e59" },
  { id: "peach", name: "Peach", bg: "#fdba74", fg: "#9a3412" },
];

export type TradeDef = {
  id: string;
  label: string;
  color: string;
};

export const NEW_TRADE = "__new__";

export const TRADES: TradeDef[] = [
  { id: "site-setup", label: "Site set up", color: "mint" },
  { id: "demolition", label: "Demolition", color: "coral" },
  { id: "excavation", label: "Excavation", color: "clay" },
  { id: "drainage", label: "Drainage", color: "lime" },
  { id: "formwork", label: "Formwork", color: "gold" },
  { id: "concrete", label: "Concrete", color: "sky" },
  { id: "bricklayer", label: "Bricklayer", color: "peach" },
  { id: "framing", label: "Framing", color: "amber" },
  { id: "roofer", label: "Roofer", color: "lilac" },
  { id: "scaffold", label: "Scaffold", color: "rose" },
  { id: "waterproofing", label: "Waterproofing", color: "teal" },
  { id: "plumbing", label: "Plumbing", color: "ice" },
  { id: "electrical", label: "Electrical", color: "gold" },
  { id: "hvac", label: "HVAC", color: "violet" },
  { id: "insulation", label: "Insulation", color: "leaf" },
  { id: "plasterer", label: "Plasterer", color: "pink" },
  { id: "joiner", label: "Joiner", color: "amber" },
  { id: "glazier", label: "Glazier", color: "ice" },
  { id: "tiler", label: "Tiler", color: "pink" },
  { id: "flooring", label: "Flooring", color: "peach" },
  { id: "painter", label: "Painter", color: "rose" },
  { id: "fit-off", label: "Fit off", color: "leaf" },
  { id: "fencing", label: "Fencing", color: "mint" },
  { id: "landscaping", label: "Landscaping", color: "lime" },
  { id: "certifier", label: "Certifier inspection", color: "violet" },
];

const LEGACY_TRADE: Record<string, string> = {
  setup: "site-setup",
  earth: "excavation",
  frame: "framing",
  roof: "roofer",
  services: "plumbing",
  finish: "fit-off",
};

export type Task = {
  id: string;
  name: string;
  trade: string;
  /** Palette id. Omitted when the bar uses the trade’s own colour. */
  color?: string;
  /** Inclusive yyyy-MM-dd */
  start: string;
  /** Inclusive yyyy-MM-dd */
  end: string;
  crew: string;
  notes: string;
};

export function findTrade(id: string, custom: TradeDef[] = []) {
  return TRADES.find((trade) => trade.id === id) ?? custom.find((trade) => trade.id === id);
}

export function tradeLabel(id: string, custom: TradeDef[] = []) {
  return findTrade(id, custom)?.label ?? "Trade";
}

export function swatchById(id: string) {
  return PALETTE.find((swatch) => swatch.id === id) ?? PALETTE[0];
}

export function swatchFor(task: { trade: string; color?: string }, custom: TradeDef[] = []) {
  const trade = findTrade(task.trade, custom);
  return swatchById(task.color || trade?.color || PALETTE[0].id);
}

export function iso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function inclusiveDays(start: string, end: string) {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
}

export function shiftIso(day: string, amount: number) {
  return iso(addDays(parseISO(day), amount));
}

/** Monday-start window with today sitting in the middle week when 3 weeks fit. */
export function defaultAnchor(dayCount: number, today: Date) {
  const monday = startOfWeek(startOfDay(today), { weekStartsOn: 1 });
  return dayCount >= 21 ? addDays(monday, -7) : monday;
}

function task(
  name: string,
  trade: string,
  start: string,
  end: string,
  crew = "",
  notes = "",
): Task {
  return {
    id: `sample-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    trade,
    start,
    end,
    crew,
    notes,
  };
}

export function sampleProgramme(today = new Date()) {
  const monday = startOfWeek(startOfDay(today), { weekStartsOn: 1 });
  const d = (offset: number) => iso(addDays(monday, offset));
  return {
    jobName: "14 Mercer St — rear extension",
    tasks: [
      task("Site set up", "site-setup", d(-7), d(-5), "2 hands", "Fence, shed, temp power"),
      task("Demolition", "demolition", d(-5), d(-3), "", "Strip the rear lean-to"),
      task("Excavation", "excavation", d(-3), d(2), "3t digger", "Footprint and spoil away"),
      task("Piers", "concrete", d(1), d(4)),
      task("Slab prep", "concrete", d(3), d(6), "", "Membrane, mesh, chairs"),
      task("Pour", "concrete", d(7), d(7), "Pump booked"),
      task("Frame", "framing", d(8), d(16), "Chippy crew"),
      task("Roof", "roofer", d(14), d(19)),
      task("Rough-in electrical", "electrical", d(16), d(21)),
      task("Rough-in plumbing", "plumbing", d(16), d(20)),
      task("Lock-up", "fit-off", d(20), d(24)),
    ],
  };
}

function tradeIdFromLabel(label: string, taken: Set<string>) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "trade";
  let id = base === NEW_TRADE ? "trade" : base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

type ScheduleState = {
  jobName: string;
  tasks: Task[];
  anchor: string | null;
  customTrades: TradeDef[];
  setJobName: (name: string) => void;
  setAnchor: (anchor: string) => void;
  saveTask: (task: Task) => void;
  moveTask: (id: string, start: string, end: string) => void;
  reorderTask: (id: string, toIndex: number) => void;
  removeTask: (id: string) => void;
  addTrade: (label: string, color: string) => string;
  loadSample: () => void;
};

const initial = sampleProgramme();

type PersistedSchedule = {
  jobName?: string;
  tasks?: Task[];
  anchor?: string | null;
  customTrades?: TradeDef[];
};

export const useSchedule = create<ScheduleState>()(
  persist(
    (set) => ({
      jobName: initial.jobName,
      tasks: initial.tasks,
      anchor: null,
      customTrades: [],
      setJobName: (jobName) => set({ jobName }),
      setAnchor: (anchor) => set({ anchor }),
      saveTask: (next) =>
        set((state) => {
          const exists = state.tasks.some((item) => item.id === next.id);
          return {
            tasks: exists
              ? state.tasks.map((item) => (item.id === next.id ? next : item))
              : [...state.tasks, next],
          };
        }),
      moveTask: (id, start, end) =>
        set((state) => ({
          tasks: state.tasks.map((item) => (item.id === id ? { ...item, start, end } : item)),
        })),
      reorderTask: (id, toIndex) =>
        set((state) => {
          const from = state.tasks.findIndex((item) => item.id === id);
          if (from < 0 || toIndex < 0 || toIndex >= state.tasks.length || from === toIndex) return {};
          const tasks = [...state.tasks];
          const [item] = tasks.splice(from, 1);
          tasks.splice(toIndex, 0, item);
          return { tasks };
        }),
      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((item) => item.id !== id) })),
      addTrade: (label, color) => {
        const trimmed = label.trim();
        let id = "";
        set((state) => {
          const known = [...TRADES, ...state.customTrades];
          const match = known.find((trade) => trade.label.toLowerCase() === trimmed.toLowerCase());
          if (match) {
            id = match.id;
            return {};
          }
          id = tradeIdFromLabel(trimmed, new Set(known.map((trade) => trade.id)));
          return { customTrades: [...state.customTrades, { id, label: trimmed, color }] };
        });
        return id;
      },
      loadSample: () => {
        const next = sampleProgramme();
        set({ jobName: next.jobName, tasks: next.tasks, anchor: null });
      },
    }),
    {
      name: "yardline-v1",
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as PersistedSchedule;
        let tasks = state.tasks ?? [];
        if (version < 1) {
          tasks = tasks.map((item) => {
            const trade = LEGACY_TRADE[item.trade] ?? item.trade;
            return trade === item.trade ? item : { ...item, trade };
          });
        }
        if (version < 2) {
          tasks = [...tasks].sort(
            (a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name),
          );
        }
        return { ...state, customTrades: state.customTrades ?? [], tasks };
      },
    },
  ),
);
