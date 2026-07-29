// 批量录单「格式模板」系统
// 解决"必须按微信收款链接格式粘贴"的问题：用户可自建/保存/切换模板，
// 每个模板定义一套「表头识别词 + 字段映射 + 分隔符 + 表头行」配置。
// 模板存 localStorage（按用户隔离在浏览器侧），无需后端配合。

export type FieldKey =
  | "orderTime"
  | "totalAmount"
  | "payerNickname"
  | "orderItem"
  | "orderName"
  | "orderType"
  | "itemAmount"
  | "quantity"
  | "address"
  | "customerName"
  | "phone"
  | "paymentRemark"
  | "merchantRemark"
  | "isMarked"
  | "customerDiscount"
  | "isRefunded"
  | "paymentNote"
  | "paymentLink"
  | "expCom"
  | "expCode";

export const FIELD_OPTIONS: Array<{ key: FieldKey; label: string; hint: string }> = [
  { key: "orderTime", label: "收款时间", hint: "下单/支付时间" },
  { key: "orderItem", label: "收款项", hint: "商品名（包含规格）" },
  { key: "orderName", label: "商品", hint: "商品名（单独列，下拉选择）" },
  { key: "orderType", label: "规格", hint: "规格（单独列，下拉选择）" },
  { key: "quantity", label: "数量", hint: "件数（缺省默认 1）" },
  { key: "customerName", label: "姓名", hint: "收件人姓名" },
  { key: "phone", label: "电话", hint: "收件人手机" },
  { key: "address", label: "地址", hint: "收件地址" },
  { key: "payerNickname", label: "付款方昵称", hint: "买家(付款人)" },
  { key: "totalAmount", label: "收款总金额", hint: "整单金额" },
  { key: "itemAmount", label: "收款项金额", hint: "单件金额" },
  { key: "paymentRemark", label: "付款备注", hint: "买家留言" },
  { key: "merchantRemark", label: "商家备注", hint: "商家内部备注" },
  { key: "isMarked", label: "是否已标记", hint: "已标记发货等" },
  { key: "customerDiscount", label: "顾客优惠", hint: "优惠金额" },
  { key: "isRefunded", label: "是否退款", hint: "退款标记" },
  { key: "paymentNote", label: "收款说明", hint: "说明文本" },
  { key: "paymentLink", label: "收款链接", hint: "微信收款链接" },
  { key: "expCom", label: "快递公司", hint: "如 顺丰/中通" },
  { key: "expCode", label: "快递单号", hint: "运单号" },
];

export const REQUIRED_FIELDS: FieldKey[] = ["customerName", "phone"];
// 「姓名 + 电话」是任何录单模板的兜底必填（数量缺省自动按 1 件）
// 付款方昵称用于匹配已有买家 / 自动新建买家，强烈建议有

export type SeparatorType = "auto" | "tab" | "multi-space" | "comma";

export type TemplateField = {
  key: FieldKey;
  aliases: string[];   // 表头识别词（任一命中即认为本列是该字段）
  required: boolean;
  /** 单元格下拉选项（导出 xlsx 时配 data validation；解析时仍接受自由文本） */
  dropdown?: string[];
};

export type FormatTemplate = {
  id: string;
  name: string;
  builtin?: boolean;            // 系统模板：不可删除
  fields: TemplateField[];      // 字段顺序 = 无表头时的列顺序
  separator: SeparatorType;
  headerRow: 0 | 1;             // 0=无表头（按位置映射），1=第 1 行是表头（按别名识别）
  description?: string;         // 模板说明
};

// ============================================================
// 系统内置模板
// ============================================================

// 简单录单模板：每列单独一行，9 列（默认首选）
const SIMPLE_TEMPLATE: FormatTemplate = {
  id: "builtin-simple",
  name: "简单录单（默认）",
  builtin: true,
  description: "下单人 / 姓名 / 电话 / 地址 / 商品 / 规格 / 备注 / 快递公司 / 快递单号 共 9 列；商品名和规格为下拉",
  separator: "tab",
  headerRow: 1,
  fields: [
    { key: "payerNickname", aliases: ["下单人", "付款方昵称", "付款人", "买家昵称", "昵称"], required: false },
    { key: "customerName", aliases: ["姓名", "收件人", "收货人", "联系人"], required: true },
    { key: "phone", aliases: ["电话", "手机", "手机号", "联系方式"], required: true },
    { key: "address", aliases: ["地址", "收货地址", "收件地址"], required: true },
    { key: "orderName", aliases: ["商品", "商品名", "收款项", "产品"], required: true, dropdown: ["炎陵黄桃", "炎陵奈李"] },
    { key: "orderType", aliases: ["规格", "尺寸", "型号", "斤数"], required: true, dropdown: ["5斤", "10斤"] },
    { key: "merchantRemark", aliases: ["备注", "商家备注", "内部备注", "留言"], required: false },
    { key: "expCom", aliases: ["快递公司", "快递", "物流公司", "快递类型"], required: false },
    { key: "expCode", aliases: ["快递单号", "运单号", "单号", "快递号"], required: false },
  ],
};

