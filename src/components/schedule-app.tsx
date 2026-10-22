import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Download, GripVertical, HardHat, Minus, Plus, X } from "lucide-react";
import { Link } from "react-router";
import {
  NEW_TRADE,
  PALETTE,
  TRADES,
  defaultAnchor,
  findTrade,
  inclusiveDays,
  iso,
  shiftIso,
  swatchFor,
  tradeLabel,
  useSchedule,
  type Task,
  type TradeDef,
} from "@/lib/schedule";
import { saveTradeSchedule } from "@/lib/save-schedule";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Draft = {
  id: string | null;
  name: string;
  trade: string;
  color: string;
  newTrade: string;
  start: string;
  end: string;
  crew: string;
  notes: string;
};

type BoardSize = { rail: number; compact: boolean };

const MIN_DAY = 20;
const MAX_DAY = 148;
const ROW_TALL = 56;
const ROW_SHORT = 28;
const PAST_DAYS = 120;
const FUTURE_DAYS = 240;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Pinching out (narrower days) shortens each row so more tasks fit. */
function rowHeightFor(dayWidth: number) {
  if (dayWidth >= 48) return ROW_TALL;
  const t = (dayWidth - MIN_DAY) / (48 - MIN_DAY);
  return Math.round(ROW_SHORT + clamp(t, 0, 1) * (ROW_TALL - ROW_SHORT));
}

