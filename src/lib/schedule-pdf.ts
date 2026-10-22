import { differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import { inclusiveDays, swatchFor, tradeLabel, type Task, type TradeDef } from "@/lib/schedule";

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 32;

type Rgb = [number, number, number];

const INK: Rgb = [0.043, 0.122, 0.2];
const MUTED: Rgb = [0.36, 0.4, 0.44];
const PAPER: Rgb = [0.969, 0.957, 0.933];
const PAPER2: Rgb = [1, 0.992, 0.973];
const LINE: Rgb = [0.867, 0.831, 0.784];
const HI: Rgb = [0.961, 0.651, 0.137];
const WEEKEND: Rgb = [0.925, 0.91, 0.88];

export type SchedulePdfInput = {
  jobName: string;
  tasks: Task[];
  customTrades: TradeDef[];
  today: Date;
};

class Page {
  private ops: string[] = [];

  fill(color: Rgb) {
    this.ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} rg`);
  }

  rect(x: number, y: number, w: number, h: number) {
    this.ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  text(font: "F1" | "F2", size: number, x: number, y: number, value: string, color: Rgb = INK) {
    const clean = sanitize(value);
    if (!clean) return;
    this.ops.push(
      `${num(color[0])} ${num(color[1])} ${num(color[2])} rg BT /${font} ${num(size)} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm (${clean}) Tj ET`,
    );
  }

  stream() {
    return this.ops.join("\n");
  }
}

function num(value: number) {
  return (Math.round(value * 100) / 100).toString();
}

function plain(value: string) {
  return value
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2019", "'")
    .replaceAll("\u2018", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u00a0", " ")
    .replace(/[^\x20-\x7E]/g, "");
}

function sanitize(value: string) {
  return plain(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function fit(value: string, width: number, size: number) {
  const clean = plain(value);
  const max = Math.max(1, Math.floor(width / (size * 0.5)));
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 3))}...`;
}

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function paintChrome(page: Page, job: string, meta: string, pageNo: number, pageCount: number) {
  page.fill(PAPER);
  page.rect(0, 0, PAGE_W, PAGE_H);
  page.fill(HI);
  page.rect(0, PAGE_H - 8, PAGE_W, 8);
  page.text("F2", 22, MARGIN, PAGE_H - 36, "TRADE SCHEDULE");
  page.text("F1", 12, MARGIN, PAGE_H - 54, fit(job || "Untitled job", 520, 12));
  page.text("F1", 9, MARGIN, PAGE_H - 68, meta, MUTED);
  page.text("F1", 8, PAGE_W - MARGIN - 70, 16, `Page ${pageNo} of ${pageCount}`, MUTED);
}

function drawGantt(
  page: Page,
  rows: Task[],
  customTrades: TradeDef[],
  origin: Date,
  span: number,
  today: Date,
  job: string,
  meta: string,
  pageNo: number,
  pageCount: number,
) {
  paintChrome(page, job, meta, pageNo, pageCount);
  const labelW = 168;
  const plotLeft = MARGIN + labelW;
  const plotRight = PAGE_W - MARGIN;
  const plotW = plotRight - plotLeft;
  const dayW = plotW / span;
  const top = PAGE_H - 84;
  const axisH = 22;
  const rowH = 22;
  const plotTop = top - axisH;
  const plotBottom = plotTop - rows.length * rowH;

  page.fill(PAPER2);
  page.rect(plotLeft, plotBottom, plotW, rows.length * rowH);

  for (let day = 0; day < span; day += 1) {
    const date = new Date(origin);
    date.setDate(origin.getDate() + day);
    const dow = getDay(date);
    const x = plotLeft + day * dayW;
    if (dow === 0 || dow === 6) {
      page.fill(WEEKEND);
      page.rect(x, plotBottom, dayW, rows.length * rowH + axisH);
    }
  }

  page.fill(LINE);
  for (let day = 0; day <= span; day += 1) {
    if (dayW < 10 && day % 7 !== 0 && day !== span) continue;
    const x = plotLeft + day * dayW;
    page.rect(x, plotBottom, 0.4, rows.length * rowH + axisH);
  }
  page.rect(plotLeft, plotBottom, plotW, 0.4);
  page.rect(plotLeft, plotTop, plotW, 0.4);

  for (let day = 0; day < span; day += 1) {
    const date = new Date(origin);
    date.setDate(origin.getDate() + day);
    const x = plotLeft + day * dayW;
    if (dayW >= 14) {
      page.text("F1", 7, x + 1.5, plotTop + 7, format(date, "d"), MUTED);
      if (day === 0 || date.getDate() === 1) {
        page.text("F2", 7, x + 1.5, plotTop + 15, format(date, "MMM").toUpperCase(), INK);
      }
    } else if (getDay(date) === 1) {
      page.text("F1", 7, x + 1.5, plotTop + 8, format(date, "d MMM"), MUTED);
    }
  }

  rows.forEach((task, index) => {
    const y = plotTop - (index + 1) * rowH;
    const swatch = swatchFor(task, customTrades);
    page.fill(index % 2 === 0 ? PAPER : PAPER2);
    page.rect(MARGIN, y, labelW - 6, rowH);
    page.text("F1", 9, MARGIN, y + 7, fit(task.name, labelW - 10, 9));
    const start = Math.max(0, differenceInCalendarDays(parseISO(task.start), origin));
    const end = Math.min(span, differenceInCalendarDays(parseISO(task.end), origin) + 1);
    if (end > start) {
      page.fill(hexToRgb(swatch.bg));
      const barX = plotLeft + start * dayW + 1;
      const barW = Math.max(3, (end - start) * dayW - 2);
      page.rect(barX, y + 5, barW, 12);
      if (barW > 36) {
        page.text("F1", 7, barX + 3, y + 8, fit(task.name, barW - 6, 7), hexToRgb(swatch.fg));
      }
    }
  });

  const todayIndex = differenceInCalendarDays(today, origin);
  if (todayIndex >= 0 && todayIndex < span) {
    page.fill(HI);
    page.rect(plotLeft + todayIndex * dayW, plotBottom, 1.2, rows.length * rowH);
  }
}

const COLUMNS = [
  { label: "Task", width: 168 },
  { label: "Trade", width: 118 },
  { label: "Starts", width: 78 },
  { label: "Finishes", width: 78 },
  { label: "Days", width: 40 },
  { label: "Crew", width: 110 },
  { label: "Notes", width: 176 },
];

function drawTable(
  page: Page,
  rows: Task[],
  customTrades: TradeDef[],
  job: string,
  meta: string,
  pageNo: number,
  pageCount: number,
) {
  paintChrome(page, job, meta, pageNo, pageCount);
  let x = MARGIN;
  const headY = PAGE_H - 96;
  page.fill(INK);
  page.rect(MARGIN, headY, COLUMNS.reduce((sum, column) => sum + column.width, 0), 18);
  for (const column of COLUMNS) {
    page.text("F2", 8, x + 4, headY + 5, column.label.toUpperCase(), PAPER2);
    x += column.width;
  }

  rows.forEach((task, index) => {
    const y = headY - (index + 1) * 20;
    const swatch = swatchFor(task, customTrades);
    page.fill(index % 2 === 0 ? PAPER2 : PAPER);
    page.rect(MARGIN, y, COLUMNS.reduce((sum, column) => sum + column.width, 0), 20);
    const cells = [
      task.name,
      tradeLabel(task.trade, customTrades),
      format(parseISO(task.start), "d MMM yyyy"),
      format(parseISO(task.end), "d MMM yyyy"),
      String(inclusiveDays(task.start, task.end)),
      task.crew,
      task.notes,
    ];
    let cellX = MARGIN;
    cells.forEach((value, cell) => {
      const column = COLUMNS[cell];
      if (cell === 1) {
        page.fill(hexToRgb(swatch.bg));
        page.rect(cellX + 4, y + 6, 8, 8);
        page.text("F1", 9, cellX + 16, y + 6, fit(value, column.width - 20, 9));
      } else {
        page.text("F1", 9, cellX + 4, y + 6, fit(value, column.width - 8, 9));
      }
      cellX += column.width;
    });
  });
}

function assemble(contents: string[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontRegular = 3;
  const fontBold = 4;
  let nextId = 5;
  const pageObjects: string[] = [];
  for (const content of contents) {
    const pageId = nextId++;
    const streamId = nextId++;
    pageIds.push(pageId);
    pageObjects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_W)} ${num(PAGE_H)}] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >> endobj`,
    );
    pageObjects.push(
      `${streamId} 0 obj << /Length ${content.length + 1} >> stream\n${content}\nendstream endobj`,
    );
  }
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push(
    `2 0 obj << /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >> endobj`,
  );
  objects.push("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj");
  objects.push(...pageObjects);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function buildSchedulePdf(input: SchedulePdfInput) {
  const tasks = [...input.tasks].sort(
    (a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name),
  );
  const job = input.jobName.trim() || "Untitled job";
  const prepared = format(input.today, "d MMM yyyy");
  const earliest = tasks.length
    ? tasks.reduce((day, task) => (task.start < day ? task.start : day), tasks[0].start)
    : "";
  const latest = tasks.length
    ? tasks.reduce((day, task) => (task.end > day ? task.end : day), tasks[0].end)
    : "";
  const spanLabel =
    tasks.length === 0
      ? "No tasks yet"
      : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} · ${format(parseISO(earliest), "d MMM yyyy")} - ${format(parseISO(latest), "d MMM yyyy")}`;
  const meta = `${spanLabel} · Prepared ${prepared}`;

  const ganttRows: Task[][] = [];
  if (tasks.length > 0) {
    const origin = parseISO(tasks[0].start);
    const last = tasks.reduce((end, task) => (task.end > end ? task.end : end), tasks[0].end);
    const span = differenceInCalendarDays(parseISO(last), origin) + 1;
    if (span > 0 && span <= 98) {
      const perPage = 18;
      for (let index = 0; index < tasks.length; index += perPage) {
        ganttRows.push(tasks.slice(index, index + perPage));
      }
    }
  }

  const tableRows: Task[][] = [];
  const perTable = 20;
  const source = tasks.length > 0 ? tasks : [];
  if (source.length === 0) {
    tableRows.push([]);
  } else {
    for (let index = 0; index < source.length; index += perTable) {
      tableRows.push(source.slice(index, index + perTable));
    }
  }

  const pageCount = ganttRows.length + tableRows.length;
  const pages: Page[] = [];
  ganttRows.forEach((rows, index) => {
    const origin = parseISO(tasks[0].start);
    const last = tasks.reduce((end, task) => (task.end > end ? task.end : end), tasks[0].end);
    const span = differenceInCalendarDays(parseISO(last), origin) + 1;
    const page = new Page();
    drawGantt(page, rows, input.customTrades, origin, span, input.today, job, meta, index + 1, pageCount);
    pages.push(page);
  });
  tableRows.forEach((rows, index) => {
    const page = new Page();
    if (rows.length === 0) {
      paintChrome(page, job, meta, ganttRows.length + index + 1, pageCount);
      page.text("F1", 12, MARGIN, PAGE_H - 120, "No tasks on this schedule yet.");
    } else {
      drawTable(
        page,
        rows,
        input.customTrades,
        job,
        meta,
        ganttRows.length + index + 1,
        pageCount,
      );
    }
    pages.push(page);
  });

  return assemble(pages.map((page) => page.stream()));
}

export function scheduleFileName(jobName: string) {
  const slug = jobName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug ? `${slug}-` : ""}trade-schedule.pdf`;
}

export function downloadTradeSchedule(input: SchedulePdfInput) {
  const bytes = buildSchedulePdf(input);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = scheduleFileName(input.jobName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