// 微信收款链接导出的标准格式（原有行为）
const WECHAT_PAY_TEMPLATE: FormatTemplate = {
  id: "builtin-wechat",
  name: "微信收款链接",
  builtin: true,
  description: "微信支付 → 收款账单 → 导出 Tab 分隔文本，表头第 1 行",
  separator: "auto",
  headerRow: 1,
  fields: [
    { key: "orderTime", aliases: ["收款时间", "支付时间", "交易时间", "下单时间"], required: true },
    { key: "totalAmount", aliases: ["收款总金额", "总金额", "金额"], required: false },
    { key: "payerNickname", aliases: ["付款方昵称", "付款人", "买家昵称", "昵称"], required: true },
    { key: "orderItem", aliases: ["收款项", "商品", "商品名称"], required: true },
    { key: "itemAmount", aliases: ["收款项金额", "商品金额", "单价"], required: false },
    { key: "quantity", aliases: ["数量", "件数", "购买数量"], required: true },
    { key: "address", aliases: ["地址", "收货地址", "收件地址"], required: true },
    { key: "customerName", aliases: ["姓名", "收件人", "收货人", "联系人"], required: true },
    { key: "phone", aliases: ["电话", "手机", "手机号", "联系方式"], required: true },
    { key: "paymentRemark", aliases: ["付款备注", "买家留言", "买家备注", "留言"], required: false },
    { key: "merchantRemark", aliases: ["商家备注", "内部备注", "店家备注"], required: false },
    { key: "isMarked", aliases: ["是否已标记", "已标记"], required: false },
    { key: "customerDiscount", aliases: ["顾客优惠", "优惠"], required: false },
    { key: "isRefunded", aliases: ["是否退款", "退款"], required: false },
    { key: "paymentNote", aliases: ["收款说明", "说明"], required: false },
    { key: "paymentLink", aliases: ["收款链接", "链接"], required: false },
    { key: "expCom", aliases: ["快递公司", "快递", "物流公司", "快递类型"], required: false },
    { key: "expCode", aliases: ["快递单号", "运单号", "单号", "快递号"], required: false },
  ],
};

const BUILTIN_TEMPLATES: FormatTemplate[] = [SIMPLE_TEMPLATE, WECHAT_PAY_TEMPLATE];

// ============================================================
// localStorage 持久化
// ============================================================

const LS_KEY = "xb-batch-templates";
const LS_ACTIVE = "xb-active-batch-template";

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略 localStorage 不可用（隐私模式 / 配额满）
  }
}

/** 加载所有模板（内置 + 用户自定义），用户自定义在前面 */
export function loadTemplates(): FormatTemplate[] {
  const userTemplates = safeRead<FormatTemplate[]>(LS_KEY, []);
  // 去重：如果用户误改了内置模板的 id，回退到内置版本
  const validUser = userTemplates.filter((t) => !t.builtin && BUILTIN_TEMPLATES.every((b) => b.id !== t.id));
  return [...validUser, ...BUILTIN_TEMPLATES];
}

/** 保存用户自定义模板（自动剔除内置） */
export function saveUserTemplates(templates: FormatTemplate[]) {
  const userOnly = templates.filter((t) => !t.builtin);
  safeWrite(LS_KEY, userOnly);
}

/** 加载当前激活的模板 id（默认简单录单模板） */
export function loadActiveTemplateId(): string {
  return safeRead<string>(LS_ACTIVE, SIMPLE_TEMPLATE.id);
}

export function saveActiveTemplateId(id: string) {
  safeWrite(LS_ACTIVE, id);
}

/** 生成不重复的 id */
export function newTemplateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// 解析：根据模板从「文本行/二维数组」解析出订单行
// ============================================================

function normalizeDate(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/\//g, "-").trim();
  const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")} ${h.padStart(2, "0")}:${mi.padStart(2, "0")}:${s.padStart(2, "0")}`;
  }
  return cleaned;
}

type Row = Record<string, any>;

