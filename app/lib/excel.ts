/**
 * 统一 Excel 读写：仅依赖 exceljs，避免同时打包 xlsx + exceljs。
 */

type CellValue = string | number | boolean | Date | null | undefined;
type ExcelJsModule = typeof import("exceljs");

async function loadExcelJs(): Promise<ExcelJsModule> {
  const imported = await import("exceljs");
  const candidate = imported as ExcelJsModule & { default?: ExcelJsModule };
  if (typeof candidate.Workbook === "function") return candidate;
  if (candidate.default && typeof candidate.default.Workbook === "function") return candidate.default;
  throw new Error("Excel 组件加载失败，请刷新页面后重试");
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  // exceljs rich text / formula result
  if (typeof value === "object") {
    const obj = value as { text?: string; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof obj.text === "string") return obj.text;
    if (obj.result != null) return cellToString(obj.result);
    if (Array.isArray(obj.richText)) return obj.richText.map((p) => p.text || "").join("");
  }
  return String(value);
}

/** 读取首个工作表为二维字符串网格（含表头行） */
export async function readExcelGrid(file: File | ArrayBuffer): Promise<string[][]> {
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  const buffer: ArrayBuffer = typeof File !== "undefined" && file instanceof File
    ? await file.arrayBuffer()
    : file as ArrayBuffer;
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as CellValue[];
    // exceljs row.values 下标从 1 开始
    const cells: string[] = [];
    const len = values.length;
    for (let i = 1; i < len; i++) {
      cells.push(cellToString(values[i]));
    }
    // 去掉尾部空单元格
    while (cells.length && cells[cells.length - 1] === "") cells.pop();
    if (cells.some((c) => c !== "")) grid.push(cells);
  });
  return grid;
}

/**
 * 读取首个工作表为对象数组：首行作表头 key。
 * 与原 sheet_to_json 行为对齐（空行跳过）。
 */
export async function readExcelJson(file: File | ArrayBuffer): Promise<Record<string, unknown>[]> {
  const grid = await readExcelGrid(file);
  if (grid.length < 2) return [];
  const headers = grid[0].map((h) => String(h || "").trim());
  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    if (!line || line.every((c) => !String(c || "").trim())) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = line[i] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

/** 将对象数组写成 .xlsx 并触发浏览器下载 */
export async function downloadExcelJson(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (typeof window === "undefined") return;
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = "xb-h5";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName || "Sheet1");
  if (!rows.length) {
    ws.addRow([]);
  } else {
    const keys = Object.keys(rows[0]);
    ws.addRow(keys);
    ws.getRow(1).font = { bold: true };
    rows.forEach((row) => {
      ws.addRow(keys.map((k) => {
        const v = row[k];
        if (v == null) return "";
        return typeof v === "object" ? String(v) : (v as string | number | boolean);
      }));
    });
    ws.columns = keys.map((h) => ({ width: Math.min(28, Math.max(8, h.length * 2 + 2)) }));
  }
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/** aoa 写文件（二维数组） */
export async function downloadExcelAoa(
  filename: string,
  sheetName: string,
  data: (string | number | boolean | null | undefined)[][],
  options?: { headerBold?: boolean },
): Promise<void> {
  if (typeof window === "undefined") return;
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = "xb-h5";
  const ws = wb.addWorksheet(sheetName || "Sheet1");
  data.forEach((row) => ws.addRow(row.map((c) => (c == null ? "" : c))));
  if (options?.headerBold && data.length) {
    ws.getRow(1).font = { bold: true };
  }
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