function readBoardSize(): BoardSize {
  if (typeof window === "undefined") return { rail: 220, compact: false };
  const width = window.innerWidth;
  if (width < 640) return { rail: 112, compact: true };
  if (width < 1100) return { rail: 176, compact: false };
  return { rail: 220, compact: false };
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useBoardSize() {
  const [size, setSize] = useState(readBoardSize);
  useEffect(() => {
    const apply = () => setSize(readBoardSize());
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return size;
}

function dayFraction(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return (now.getTime() - start.getTime()) / 86_400_000;
}

function rangeLabel(start: Date, count: number) {
  const end = addDays(start, count - 1);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d")}–${format(end, "d MMM")}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
  }
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
}

function blankDraft(day: string): Draft {
  const trade = TRADES[0];
  return {
    id: null,
    name: "",
    trade: trade.id,
    color: trade.color,
    newTrade: "",
    start: day,
    end: day,
    crew: "",
    notes: "",
  };
}

function draftFromTask(task: Task, custom: TradeDef[]): Draft {
  const trade = findTrade(task.trade, custom);
  return {
    id: task.id,
    name: task.name,
    trade: trade?.id ?? TRADES[0].id,
    color: task.color || trade?.color || TRADES[0].color,
    newTrade: "",
    start: task.start,
    end: task.end,
    crew: task.crew,
    notes: task.notes,
  };
}

function TaskBar({
  task,
  origin,
  totalDays,
  dayWidth,
  rowHeight,
  onEdit,
}: {
  task: Task;
  origin: Date;
  totalDays: number;
  dayWidth: number;
  rowHeight: number;
  onEdit: () => void;
}) {
  const moveTask = useSchedule((state) => state.moveTask);
  const customTrades = useSchedule((state) => state.customTrades);
  const swatch = swatchFor(task, customTrades);
  const drag = useRef<{
    mode: "move" | "start" | "end";
    originX: number;
    start: string;
    end: string;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const startIndex = differenceInCalendarDays(parseISO(task.start), origin);
  const endIndex = differenceInCalendarDays(parseISO(task.end), origin);
  const days = inclusiveDays(task.start, task.end);
  const label = `${task.name}, ${tradeLabel(task.trade, customTrades)}, ${days} ${days === 1 ? "day" : "days"}`;

  if (endIndex < 0 || startIndex > totalDays - 1) {
    return (
      <p className="flex h-full items-center px-3 text-sm text-muted">
        {startIndex > totalDays - 1
          ? `Starts ${format(parseISO(task.start), "d MMM")}`
          : `Ended ${format(parseISO(task.end), "d MMM")}`}
      </p>
    );
  }

  const left = Math.max(0, startIndex);
  const right = Math.min(totalDays - 1, endIndex);
  const clipStart = startIndex < 0;
  const clipEnd = endIndex > totalDays - 1;
  const insetL = clipStart ? 0 : 3;
  const insetR = clipEnd ? 0 : 3;
  const barWidth = Math.max(8, (right - left + 1) * dayWidth - insetL - insetR);
  const barHeight = clamp(rowHeight - 14, 16, 36);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const edge = rect.width < 36 ? 0 : 12;
    const mode = x <= edge ? "start" : x >= rect.width - edge ? "end" : "move";
    drag.current = {
      mode,
      originX: event.clientX,
      start: task.start,
      end: task.end,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) return;
    event.stopPropagation();
    const delta = Math.round((event.clientX - current.originX) / dayWidth);
    if (Math.abs(event.clientX - current.originX) > 4) current.moved = true;
    if (current.mode === "move") {
      moveTask(task.id, shiftIso(current.start, delta), shiftIso(current.end, delta));
      return;
    }
    if (current.mode === "start") {
      const next = shiftIso(current.start, delta);
      moveTask(task.id, next > current.end ? current.end : next, current.end);
      return;
    }
    const next = shiftIso(current.end, delta);
    moveTask(task.id, current.start, next < current.start ? current.start : next);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    if (current && !current.moved) onEdit();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-task-bar
      title="Drag across the dates. Drag either end to change the length."
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      className={cx(
        "absolute top-1/2 z-10 flex -translate-y-1/2 cursor-grab items-center gap-2 overflow-hidden px-2 font-medium shadow-sm ring-1 ring-ink/10 touch-none select-none",
        barHeight < 24 ? "text-xs" : "text-sm",
        clipStart ? "rounded-l-none" : "rounded-l-md",
        clipEnd ? "rounded-r-none" : "rounded-r-md",
        dragging && "cursor-grabbing shadow-md",
      )}
      style={{
        left: left * dayWidth + insetL,
        width: barWidth,
        height: barHeight,
        backgroundColor: swatch.bg,
        color: swatch.fg,
      }}
    >
      <span className="pointer-events-none absolute inset-y-1.5 left-1 w-0.5 rounded-full bg-current opacity-40" />
      <span className="pointer-events-none absolute inset-y-1.5 right-1 w-0.5 rounded-full bg-current opacity-40" />
      <span className="truncate pl-1.5">{task.name}</span>
      {barWidth > 52 && (
        <span className="ml-auto shrink-0 pr-1.5 text-xs tabular-nums opacity-80">{days}d</span>
      )}
    </div>
  );
}

function TaskRail({
  task,
  customTrades,
  width,
  rowHeight,
  onEdit,
}: {
  task: Task;
  customTrades: TradeDef[];
  width: number;
  rowHeight: number;
  onEdit: () => void;
}) {
  const reorderTask = useSchedule((state) => state.reorderTask);
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const count = inclusiveDays(task.start, task.end);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const row = event.currentTarget.closest("[data-task-row]");
    drag.current = {
      y: event.clientY,
      height: row?.getBoundingClientRect().height || 56,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    event.stopPropagation();
    const shift = Math.round((event.clientY - current.y) / current.height);
    if (shift === 0) return;
    const tasks = useSchedule.getState().tasks;
    const from = tasks.findIndex((item) => item.id === task.id);
    const next = clamp(from + shift, 0, tasks.length - 1);
    if (from < 0 || next === from) return;
    current.moved = true;
    reorderTask(task.id, next);
    current.y += (next - from) * current.height;
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const tasks = useSchedule.getState().tasks;
    const from = tasks.findIndex((item) => item.id === task.id);
    const next = clamp(from + (event.key === "ArrowUp" ? -1 : 1), 0, tasks.length - 1);
    if (next !== from) reorderTask(task.id, next);
  }

  return (
    <div
      className={cx(
        "sticky left-0 z-20 flex shrink-0 border-r border-b border-line bg-paper touch-pan-y",
        dragging && "z-30 bg-paper-2 shadow-md",
      )}
      style={{ width, height: rowHeight }}
    >
      <button
        type="button"
        data-task-rail
        aria-label={`Reorder ${task.name}`}
        title="Drag up or down to reorder"
        className={cx(
          "grid w-9 shrink-0 cursor-grab place-items-center text-muted touch-none hover:text-ink",
          dragging && "cursor-grabbing text-ink",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-1 text-left hover:bg-paper-2"
        onClick={onEdit}
      >
        <span
          className="size-2.5 shrink-0 rounded-sm ring-1 ring-ink/10"
          style={{ backgroundColor: swatchFor(task, customTrades).bg }}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className={cx("block truncate font-medium", rowHeight < 40 ? "text-xs" : "text-sm")}>
            {task.name}
          </span>
          {rowHeight >= 40 && (
            <span className="block truncate text-xs text-muted">
              {count} {count === 1 ? "day" : "days"} · {tradeLabel(task.trade, customTrades)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function TaskDialog({
  draft,
  onClose,
}: {
  draft: Draft | null;
  onClose: () => void;
}) {
  const saveTask = useSchedule((state) => state.saveTask);
  const removeTask = useSchedule((state) => state.removeTask);
  const addTrade = useSchedule((state) => state.addTrade);
  const customTrades = useSchedule((state) => state.customTrades);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<Draft | null>(draft);
  const [synced, setSynced] = useState<Draft | null>(draft);
  if (draft !== synced) {
    setSynced(draft);
    setLocal(draft);
    setError(null);
  }

  return (
    <Dialog.Root open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed inset-x-3 top-8 z-50 mx-auto max-h-[calc(100dvh-4rem)] max-w-lg overflow-y-auto rounded-md bg-paper-2 p-5 shadow-md sm:top-1/2 sm:-translate-y-1/2">
          {local && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const name = local.name.trim();
                if (!name) {
                  setError("Give the task a name.");
                  return;
                }
                if (local.end < local.start) {
                  setError("The finish is before the start.");
                  return;
                }
                const creating = local.trade === NEW_TRADE;
                const newName = local.newTrade.trim();
                if (creating && !newName) {
                  setError("Name the new trade.");
                  return;
                }
                const tradeId = creating ? addTrade(newName, local.color) : local.trade;
                const trade = findTrade(tradeId, useSchedule.getState().customTrades);
                const color = trade && local.color !== trade.color ? local.color : undefined;
                saveTask({
                  id: local.id ?? crypto.randomUUID(),
                  name,
                  trade: tradeId,
                  color,
                  start: local.start,
                  end: local.end,
                  crew: local.crew.trim(),
                  notes: local.notes.trim(),
                });
                onClose();
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <Dialog.Title className="font-display text-3xl leading-none font-semibold tracking-wide">
                  {local.id ? "Edit task" : "New task"}
                </Dialog.Title>
                <Dialog.Close
                  type="button"
                  className="grid size-11 place-items-center rounded-md text-ink hover:bg-canvas"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </Dialog.Close>
              </div>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Site set up, excavation, a pour — whatever’s on the board.
              </Dialog.Description>

              <label className="mt-5 block text-sm font-medium" htmlFor="task-name">
                Task
              </label>
              <input
                id="task-name"
                autoFocus
                value={local.name}
                placeholder="Excavation"
                onChange={(event) => setLocal({ ...local, name: event.target.value })}
                className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-base outline-none focus:border-ink"
              />

              <label className="mt-4 block text-sm font-medium" htmlFor="task-trade">
                Trade
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="sm:w-48 sm:shrink-0">
                  <select
                    id="task-trade"
                    value={local.trade}
                    onChange={(event) => {
                      const tradeId = event.target.value;
                      if (tradeId === NEW_TRADE) {
                        setLocal({ ...local, trade: NEW_TRADE });
                        return;
                      }
                      const trade = findTrade(tradeId, customTrades);
                      setLocal({
                        ...local,
                        trade: tradeId,
                        color: trade?.color ?? local.color,
                        newTrade: "",
                      });
                    }}
                    className="h-11 w-full rounded-md border border-line bg-paper px-2 text-base outline-none focus:border-ink"
                  >
                    <optgroup label="Trades">
                      {TRADES.map((trade) => (
                        <option key={trade.id} value={trade.id}>
                          {trade.label}
                        </option>
                      ))}
                    </optgroup>
                    {customTrades.length > 0 && (
                      <optgroup label="Your trades">
                        {customTrades.map((trade) => (
                          <option key={trade.id} value={trade.id}>
                            {trade.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value={NEW_TRADE}>New trade…</option>
                  </select>
                  {local.trade === NEW_TRADE && (
                    <input
                      value={local.newTrade}
                      placeholder="Trade name"
                      aria-label="New trade name"
                      onChange={(event) => setLocal({ ...local, newTrade: event.target.value })}
                      className="mt-2 h-11 w-full rounded-md border border-line bg-paper px-3 text-base outline-none focus:border-ink"
                    />
                  )}
                </div>
                <div
                  className="flex flex-1 flex-wrap gap-1.5"
                  role="radiogroup"
                  aria-label="Colour"
                >
                  {PALETTE.map((swatch) => {
                    const selected = local.color === swatch.id;
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={swatch.name}
                        title={swatch.name}
                        onClick={() => setLocal({ ...local, color: swatch.id })}
                        className={cx(
                          "size-11 rounded-md",
                          selected
                            ? "ring-2 ring-ink ring-offset-2 ring-offset-paper-2"
                            : "ring-1 ring-ink/20",
                        )}
                        style={{ backgroundColor: swatch.bg }}
                      />
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {local.trade === NEW_TRADE
                  ? "Pick a colour for the new trade."
                  : "Each trade has its own colour. Pick another to change just this task."}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium" htmlFor="task-start">
                  Starts
                  <input
                    id="task-start"
                    type="date"
                    required
                    value={local.start}
                    onChange={(event) => setLocal({ ...local, start: event.target.value })}
                    className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-2 text-base outline-none focus:border-ink"
                  />
                </label>
                <label className="block text-sm font-medium" htmlFor="task-end">
                  Finishes
                  <input
                    id="task-end"
                    type="date"
                    required
                    value={local.end}
                    onChange={(event) => setLocal({ ...local, end: event.target.value })}
                    className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-2 text-base outline-none focus:border-ink"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm font-medium" htmlFor="task-crew">
                Crew <span className="font-normal text-muted">optional</span>
              </label>
              <input
                id="task-crew"
                value={local.crew}
                placeholder="2 hands, pump booked"
                onChange={(event) => setLocal({ ...local, crew: event.target.value })}
                className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-base outline-none focus:border-ink"
              />

              <label className="mt-4 block text-sm font-medium" htmlFor="task-notes">
                Notes <span className="font-normal text-muted">optional</span>
              </label>
              <textarea
                id="task-notes"
                rows={2}
                value={local.notes}
                onChange={(event) => setLocal({ ...local, notes: event.target.value })}
                className="mt-1 w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-base outline-none focus:border-ink"
              />

              {error && (
                <p className="mt-3 text-sm font-medium text-hi-deep" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-5 flex items-center gap-2">
                {local.id && (
                  <button
                    type="button"
                    className="h-11 rounded-md px-3 text-sm font-medium text-hi-deep hover:bg-canvas"
                    onClick={() => {
                      removeTask(local.id!);
                      onClose();
                    }}
                  >
                    Delete
                  </button>
                )}
                <Dialog.Close
                  type="button"
                  className="ml-auto h-11 rounded-md px-3 text-sm font-medium hover:bg-canvas"
                >
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  className="h-11 rounded-md bg-ink px-4 text-sm font-medium text-paper-2"
                >
                  Save task
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ScheduleApp() {
  const now = useNow();
  const { rail, compact } = useBoardSize();
  const jobName = useSchedule((state) => state.jobName);
  const tasks = useSchedule((state) => state.tasks);
  const customTrades = useSchedule((state) => state.customTrades);
  const setJobName = useSchedule((state) => state.setJobName);
  const loadSample = useSchedule((state) => state.loadSample);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dayWidth, setDayWidth] = useState(48);
  const [panning, setPanning] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dayWidthRef = useRef(dayWidth);
  const railRef = useRef(rail);
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const pendingScroll = useRef<number | null>(null);
  const inited = useRef(false);
  const rangeRef = useRef<HTMLSpanElement>(null);
  const rangeMobileRef = useRef<HTMLSpanElement>(null);
  const todayNoteRef = useRef<HTMLSpanElement>(null);

  const todayIso = iso(now);
  const fraction = dayFraction(now);
  const origin = useMemo(() => addDays(parseISO(todayIso), -PAST_DAYS), [todayIso]);
  const totalDays = PAST_DAYS + FUTURE_DAYS + 1;
  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, index) => addDays(origin, index)),
    [origin, totalDays],
  );
  const todayIndex = differenceInCalendarDays(parseISO(todayIso), origin);
  const weekShift = -((getDay(origin) + 6) % 7) * dayWidth;
  const trackWidth = totalDays * dayWidth;
  const rowHeight = rowHeightFor(dayWidth);
  const tiny = dayWidth < 32;
  const weekday = tiny || compact ? "EEEEE" : "EEE";

  dayWidthRef.current = dayWidth;
  railRef.current = rail;

  const syncChrome = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = dayWidthRef.current || 48;
    const startIndex = Math.min(
      totalDays - 1,
      Math.max(0, Math.floor(el.scrollLeft / width)),
    );
    const count = Math.max(1, Math.round((el.clientWidth - railRef.current) / width));
    const text = rangeLabel(addDays(origin, startIndex), count);
    if (rangeRef.current) rangeRef.current.textContent = text;
    if (rangeMobileRef.current) rangeMobileRef.current.textContent = text;
    const onBoard = todayIndex >= startIndex && todayIndex < startIndex + count;
    if (todayNoteRef.current) {
      todayNoteRef.current.textContent = onBoard ? "Today is on the board" : "Drag across to today";
    }
  };

  const zoomAt = (clientX: number, nextWidth: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const current = dayWidthRef.current || 48;
    const next = clamp(nextWidth, MIN_DAY, MAX_DAY);
    if (Math.abs(next - current) < 0.2) return;
    const rect = el.getBoundingClientRect();
    const focal = Math.max(railRef.current, clientX - rect.left);
    const contentX = el.scrollLeft + focal;
    const rel = contentX - railRef.current;
    pendingScroll.current = rel * (next / current) + railRef.current - focal;
    dayWidthRef.current = next;
    setDayWidth(next);
  };

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || inited.current) return;
    const track = Math.max(160, el.clientWidth - rail);
    const targetDays = track < 420 ? 7 : track < 900 ? 14 : 21;
    const width = clamp(track / targetDays, MIN_DAY, MAX_DAY);
    const index = Math.max(
      0,
      differenceInCalendarDays(defaultAnchor(targetDays, new Date()), origin),
    );
    inited.current = true;
    pendingScroll.current = index * width;
    dayWidthRef.current = width;
    setDayWidth(width);
  }, [origin, rail]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || pendingScroll.current == null) return;
    el.scrollLeft = pendingScroll.current;
    pendingScroll.current = null;
    syncChrome();
    // syncChrome closes over the latest render; day width changes are the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayWidth]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    let pinch: { dist: number; width: number; scroll: number; focal: number } | null = null;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const rect = el.getBoundingClientRect();
      const mid = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      pinch = {
        dist: distance(event.touches),
        width: dayWidthRef.current,
        scroll: el.scrollLeft,
        focal: mid - rect.left,
      };
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinch || pinch.dist === 0) return;
      event.preventDefault();
      const next = clamp(pinch.width * (distance(event.touches) / pinch.dist), MIN_DAY, MAX_DAY);
      const focal = Math.max(railRef.current, pinch.focal);
      const contentX = pinch.scroll + focal;
      const rel = contentX - railRef.current;
      pendingScroll.current = rel * (next / pinch.width) + railRef.current - focal;
      dayWidthRef.current = next;
      setDayWidth(next);
    };
    const onEnd = () => {
      pinch = null;
    };
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0025);
      zoomAt(event.clientX, dayWidthRef.current * factor);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [origin, rail]);

  function onPanDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === "touch") return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-task-bar], button, input, textarea, a")) return;
    const el = scrollerRef.current;
    if (!el) return;
    pan.current = {
      x: event.clientX,
      y: event.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
    setPanning(true);
  }

  function onPanMove(event: PointerEvent<HTMLDivElement>) {
    const current = pan.current;
    const el = scrollerRef.current;
    if (!current || !el) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) current.moved = true;
    el.scrollLeft = current.left - dx;
  }

  function onPanUp() {
    if (pan.current?.moved) suppressClick.current = true;
    pan.current = null;
    setPanning(false);
  }

  function shift(direction: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: direction * 7 * dayWidth, behavior: "smooth" });
  }

  function goToday() {
    const el = scrollerRef.current;
    if (!el) return;
    const track = Math.max(160, el.clientWidth - rail);
    const targetDays = track < 420 ? 7 : track < 900 ? 14 : 21;
    const index = Math.max(0, differenceInCalendarDays(defaultAnchor(targetDays, now), origin));
    el.scrollTo({ left: index * dayWidth, behavior: "smooth" });
  }

  function zoomBy(factor: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const focal = rect.left + rail + Math.max(0, rect.width - rail) / 2;
    zoomAt(focal, dayWidth * factor);
  }

  function onAddClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - rect.left) / dayWidth);
    if (index < 0 || index >= totalDays) return;
    setDraft(blankDraft(iso(days[index])));
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-canvas pb-[env(safe-area-inset-bottom)] text-ink">
      <header className="shrink-0 border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
        <div className="hazard-strip" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-hi">
              <HardHat className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-display text-xl leading-none font-semibold tracking-wide sm:text-2xl">
                TRADE SCHEDULE
              </h1>
              <p className="text-xs text-muted">
                Drag sideways · pinch out for more rows
                {" · "}
                <Link to="/about" className="font-medium text-ink underline-offset-2 hover:underline">
                  About
                </Link>
              </p>
            </div>
          </div>

          <p className="hidden min-w-0 flex-1 truncate text-sm text-muted lg:block">
            Drag empty board sideways. Pinch or ctrl-scroll to zoom. Drag a bar across the dates.
          </p>

          <div className="ml-auto flex min-w-0 basis-full flex-wrap items-center gap-1.5 sm:basis-auto sm:gap-2">
            <p className="mr-1 hidden text-right leading-tight sm:block">
              <span
                ref={rangeRef}
                className="block font-display text-xl leading-none font-semibold tabular-nums"
              >
                Loading
              </span>
              <span ref={todayNoteRef} className="text-xs text-muted">
                Today is on the board
              </span>
            </p>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-md border border-line bg-paper-2"
              aria-label="Previous week"
              onClick={() => shift(-1)}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              className="h-11 rounded-md border border-line bg-paper-2 px-3 text-sm font-medium"
              onClick={goToday}
            >
              Today
            </button>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-md border border-line bg-paper-2"
              aria-label="Next week"
              onClick={() => shift(1)}
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="flex overflow-hidden rounded-md border border-line bg-paper-2">
              <button
                type="button"
                className="grid size-11 place-items-center border-r border-line disabled:opacity-40"
                aria-label="Zoom out"
                disabled={dayWidth <= MIN_DAY + 0.5}
                onClick={() => zoomBy(1 / 1.25)}
              >
                <Minus className="size-5" />
              </button>
              <button
                type="button"
                className="grid size-11 place-items-center disabled:opacity-40"
                aria-label="Zoom in"
                disabled={dayWidth >= MAX_DAY - 0.5}
                onClick={() => zoomBy(1.25)}
              >
                <Plus className="size-5" />
              </button>
            </div>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1.5 rounded-md border border-line bg-paper-2 px-3 text-sm font-medium"
              onClick={() => {
                void saveTradeSchedule({
                  jobName,
                  tasks,
                  customTrades,
                  today: now,
                });
              }}
            >
              <Download className="size-4" />
              Download
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-paper-2"
              onClick={() => setDraft(blankDraft(todayIso))}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add task</span>
              <span className="sr-only sm:hidden">Add task</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3 pb-3 sm:px-5">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Job name</span>
            <input
              value={jobName}
              onChange={(event) => setJobName(event.target.value)}
              aria-label="Job name"
              className="h-10 w-full rounded-md border border-transparent bg-transparent px-2 text-base font-medium outline-none hover:border-line focus:border-ink focus:bg-paper-2"
            />
          </label>
          <p className="shrink-0 text-sm font-medium tabular-nums sm:hidden">
            <span ref={rangeMobileRef}>Loading</span>
          </p>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className={cx("board-scroll min-h-0 min-w-0 flex-1 overflow-auto", panning && "is-panning")}
        onScroll={syncChrome}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerCancel={onPanUp}
      >
        <div className="relative flex min-h-full flex-col" style={{ width: rail + trackWidth }}>
          <div
            className="day-wash pointer-events-none absolute inset-y-0 z-0"
            style={
              {
                left: rail,
                width: trackWidth,
                "--day": `${dayWidth}px`,
                "--week-shift": `${weekShift}px`,
              } as CSSProperties
            }
            aria-hidden="true"
          />
          {todayIndex >= 0 && todayIndex < totalDays && (
            <div
              className="col-today pointer-events-none absolute inset-y-0 z-0"
              style={{ left: rail + todayIndex * dayWidth, width: dayWidth }}
              aria-hidden="true"
            />
          )}
          <div
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: rail, width: trackWidth }}
            aria-hidden="true"
          >
            {todayIndex >= 0 && todayIndex < totalDays && (
              <span
                className="absolute top-0 bottom-0 w-0.5 bg-hi"
                style={{ left: (todayIndex + fraction) * dayWidth }}
              />
            )}
          </div>

          <div className="sticky top-0 z-30 flex h-20">
            <div
              className="sticky left-0 z-40 flex shrink-0 items-end border-r border-b border-line bg-paper px-3 pb-2 touch-pan-y"
              style={{ width: rail }}
            >
              <span className="text-xs font-medium tracking-widest text-muted uppercase">Tasks</span>
            </div>
            <div className="relative h-20 touch-pan-x" style={{ width: trackWidth }}>
              {days.map((day, index) => {
                const dow = getDay(day);
                const weekend = dow === 0 || dow === 6;
                const today = iso(day) === todayIso;
                const showMonth = !tiny && (index === 0 || day.getDate() === 1);
                return (
                  <div
                    key={iso(day)}
                    className={cx(
                      "absolute top-0 flex h-20 flex-col items-center justify-center overflow-hidden border-b border-line",
                      today ? "z-10 col-today" : weekend ? "col-weekend" : "bg-paper",
                    )}
                    style={{ left: index * dayWidth, width: dayWidth }}
                  >
                    {dayWidth >= 36 && (
                      <span
                        className={cx(
                          "font-display text-xs tracking-widest",
                          showMonth ? "text-muted" : "text-transparent",
                        )}
                      >
                        {format(day, "MMM").toUpperCase()}
                      </span>
                    )}
                    {dayWidth >= 28 && (
                      <span
                        className={cx(
                          "font-display text-sm leading-none tracking-wide",
                          weekend ? "text-muted" : "text-ink",
                        )}
                      >
                        {format(day, weekday).toUpperCase()}
                      </span>
                    )}
                    <span
                      className={cx(
                        "mt-1 grid place-items-center font-display leading-none font-semibold tabular-nums",
                        dayWidth >= 44 ? "size-8 text-xl" : dayWidth >= 30 ? "size-6 text-base" : "size-5 text-sm",
                        today ? "rounded-md bg-hi text-ink" : "text-ink",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {today && (
                      <>
                        <span
                          className="absolute inset-y-0 z-10 w-0.5 bg-hi"
                          style={{ left: `${fraction * 100}%` }}
                        />
                        <span
                          className="absolute bottom-0 z-20 flex -translate-x-1/2 translate-y-1/2 items-center gap-1 rounded-sm bg-hi px-1.5 py-0.5 font-display text-sm leading-none font-semibold tracking-wide text-ink whitespace-nowrap tabular-nums shadow-sm"
                          style={{ left: `${fraction * 100}%` }}
                        >
                          <span className="now-dot inline-block size-1.5 rounded-full bg-ink" />
                          {format(now, "HH:mm")}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {tasks.map((task) => (
            <div key={task.id} data-task-row className="flex" style={{ height: rowHeight }}>
              <TaskRail
                task={task}
                customTrades={customTrades}
                width={rail}
                rowHeight={rowHeight}
                onEdit={() => setDraft(draftFromTask(task, customTrades))}
              />
              <div className="relative z-0 border-b border-line touch-pan-x" style={{ width: trackWidth }}>
                <TaskBar
                  task={task}
                  origin={origin}
                  totalDays={totalDays}
                  dayWidth={dayWidth}
                  rowHeight={rowHeight}
                  onEdit={() => setDraft(draftFromTask(task, customTrades))}
                />
              </div>
            </div>
          ))}

          <div className="flex min-h-14 flex-1">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center border-r border-line bg-paper px-3 touch-pan-y"
              style={{ width: rail }}
            >
              {tasks.length === 0 ? (
                <button
                  type="button"
                  className="text-sm font-medium text-hi-deep underline-offset-2 hover:underline"
                  onClick={() => loadSample()}
                >
                  Load sample job
                </button>
              ) : (
                <span className="text-xs text-muted">Add</span>
              )}
            </div>
            <div className="relative z-0" style={{ width: trackWidth }} onClick={onAddClick}>
              {tasks.length === 0 && (
                <p
                  className="sticky px-4 py-4 text-sm text-muted"
                  style={{ left: rail, width: "max-content" }}
                >
                  Click a day to drop site set up, excavation, a pour…
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <TaskDialog draft={draft} onClose={() => setDraft(null)} />
    </main>
  );
}