function splitBySeparator(line: string, separator: SeparatorType): string[] {
  if (separator === "tab") return line.split("\t").map((s) => s.trim());
  if (separator === "multi-space") return line.split(/\s{2,}/).map((s) => s.trim());
  if (separator === "comma") return line.split(",").map((s) => s.trim());
  // auto: 优先 tab，否则多空格
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());
  return line.split(/\s{2,}/).map((s) => s.trim());
}

function split2DBySeparator(rows: string[][], _separator: SeparatorType): string[][] {
  // xlsx 读出来已经是按列分好的 2D 数组，每格一个值；这里只做 trim，不再切分。
  return rows.map((r) => r.map((c) => String(c ?? "").trim()));
}

function matchHeader(cells: string[], template: FormatTemplate): number {
  let count = 0;
  template.fields.forEach((f) => {
    const hit = cells.some((c) => f.aliases.some((a) => a && c.includes(a)));
    if (hit) count++;
  });
  return count;
}

function mapColumnsByHeader(cells: string[], template: FormatTemplate): Record<string, number> {
  const colIdx: Record<string, number> = {};
  template.fields.forEach((f) => {
    const idx = cells.findIndex((c) => f.aliases.some((a) => a && c.includes(a)));
    if (idx >= 0) colIdx[f.key] = idx;
  });
  return colIdx;
}

function mapColumnsByPosition(template: FormatTemplate): Record<string, number> {
  const colIdx: Record<string, number> = {};
  template.fields.forEach((f, i) => { colIdx[f.key] = i; });
  return colIdx;
}

function rowFromCells(cells: string[], colIdx: Record<string, number>, template: FormatTemplate): Row | null {
  const item: Row = {};
  Object.keys(colIdx).forEach((field) => {
    const idx = colIdx[field];
    let val: any = cells[idx] || "";
    if (field === "orderTime") val = normalizeDate(val);
    if (field === "quantity") val = Number(val) || 1;
    item[field] = val;
  });
  // 数量兜底：模板没列数量时按 1 件处理
  if (item.quantity == null || item.quantity === "" || Number(item.quantity) <= 0) {
    item.quantity = 1;
  }
  // 必填校验：模板标记的 required 字段必须非空
  for (const f of template.fields) {
    if (f.required && (item[f.key] === undefined || item[f.key] === "" || item[f.key] === null)) {
      return null;
    }
  }
  // 兜底必填：customerName / phone 缺一不可（数量已兜底为 1）
  if (!item.customerName || !item.phone) return null;
  // 付款方昵称作为 purchaserName（用于匹配/新建买家）
  if (item.payerNickname) item.purchaserName = String(item.payerNickname);
  // 兜底：用户简单模板没列「收款时间」时，按当前时间补
  if (!item.orderTime) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    item.orderTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  // 兜底：用户没填「下单人/付款方昵称」时，用收件人姓名作为买家名（避免被后端判为 invalid）
  if (!item.purchaserName) item.purchaserName = String(item.customerName);
  // 商品 / 规格 单独列：直接作为 orderNameDesc / orderTypeDesc
  if (item.orderName && !item.orderNameDesc) item.orderNameDesc = String(item.orderName);
  if (item.orderType && !item.orderTypeDesc) item.orderTypeDesc = String(item.orderType);
  return item;
}

// 从「商品」文本里自动解析商品名（炎陵黄桃 / 炎陵奈李）和规格（五斤/10斤 等）
function parseProductFromItem(orderItem: unknown): { orderNameDesc?: string; orderTypeDesc?: string } {
  const str = String(orderItem || "");
  const result: { orderNameDesc?: string; orderTypeDesc?: string } = {};
  if (/炎陵黄桃/.test(str)) result.orderNameDesc = "炎陵黄桃";
  else if (/炎陵奈李/.test(str)) result.orderNameDesc = "炎陵奈李";
  const sizeMatch = str.match(/[五5]斤|十斤|10斤/);
  if (sizeMatch) result.orderTypeDesc = /[五5]/.test(sizeMatch[0]) ? "5斤" : "10斤";
  return result;
}

export type ParseResult = {
  items: Row[];
  headerFound: boolean;
  headerLine: number;       // -1 表示无表头 / 未找到
  totalLines: number;
  matchedFields: number;    // 表头命中的字段数（仅 headerRow=1 时有意义）
};

export function parseTextWithTemplate(text: string, template: FormatTemplate): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { items: [], headerFound: false, headerLine: -1, totalLines: 0, matchedFields: 0 };
  }

  let colIdx: Record<string, number> = {};
  let dataStart = 0;
  let headerLine = -1;
  let matchedFields = 0;
  let headerFound = false;

  if (template.headerRow === 1) {
    for (let i = 0; i < lines.length; i++) {
      const cells = splitBySeparator(lines[i], template.separator);
      const m = matchHeader(cells, template);
      if (m >= 3 && m > matchedFields) {
        matchedFields = m;
        headerLine = i;
        colIdx = mapColumnsByHeader(cells, template);
        dataStart = i + 1;
        headerFound = true;
      }
    }
    if (!headerFound) {
      return { items: [], headerFound: false, headerLine: -1, totalLines: lines.length, matchedFields: 0 };
    }
  } else {
    colIdx = mapColumnsByPosition(template);
    dataStart = 0;
  }

  const items: Row[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cells = splitBySeparator(lines[i], template.separator);
    if (cells.every((c) => !c)) continue;
    const item = rowFromCells(cells, colIdx, template);
    if (!item) continue;
    Object.assign(item, parseProductFromItem(item.orderItem));
    items.push(item);
  }

  return { items, headerFound, headerLine, totalLines: lines.length, matchedFields };
}

/** Excel 解析：xlsx 读出来就是 2D 数组，用同一套列映射逻辑 */
export function parseGridWithTemplate(grid: string[][], template: FormatTemplate): ParseResult {
  const rows = grid.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  if (rows.length === 0) {
    return { items: [], headerFound: false, headerLine: -1, totalLines: 0, matchedFields: 0 };
  }

  let colIdx: Record<string, number> = {};
  let dataStart = 0;
  let headerLine = -1;
  let matchedFields = 0;
  let headerFound = false;

  if (template.headerRow === 1) {
    // 微信账单导出的 xlsx 通常前 7 行是元数据（商户号、统计区间…），表头在第 8 行附近；
    // 跟 parseTextWithTemplate 一样扫描所有行，取「匹配别名数最多」且 >= 3 的那一行作为表头。
    for (let i = 0; i < rows.length; i++) {
      const cells = split2DBySeparator([rows[i]], template.separator)[0];
      const m = matchHeader(cells, template);
      if (m >= 3 && m > matchedFields) {
        matchedFields = m;
        headerLine = i;
        colIdx = mapColumnsByHeader(cells, template);
        dataStart = i + 1;
        headerFound = true;
      }
    }
    if (!headerFound) {
      return { items: [], headerFound: false, headerLine: -1, totalLines: rows.length, matchedFields: 0 };
    }
  } else {
    colIdx = mapColumnsByPosition(template);
    dataStart = 0;
  }

  const items: Row[] = [];
  for (let i = dataStart; i < rows.length; i++) {
    const cells = split2DBySeparator([rows[i]], template.separator)[0];
    if (cells.every((c) => !c)) continue;
    const item = rowFromCells(cells, colIdx, template);
    if (!item) continue;
    Object.assign(item, parseProductFromItem(item.orderItem));
    items.push(item);
  }

  return { items, headerFound, headerLine, totalLines: rows.length, matchedFields };
}

// ============================================================
// 模板样例下载：用 ExcelJS 生成 .xlsx 并触发浏览器下载
// ============================================================

/** 每个字段对应的样例数据（按 FIELD_KEY 顺序填写） */
const SAMPLE_ROW_BY_KEY: Record<FieldKey, string> = {
  orderTime: "2026-07-26 10:00",
  orderItem: "炎陵黄桃5斤",
  orderName: "炎陵黄桃",
  orderType: "5斤",
  quantity: "1",
  customerName: "张三",
  phone: "13800138000",
  address: "湖南省株洲市炎陵县某村某组",
  payerNickname: "微信昵称_李四",
  totalAmount: "98.00",
  itemAmount: "98.00",
  paymentRemark: "请尽快发货",
  merchantRemark: "备注内容",
  isMarked: "否",
  customerDiscount: "0",
  isRefunded: "否",
  paymentNote: "",
  paymentLink: "",
  expCom: "顺丰",
  expCode: "SF1234567890",
};

function buildTemplateHeaderAndRows(template: FormatTemplate): { headers: string[]; rows: string[][] } {
  const headers = template.fields.map((f) => f.aliases[0] || f.key);
  const row1 = template.fields.map((f) => SAMPLE_ROW_BY_KEY[f.key] ?? "");
  const row2 = template.fields.map((f, i) => {
    if (f.key === "customerName") return "王五";
    if (f.key === "phone") return "13900139000";
    if (f.key === "address") return "湖南省长沙市天心区某街道 88 号";
    if (f.key === "payerNickname") return "微信昵称_赵六";
    if (f.key === "orderName") return "炎陵奈李";
    if (f.key === "orderType") return "10斤";
    if (f.key === "merchantRemark") return "送果篮一个";
    if (f.key === "expCom") return "中通";
    if (f.key === "expCode") return "ZT9876543210";
    if (f.key === "orderItem") return "炎陵奈李10斤";
    return row1[i];
  });
  return { headers, rows: [row1, row2] };
}

/**
 * 在浏览器侧生成模板样例 .xlsx 并触发下载。
 *
 * <p>使用 ExcelJS：可对模板中带 `dropdown` 配置的列写入 data validation，
 * 用户在 Excel/WPS 里点单元格会看到下拉选择。简单录单模板的
 * 「商品 / 规格」两列已配下拉（炎陵黄桃/炎陵奈李、5斤/10斤）。
 *
 * <p>fallback：ExcelJS 加载失败时回退到 SheetJS（无下拉）+ 再回退到 Tab 分隔 .txt。
 *
 * @param template 当前激活的模板
 * @returns 触发下载（无返回值）；浏览器或 SSR 下静默跳过
 */
export async function downloadTemplateXlsx(template: FormatTemplate): Promise<void> {
  if (typeof window === "undefined") return;
  const { headers, rows } = buildTemplateHeaderAndRows(template);
  const fname = `批量录单模板-${template.name.replace(/[\\/:*?"<>|]/g, "_")}.xlsx`;

  // 1) 首选：ExcelJS（支持下拉）
  try {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "xb-h5";
    wb.created = new Date();
    const ws = wb.addWorksheet("录单模板", { views: [{ state: "frozen", ySplit: template.headerRow === 1 ? 1 : 0 }] });
    if (template.headerRow === 1) {
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7F3EC" },
      };
    }
    rows.forEach((r) => ws.addRow(r));
    // 列宽估算
    ws.columns = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => r[i]?.length || 0),
      );
      return { width: Math.min(28, Math.max(8, maxLen * 2 + 2)) };
    });
    // 给带 dropdown 的列加 data validation（从表头下 1 行开始，覆盖 200 行）
    template.fields.forEach((f, i) => {
      if (!f.dropdown || f.dropdown.length === 0) return;
      const colLetter = colIndexToLetter(i + 1); // 1-based
      const startRow = (template.headerRow === 1 ? 2 : 1);
      const endRow = startRow + 199;
      ws.getCell(`${colLetter}${startRow}`).dataValidation = {
        type: "list",
        allowBlank: !f.required,
        formulae: [`"${f.dropdown.map((s) => String(s).replace(/"/g, '""')).join(",")}"`],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "建议从下拉选择",
        error: `该列推荐值：${f.dropdown.join(" / ")}（也可手动输入其他值）`,
      };
      // 复制到整列范围
      for (let r = startRow + 1; r <= endRow; r++) {
        const src = ws.getCell(`${colLetter}${startRow}`).dataValidation;
        if (src) ws.getCell(`${colLetter}${r}`).dataValidation = { ...src };
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    triggerDownload(blob, fname);
    return;
  } catch (e) {
    // 继续走 fallback
    console.warn("[downloadTemplateXlsx] ExcelJS 带下拉模板失败，回退简化导出", e);
  }

  // 2) 回退：无下拉的简易 xlsx（仍用 exceljs 封装）
  try {
    const { downloadExcelAoa } = await import("../../lib/excel");
    const sheetData: (string | number)[][] = [];
    if (template.headerRow === 1) sheetData.push(headers);
    rows.forEach((r) => sheetData.push(r));
    await downloadExcelAoa(fname, "录单模板", sheetData, { headerBold: template.headerRow === 1 });
    return;
  } catch {
    // 继续走 txt 回退
  }

  // 3) 最后回退：Tab 分隔 .txt
  try {
    const lines: string[] = [];
    if (template.headerRow === 1) lines.push(headers.join("\t"));
    rows.forEach((r) => lines.push(r.join("\t")));
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    triggerDownload(blob, fname.replace(/\.xlsx$/, ".txt"));
  } catch {
    // 全部失败
  }
}

function colIndexToLetter(index: number): string {
  // 1 → A, 2 → B, ..., 26 → Z, 27 → AA
  let s = "";
  let n = index;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟 revoke，避免某些浏览器在 click 还没完成时回收 URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
