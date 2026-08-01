import {
  AlertTriangle,
  BadgeDollarSign,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Power,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, copyToClipboard, downloadFile, uploadFile } from "../lib/api";
import type { DataRow, Dictionaries, FieldConfig, MenuKey } from "./core";
import {
  EXPRESS_STATUS_OPTIONS,
  optionLabel,
  shortDate,
  STORE_STATUS_OPTIONS,
} from "./core";
import { StatusBadge } from "./logistics";
import { ConfirmDialog, EmptyState, FieldInput, Sheet, StoreStatusBadge } from "./ui";

export type CrudConfig = {
  key: MenuKey;
  title: string;
  itemName: string;
  api: string;
  icon: typeof ReceiptText;
  titleKey: string;
  subtitle?: (row: DataRow) => string;
  searchFields: FieldConfig[];
  fields: FieldConfig[];
  display: Array<{ key: string; label: string; money?: boolean; fullWidth?: boolean; options?: Array<{ value: string | number; label: string }>; format?: (row: DataRow) => string }>;
  expand?: Array<{ key: string; label: string; money?: boolean; options?: Array<{ value: string | number; label: string }>; format?: (row: DataRow) => string }>;
  summary?: Array<{ key: string; label: string; money?: boolean; tone?: "default" | "success" | "danger"; valueFormat?: (row: DataRow) => string }>;
  note?: (row: DataRow) => string;
  extraAction?: { label: string; path: (row: DataRow) => string; method: string } | ((row: DataRow) => { label: string; path: (row: DataRow) => string; method: string; danger?: boolean; confirm?: string });
  batchAction?: { label: string; title: string; fields: FieldConfig[]; submit: (values: DataRow, ids: Array<string | number>) => Promise<unknown>; successMessage?: (payload: unknown) => string };
  importable?: boolean;
};

export function createCrudConfigs(dictionaries: Dictionaries): Record<Exclude<MenuKey, "home" | "orders" | "orderEntry" | "batchOrder" | "orderLink" | "purchasers" | "tracking" | "logistics" | "shortLinks">, CrudConfig> {
  return {
  bills: {
    key: "bills", title: "账单管理", itemName: "账单", api: "/biz/bill", icon: ReceiptText, titleKey: "orderCode",
    subtitle: (row) => `${row.orderNameDesc || optionLabel(row.orderName, dictionaries.products)} · ${row.orderTypeDesc || optionLabel(row.orderType, dictionaries.sizes)} · ${row.customer || "暂无收件人"}`,
    searchFields: [{ key: "orderCode", label: "订单号" }, { key: "createBy", label: "创建人" }],
    fields: [{ key: "orderCode", label: "订单号", required: true }, { key: "goodsPrice", label: "商品成本", type: "number" }, { key: "packagePrice", label: "包装费", type: "number" }, { key: "expPrice", label: "快递费", type: "number" }, { key: "addPrice", label: "附加费", type: "number" }, { key: "totalPrice", label: "总成本", type: "number", readonly: true }, { key: "remark", label: "备注", type: "textarea" }],
    summary: [
      { key: "totalPrice", label: "总成本", money: true, tone: "default" },
    ],
    display: [
      { key: "orderName", label: "商品名称", options: dictionaries.products },
      { key: "orderTypeNum", label: "规格×数量", format: (row) => `${optionLabel(row.orderType, dictionaries.sizes) || row.orderTypeDesc || "--"} × ${row.orderNum || 1}` },
      { key: "customer", label: "收件人" }, { key: "phone", label: "手机号" },
      { key: "address", label: "收货地址", fullWidth: true, format: (row) => row.address || "暂无地址" },
    ],
    expand: [
      { key: "goodsPrice", label: "商品成本", money: true },
      { key: "packagePrice", label: "包装费", money: true },
      { key: "expPrice", label: "快递费", money: true },
      { key: "addPrice", label: "附加费", money: true },
      { key: "createBy", label: "下单人" },
      { key: "orderTime", label: "下单时间", format: (row) => shortDate(row.orderTime) },
    ],
    note: (row) => row.remark ? `备注：${row.remark}` : "",
    extraAction: (row) => {
      const status = String(row.orderStatus || "");
      const isRestricted = status && status !== "DSH" && status !== "DFH";
      if (isRestricted) {
        return {
          label: "强制刷新",
          path: () => `/biz/bill/forceSync/${row.id}`,
          method: "PATCH",
          danger: true,
          confirm: `该账单关联订单状态为「${row.orderStatusDesc || status}」，已发货/已产生物流的价格通常不应再被覆盖。\n\n确认要强制刷新吗？（会重算成本）`,
        };
      }
      return { label: "同步价格", path: () => `/biz/bill/${row.id}`, method: "PATCH" };
    },
  },
  express: {
    key: "express", title: "快递管理", itemName: "快递信息", api: "/biz/exp", icon: Truck, titleKey: "expCode",
    subtitle: (row) => String(row.orderCode || "暂无关联订单"),
    searchFields: [{ key: "orderCode", label: "订单号" }, { key: "expCode", label: "快递单号" }, { key: "expTime", label: "快递时间", type: "date" }, { key: "expStatus", label: "快递状态", type: "select", options: EXPRESS_STATUS_OPTIONS }],
    fields: [{ key: "expCode", label: "快递单号", required: true }, { key: "expTime", label: "快递时间", type: "datetime-local" }, { key: "expStatus", label: "快递状态", type: "select", options: EXPRESS_STATUS_OPTIONS }, { key: "expDesc", label: "快递描述", type: "textarea" }],
    display: [{ key: "orderCode", label: "订单号" }, { key: "expStatus", label: "快递状态", format: (row) => String(row.expStatusDesc || optionLabel(row.expStatus, EXPRESS_STATUS_OPTIONS)) }, { key: "expTime", label: "快递时间", format: (row) => shortDate(row.expTime, true) }],
    note: (row) => String(row.expDesc || ""),
    extraAction: { label: "刷新物流", path: (row) => `/biz/exp/refresh/${row.orderCode || row.expCode}`, method: "PATCH" },
  },
  prices: {
    key: "prices", title: "价格管理", itemName: "价格方案", api: "/biz/price", icon: BadgeDollarSign, titleKey: "priceCode",
    subtitle: (row) => `${optionLabel(row.orderName, dictionaries.products)} · ${optionLabel(row.orderType, dictionaries.sizes)}`,
    searchFields: [{ key: "orderName", label: "商品名称", type: "select", options: dictionaries.products }, { key: "orderType", label: "商品规格", type: "select", options: dictionaries.sizes }, { key: "expCom", label: "快递公司", type: "select", options: dictionaries.expressCompanies }, { key: "expArea", label: "快递区域", type: "select", options: dictionaries.provinces }, { key: "isDefault", label: "是否默认", type: "select", options: dictionaries.yesNo }, { key: "createBy", label: "创建人" }],
    fields: [{ key: "orderName", label: "商品名称", type: "select", options: dictionaries.products, required: true }, { key: "orderType", label: "商品规格", type: "select", options: dictionaries.sizes, required: true }, { key: "goodsPrice", label: "商品成本", type: "number" }, { key: "expCom", label: "快递公司", type: "select", options: dictionaries.expressCompanies }, { key: "expArea", label: "快递区域", type: "select", options: dictionaries.provinces }, { key: "expPrice", label: "快递费", type: "number" }, { key: "packagePrice", label: "包装费", type: "number" }, { key: "totalPrice", label: "总成本", type: "number", readonly: true }, { key: "salePrice", label: "销售价格", type: "number" }, { key: "isDefault", label: "是否默认", type: "select", options: dictionaries.yesNo, required: true }, { key: "startDate", label: "开始日期", type: "date", required: true }, { key: "endDate", label: "结束日期", type: "date", required: true }, { key: "remark", label: "备注", type: "textarea" }],
    display: [
      { key: "expCom", label: "快递公司", options: dictionaries.expressCompanies }, { key: "expArea", label: "快递区域", options: dictionaries.provinces },
      { key: "totalPrice", label: "总成本", money: true }, { key: "salePrice", label: "销售价格", money: true },
      { key: "validity", label: "有效期", format: (row) => `${shortDate(row.startDate)} 至 ${shortDate(row.endDate)}` },
    ],
    expand: [
      { key: "goodsPrice", label: "商品成本", money: true },
      { key: "packagePrice", label: "包装费", money: true },
      { key: "expPrice", label: "快递费", money: true },
    ],
    note: (row) => [row.remark, row.updateBy ? `修改人：${row.updateBy}` : "", row.updateTime ? `修改时间：${shortDate(row.updateTime, true)}` : ""].filter(Boolean).join(" · "),
    importable: true,
    batchAction: {
      label: "批量改价",
      title: "批量改价（仅更新已填写字段）",
      fields: [
        { key: "goodsPrice", label: "商品成本", type: "number", placeholder: "留空则不改" },
        { key: "expPrice", label: "快递费", type: "number", placeholder: "留空则不改" },
        { key: "packagePrice", label: "包装费", type: "number", placeholder: "留空则不改" },
        { key: "salePrice", label: "销售价格", type: "number", placeholder: "留空则不改" },
      ],
      submit: async (values, ids) => {
        if (!ids.length) throw new Error("当前列表为空，请先加载要修改的价格方案");
        return apiRequest("/biz/price/batch", { method: "PUT", body: { ids, ...values } });
      },
      successMessage: () => "批量改价成功（已自动重算总成本）",
    },
  },
  stores: {
    key: "stores", title: "店铺管理", itemName: "店铺", api: "/biz/store", icon: StoreIcon, titleKey: "name",
    subtitle: (row) => String(row.code || "暂无店铺编码"),
    summary: [
      { key: "isDelete", label: "营业状态", tone: "default", valueFormat: (row) => Number(row.isDelete) === 1 ? "营业中" : Number(row.isDelete) === 2 ? "已暂停" : "未知" },
      { key: "orderCodeRequirePwd", label: "下单码", tone: "default", valueFormat: (row) => Number(row.orderCodeRequirePwd) === 1 ? (row.orderCodePwd ? "需要 · 密码已设" : "需要 · 密码未设") : "免下单码" },
    ],
    searchFields: [{ key: "code", label: "店铺编码" }, { key: "name", label: "店铺名称" }, { key: "isDelete", label: "营业状态", type: "select", options: STORE_STATUS_OPTIONS }, { key: "defPurchaser", label: "默认买家" }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", type: "date" }],
    fields: [{ key: "code", label: "店铺编码", required: true }, { key: "name", label: "店铺名称", required: true }, { key: "isDelete", label: "营业状态", type: "select", options: STORE_STATUS_OPTIONS, required: true }, { key: "notice", label: "店铺通知", type: "textarea" }, { key: "orderCodeRequirePwd", label: "需要下单码", type: "select", options: [{ value: "0", label: "否" }, { value: "1", label: "是" }] }, { key: "orderCodePwd", label: "店铺下单码", placeholder: "4-6 位数字，留空则买家单独配置" }, { key: "defPurchaser", label: "默认买家" }, { key: "noticeType", label: "通知类型", type: "select", options: dictionaries.platforms }, { key: "noticeUrl", label: "通知地址", type: "textarea" }],
    display: [{ key: "isDelete", label: "营业状态", options: STORE_STATUS_OPTIONS }, { key: "code", label: "店铺编码" }, { key: "orderCodeRequirePwd", label: "下单码", format: (row) => Number(row.orderCodeRequirePwd) === 1 ? "需要" : "不需要" }, { key: "defPurchaser", label: "默认买家" }, { key: "noticeType", label: "通知类型", options: dictionaries.platforms }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", format: (row) => shortDate(row.createTime) }, { key: "updateTime", label: "更新时间", format: (row) => shortDate(row.updateTime) }],
    note: (row) => [row.notice, row.noticeUrl].filter(Boolean).join(" · "),
  },
  };
}

export function CrudModule({ config, dictionaries, notify }: { config: CrudConfig; dictionaries: Dictionaries; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const Icon = config.icon;
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadAllState, setLoadAllState] = useState<{ loading: boolean; current: number; total: number }>({ loading: false, current: 0, total: 0 });
  const [syncAllState, setSyncAllState] = useState<{ loading: boolean; current: number; total: number; success: number; failed: number }>({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
  const [query, setQuery] = useState<DataRow>({ pageNum: 1, pageSize: 15 });
  const [pageKeyword, setPageKeyword] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [syncModeOpen, setSyncModeOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { setLoading(true); try { const result = await apiRequest<DataRow>(`${config.api}/list`, { query }); setRows(Array.isArray(result.rows) ? result.rows : []); setTotal(Number(result.total || 0)); } catch (error) { notify(error instanceof Error ? error.message : `${config.itemName}加载失败`, "error"); } finally { setLoading(false); } }, [config, notify, query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setExpanded(new Set()); setPageKeyword(""); }, [config.key]);
  const visibleRows = useMemo(() => {
    const keywords = pageKeyword.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!keywords.length) return rows;
    return rows.filter((row) => {
      const searchableText = [
        ...Object.values(row).map((value) => typeof value === "string" || typeof value === "number" ? String(value) : ""),
        config.subtitle?.(row),
        config.note?.(row),
        ...config.display.map((item) => item.format ? item.format(row) : optionLabel(row[item.key], item.options)),
        ...(config.expand || []).map((item) => item.format ? item.format(row) : optionLabel(row[item.key], item.options)),
        ...(config.summary || []).map((item) => item.valueFormat ? item.valueFormat(row) : String(row[item.key] ?? "")),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return keywords.every((keyword) => searchableText.includes(keyword));
    });
  }, [config, pageKeyword, rows]);
  async function edit(row: DataRow) { try { const result = await apiRequest<DataRow>(`${config.api}/${row.id}`); setEditor(result.data || row); } catch (error) { notify(error instanceof Error ? error.message : "数据加载失败", "error"); } }
  function resolveExtra(row: DataRow): { label: string; path: (row: DataRow) => string; method: string; danger?: boolean; confirm?: string } | null {
    if (!config.extraAction) return null;
    return typeof config.extraAction === "function" ? config.extraAction(row) : config.extraAction;
  }
  async function extra(row: DataRow) { const action = resolveExtra(row); if (!action) return; const doCall = async () => { try { await apiRequest(action.path(row), { method: action.method }); notify(`${action.label}成功`, "success"); load(); } catch (error) { notify(error instanceof Error ? error.message : "操作失败", "error"); } }; if (action.confirm) { setConfirm({ title: action.label, message: action.confirm, danger: action.danger, action: async () => { await doCall(); setConfirm(null); } }); } else { await doCall(); } }
  async function loadAllRows() {
    if (loadAllState.loading) return;
    const pageSize = Number(query.pageSize || 15) || 15;
    setLoadAllState({ loading: true, current: 0, total: 0 });
    const accumulated: DataRow[] = [];
    let serverTotal = 0;
    let pageNum = 1;
    const maxPages = 200;
    try {
      while (pageNum <= maxPages) {
        const result = await apiRequest<DataRow>(`${config.api}/list`, { query: { ...query, pageNum, pageSize } });
        const pageRows = Array.isArray(result.rows) ? result.rows : [];
        serverTotal = Number(result.total || 0);
        accumulated.push(...pageRows);
        setLoadAllState({ loading: true, current: accumulated.length, total: serverTotal });
        if (!pageRows.length || accumulated.length >= serverTotal) break;
        pageNum += 1;
      }
      setRows(accumulated);
      setTotal(serverTotal);
      notify(`已加载全部 ${accumulated.length} 条${config.itemName}`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : `加载所有${config.itemName}失败`, "error");
      if (accumulated.length) {
        setRows(accumulated);
        setTotal(serverTotal);
      }
    } finally {
      setLoadAllState({ loading: false, current: 0, total: 0 });
    }
  }

  /**
   * 账单"同步所有"专用：对传入的账单列表逐条同步
   * - allRows 已经是调用方（BillsSyncModeSheet）按 DSH/DFH 过滤后的结果（仅同步价格模式）；
   *   强制刷新模式则保持原样（全部）
   * - force=true：走 /biz/bill/forceSync/{id}（无视订单状态）
   * - force=false：走 /biz/bill/{id}（后端仍兜底校验状态）
   * 不做分页：调用方已经一次性拉完所有账单
   * 进度会写到 syncAllState，"同步所有"按钮在同步期间显示 "同步中 X/Y"
   */
  async function syncBillRows(allRows: DataRow[], force: boolean) {
    if (!allRows.length) { notify("没有可同步的账单", "info"); return; }
    // allRows 已经是调用方按 DSH/DFH 过滤后的结果（仅同步价格模式）；强制刷新模式则保持原样
    const total = allRows.length;
    let processed = 0, success = 0, failed = 0;
    const failedDetails: { id: unknown; orderCode: string; status: string; message: string }[] = [];
    setSyncAllState({ loading: true, current: 0, total, success: 0, failed: 0 });
    notify(force ? `开始强制刷新 ${total} 条账单…` : `开始同步价格 ${total} 条账单…`, "info");
    try {
      for (const row of allRows) {
        const status = String(row.orderStatus || "");
        const path = force ? `/biz/bill/forceSync/${row.id}` : `/biz/bill/${row.id}`;
        try {
          await apiRequest(path, { method: "PATCH" });
          success += 1;
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "未知错误";
          const detail = { id: row.id, orderCode: String(row.orderCode || ""), status, message };
          failedDetails.push(detail);
          // 失败明细写 console，方便用户排查
          console.warn(`[syncBill] failed → id=${detail.id} orderCode=${detail.orderCode} status=${detail.status || "(空)"} path=${path}`, detail.message);
        }
        processed += 1;
        setSyncAllState({ loading: true, current: processed, total, success, failed });
      }
      let summary: string = force
        ? `强制刷新完成：成功 ${success} 条，失败 ${failed} 条`
        : `同步完成：成功 ${success} 条，失败 ${failed} 条`;
      if (failedDetails.length) {
        const preview = failedDetails.slice(0, 3).map((d) => `${d.orderCode || d.id}: ${d.message}`).join("；");
        summary += `。失败明细：${preview}${failedDetails.length > 3 ? `…（共 ${failedDetails.length} 条，全部明细见 Console）` : ""}`;
      }
      notify(summary, failed ? "info" : "success");
      load();
    } catch (error) {
      notify(error instanceof Error ? error.message : `同步所有${config.itemName}失败`, "error");
    } finally {
      setSyncAllState({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
    }
  }
  function toggleExpand(id: string | number) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function copyText(text: string, message: string) {
    const ok = await copyToClipboard(text);
    notify(ok ? message : "复制失败，请手动选择文本复制", ok ? "success" : "error");
  }
  // 店铺专用：快速切换营业/暂停（PUT 全量对象，仅翻 isDelete 一个字段）
  async function toggleStoreStatus(row: DataRow) {
    const isOpen = Number(row.isDelete) === 1;
    const nextValue = isOpen ? 2 : 1;
    setConfirm({
      title: isOpen ? "暂停营业" : "恢复营业",
      message: isOpen ? `暂停后「${row.name || row.code || "该店铺"}」将从列表隐藏（仍可在筛选里选「已关闭」查回），确认？` : `恢复后「${row.name || row.code || "该店铺"}」将重新出现在列表里，确认？`,
      action: async () => {
        try {
          await apiRequest(config.api, { method: "PUT", body: { ...row, isDelete: nextValue } });
          notify(isOpen ? "已暂停营业" : "已恢复营业", "success");
          setConfirm(null);
          load();
        } catch (error) {
          notify(error instanceof Error ? error.message : "切换营业状态失败", "error");
          setConfirm(null);
        }
      },
    });
  }
  function displayValue(row: DataRow, item: CrudConfig["display"][number]) {
    if (item.format) return item.format(row);
    const value = row[item.key];
    if (value === null || value === undefined || value === "") return "--";
    if (item.money) return `¥${Number(value).toFixed(2)}`;
    return optionLabel(value, item.options);
  }
  function summaryValue(row: DataRow, item: NonNullable<CrudConfig["summary"]>[number]) {
    if (item.valueFormat) return item.valueFormat(row);
    const value = row[item.key];
    if (value === null || value === undefined || value === "") return item.money ? "¥0.00" : "--";
    if (item.money) {
      const num = Number(value);
      const sign = num < 0 ? "-" : "";
      return `${sign}¥${Math.abs(num).toFixed(2)}`;
    }
    return String(value);
  }
  function summaryTone(row: DataRow, item: NonNullable<CrudConfig["summary"]>[number]): "default" | "success" | "danger" {
    if (item.tone !== "success") return item.tone || "default";
    const num = Number(row[item.key]);
    if (Number.isFinite(num)) return num < 0 ? "danger" : "success";
    return "success";
  }
  return (
    <div className="module-page">
      <div className="module-hero compact-hero"><div><span className="eyebrow">订单管理模块</span><h1>{config.title}</h1><p>共 {total} 条数据，支持手机端快速维护</p></div><button className="round-add" type="button" onClick={() => setEditor("new")}><Plus size={22} /><span>新增</span></button></div>
      <div className="toolbar-card search-toolbar"><label className="quick-search"><Search size={15} strokeWidth={2.2} /><input value={pageKeyword} onChange={(event) => setPageKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="检索本页关键信息" aria-label={`检索当前页面已加载的${config.itemName}内容`} enterKeyHint="search" />{pageKeyword ? <button className="search-clear" type="button" aria-label="清空本页检索" onClick={() => setPageKeyword("")}><X size={14} /></button> : null}</label><button className={`filter-chip${config.searchFields.some((field) => String(query[field.key] || "").trim()) ? " active" : ""}`} type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={14} strokeWidth={2.2} />筛选</button><button className="toolbar-icon" type="button" onClick={load} aria-label="刷新"><RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} /></button></div>
      <div className="secondary-actions">
        <button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/export`, query, `${config.key}_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><Download size={16} />导出</button>
        {config.importable ? <><button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />导入</button><button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/importTemplate`, {}, `${config.key}_template_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><FileSpreadsheet size={16} />模板</button><input ref={fileRef} hidden type="file" accept=".xls,.xlsx" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadFile(`${config.api}/importData`, file, { updateSupport: false }); notify("导入成功", "success"); load(); } catch (error) { notify(error instanceof Error ? error.message : "导入失败", "error"); } event.target.value = ""; }} /></> : null}
        <button type="button" onClick={loadAllRows} disabled={loadAllState.loading || (total > 0 && rows.length >= total)} className={loadAllState.loading ? "is-loading" : ""}>
          {loadAllState.loading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
          {loadAllState.loading ? (loadAllState.total ? `加载中 ${loadAllState.current}/${loadAllState.total}` : "加载中…") : "加载所有"}
        </button>
        {config.key === "bills" && config.extraAction ? <button type="button" onClick={() => setSyncModeOpen(true)} disabled={syncAllState.loading || !rows.length} className={syncAllState.loading ? "is-loading" : ""}>
          {syncAllState.loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          {syncAllState.loading ? (syncAllState.total ? `同步中 ${syncAllState.current}/${syncAllState.total} · 成功${syncAllState.success}/失败${syncAllState.failed}` : "同步中…") : "同步所有"}
        </button> : null}
        {config.batchAction ? <button type="button" className="primary-action" onClick={() => setBatchOpen(true)} disabled={!visibleRows.length}>
          <Sparkles size={16} />{config.batchAction.label}
          <small>· 当前 {visibleRows.length} 条</small>
        </button> : null}
      </div>
      <div className="list-heading"><div><h2>{config.itemName}列表</h2><span>共 {total} 条{pageKeyword.trim() ? ` · 本页匹配 ${visibleRows.length} 条` : ""}</span></div></div>
      <div className="mobile-card-list">
        {!visibleRows.length ? <EmptyState loading={loading} label={pageKeyword.trim() ? "本页匹配结果" : config.itemName} /> : visibleRows.map((row) => {
          const note = config.note?.(row) || "";
          const summary = config.summary;
          const expand = config.expand;
          const isOpen = expanded.has(row.id as string | number);
          const hasExpand = !!expand?.length;
          return <article className={`data-card data-card-${config.key}`} key={String(row.id)}>
            <div className="data-card-head"><span className="data-icon"><Icon size={20} /></span><div><b>{row[config.titleKey] || `未命名${config.itemName}`}</b><small>{config.subtitle?.(row) || shortDate(row.createTime, true)}</small></div>{config.key === "express" ? <StatusBadge row={row} /> : config.key === "stores" ? <StoreStatusBadge row={row} /> : config.key === "bills" && row.orderStatus ? (() => { const status = String(row.orderStatus); const tone = status === "DSH" || status === "DFH" ? "status-success" : status === "YQX" || status === "YC" ? "status-neutral" : "status-warning"; const label = row.orderStatusDesc || status; return <span className={`status ${tone}`}><span />{label}</span>; })() : row.isDefault !== undefined ? <span className={`status ${Number(row.isDefault) === 1 ? "status-success" : "status-neutral"}`}><span />{Number(row.isDefault) === 1 ? "默认" : "普通"}</span> : null}</div>
            {summary?.length ? <div className={`data-card-summary data-card-summary-${summary.length}`}>{summary.map((item) => { const tone = summaryTone(row, item); return <div className={`summary-cell tone-${tone}`} key={item.key}><span>{item.label}</span><b>{summaryValue(row, item)}</b></div>; })}</div> : null}
            <div className="data-metrics">{config.display.map((item) => <div key={item.key} className={item.fullWidth ? "full-width" : ""}><span>{item.label}</span><b className={item.money ? "money" : ""}>{displayValue(row, item)}</b></div>)}</div>
            {hasExpand ? <div className={`expand-wrapper ${isOpen ? "open" : ""}`}><div className="expand-inner"><div className="data-metrics data-metrics-expand">{expand!.map((item) => <div key={item.key}><span>{item.label}</span><b className={item.money ? "money" : ""}>{displayValue(row, item)}</b></div>)}</div></div></div> : null}
            {hasExpand ? <button type="button" className={`data-more-toggle ${isOpen ? "open" : ""}`} onClick={() => toggleExpand(row.id as string | number)} aria-expanded={isOpen}><span>{isOpen ? "收起明细" : "查看更多"}</span><ChevronDown size={15} /></button> : null}
            {note ? <p className="data-note">{note}</p> : null}
            {config.key === "stores" ? <div className="store-extras">
              {row.notice ? <div className="store-extra-line"><span><Bell size={13} />{row.noticeType ? optionLabel(row.noticeType, dictionaries.platforms) : "店铺通知"}</span><b>{row.notice}</b></div> : null}
              {row.noticeUrl ? <div className="store-extra-line"><span><ExternalLink size={13} />通知地址</span><b className="store-notice-url">{row.noticeUrl}</b><button type="button" className="store-extra-copy" onClick={() => copyText(String(row.noticeUrl), "通知地址已复制")}><Copy size={12} />复制</button></div> : null}
              {row.orderCodeRequirePwd && row.orderCodePwd ? <div className="store-extra-line"><span><LockKeyhole size={13} />店铺下单码</span><b>{row.orderCodePwd}</b><button type="button" className="store-extra-copy" onClick={() => copyText(String(row.orderCodePwd), "下单码已复制")}><Copy size={12} />复制</button></div> : null}
            </div> : null}
            <div className="card-actions"><button type="button" onClick={() => edit(row)}><Pencil size={16} />修改</button>{config.key === "stores" ? <button type="button" className="primary-action" onClick={() => toggleStoreStatus(row)}><Power size={16} />{Number(row.isDelete) === 1 ? "暂停营业" : "恢复营业"}</button> : null}{(() => { const action = resolveExtra(row); if (!action) return null; return <button type="button" className={action.danger ? "primary-action danger-action" : "primary-action"} onClick={() => extra(row)}><RefreshCw size={16} />{action.label}</button>; })()}<button type="button" className="danger-text" onClick={() => setConfirm({ title: `删除${config.itemName}`, message: "删除后无法恢复，是否继续？", danger: true, action: async () => { await apiRequest(`${config.api}/${row.id}`, { method: "DELETE" }); notify("删除成功", "success"); load(); } })}><Trash2 size={16} />删除</button></div>
          </article>;
        })}
      </div>
      {rows.length < total ? <button className="load-more" type="button" onClick={() => setQuery((current: DataRow) => ({ ...current, pageSize: Number(current.pageSize || 15) + 15 }))}><ChevronRight size={17} />加载更多</button> : null}
      <Sheet open={filterOpen} title={`筛选${config.itemName}`} onClose={() => setFilterOpen(false)}>
        <form
          className="filter-sheet"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery((current: DataRow) => ({ ...current, pageNum: 1 }));
            setFilterOpen(false);
            load();
          }}
        >
          <div className="filter-sheet-body">
            <section className="filter-section">
              <header><h3>筛选条件</h3></header>
              <div className="filter-field-stack">
                {config.searchFields.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <FieldInput field={field} value={query[field.key]} onChange={(value) => setQuery((current: DataRow) => ({ ...current, [field.key]: value }))} />
                  </label>
                ))}
              </div>
            </section>
          </div>
          <div className="filter-sheet-footer">
            <button type="button" className="filter-reset" onClick={() => setQuery({ pageNum: 1, pageSize: 15 })}>重置</button>
            <button className="filter-apply" type="submit">查看结果</button>
          </div>
        </form>
      </Sheet>
      <Sheet open={editor !== null} title={`${editor === "new" ? "新增" : "修改"}${config.itemName}`} onClose={() => setEditor(null)} wide>{editor !== null ? <CrudEditor config={config} initial={editor === "new" ? null : editor} onClose={() => setEditor(null)} onSaved={load} notify={notify} /> : null}</Sheet>
      {config.batchAction ? <Sheet open={batchOpen} title={config.batchAction.title} onClose={() => setBatchOpen(false)} wide>
        <BatchEditor config={config} rows={visibleRows} onSaved={() => { setBatchOpen(false); load(); }} notify={notify} />
      </Sheet> : null}
      {config.key === "bills" ? <Sheet open={syncModeOpen} title="选择同步方式" onClose={() => setSyncModeOpen(false)}>
        <BillsSyncModeSheet api={config.api} query={query} onClose={() => setSyncModeOpen(false)} onSync={(allRows, force) => { setSyncModeOpen(false); void syncBillRows(allRows, force); }} />
      </Sheet> : null}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export function BillsSyncModeSheet({ api, query, onClose, onSync }: { api: string; query: Record<string, unknown>; onClose: () => void; onSync: (allRows: DataRow[], force: boolean) => void }) {
  // 打开时按当前筛选（query）拉全部分页的账单，保证"将同步"的数量就是用户筛选条件下的全部
  // 跟列表里的搜索状态联动：选了状态过滤就只对那部分生效
  const [allRows, setAllRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmingForce, setConfirmingForce] = useState(false);
  // 把 query 转成稳定字符串，避免父组件重渲导致 useEffect 死循环
  const queryKey = useMemo(() => JSON.stringify(query), [query]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setLoadError("");
      const pageSize = 500;
      const maxPages = 200;
      const collected: DataRow[] = [];
      const baseQuery = JSON.parse(queryKey) as Record<string, unknown>;
      let pageNum = 1;
      try {
        while (pageNum <= maxPages) {
          const result = await apiRequest<DataRow>(`${api}/list`, { query: { ...baseQuery, pageNum, pageSize } });
          const pageRows = Array.isArray(result.rows) ? result.rows : [];
          const serverTotal = Number(result.total || 0);
          collected.push(...pageRows);
          if (!pageRows.length || collected.length >= serverTotal) break;
          pageNum += 1;
        }
        if (cancelled) return;
        setAllRows(collected);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "加载账单失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, queryKey]);
  // 按订单状态分桶：DSH/DFH = 可同步；其他 = 仅"强制刷新"才动
  const normalCount = allRows.filter((row) => { const s = String(row.orderStatus || ""); return s === "DSH" || s === "DFH"; }).length;
  const restrictedCount = allRows.length - normalCount;
  // 描述一下当前是不是带筛选（query 里去掉分页参数还有别的就是带筛选）
  const hasFilter = Object.keys(JSON.parse(queryKey) as Record<string, unknown>).filter((key) => key !== "pageNum" && key !== "pageSize").length > 0;
  return <>
    <div className="sync-mode-sheet">
      {loading ? <div className="batch-hint"><LoaderCircle className="spin" size={14} /> 正在加载当前筛选下的账单…</div> : loadError ? <div className="sync-mode-warning"><AlertTriangle size={14} />{loadError}</div> : <>
        <div className="batch-hint">{hasFilter ? "当前筛选" : "全量"} <b>{allRows.length}</b> 条账单，两种模式覆盖范围不同，请按需选择。</div>
        <div className="sync-mode-stat" aria-label="状态分桶">
          <span><b>{normalCount}</b> 条 待处理/待发货</span>
          <span className={restrictedCount > 0 ? "is-danger" : ""}><b>{restrictedCount}</b> 条 其他状态</span>
        </div>
      </>}
      <div className="sync-mode-list">
        <button type="button" className="sync-mode-card" onClick={() => onSync(allRows.filter((row) => { const s = String(row.orderStatus || ""); return s === "DSH" || s === "DFH"; }), false)} disabled={loading || !normalCount}>
          <span className="sync-mode-card-icon"><RefreshCw size={17} /></span>
          <div className="sync-mode-card-body">
            <div className="sync-mode-card-title">仅同步价格</div>
            <div className="sync-mode-card-desc">只处理「待处理 / 待发货」状态（<b>{normalCount}</b> 条）。<br/>其他状态（<b>{restrictedCount}</b> 条）会被自动跳过，避免覆盖已发货后的成本。</div>
          </div>
          <ChevronRight size={15} className="sync-mode-card-chevron" />
        </button>
        <button type="button" className="sync-mode-card sync-mode-card-danger" onClick={() => setConfirmingForce(true)} disabled={loading || !allRows.length}>
          <span className="sync-mode-card-icon sync-mode-card-icon-danger"><AlertTriangle size={17} /></span>
          <div className="sync-mode-card-body">
            <div className="sync-mode-card-title">强制刷新{hasFilter ? "筛选结果" : "全部"}</div>
            <div className="sync-mode-card-desc">无视订单状态，覆盖{hasFilter ? "当前筛选" : "全量"} <b>{allRows.length}</b> 条账单的价格。<br/>已发货/已完成订单的成本也会被改写，请确认价格方案已稳定后再使用。</div>
          </div>
          <ChevronRight size={15} className="sync-mode-card-chevron" />
        </button>
      </div>
      <button className="button button-ghost button-block" type="button" onClick={onClose}>取消</button>
    </div>
    {confirmingForce ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirmingForce(false)}><section className="purchaser-create-modal purchaser-confirm-modal sync-mode-confirm">
      <button type="button" onClick={() => setConfirmingForce(false)}><X size={18} /></button>
      <span className="danger"><AlertTriangle size={22} /></span>
      <small>FORCE REFRESH</small>
      <h2>确认强制刷新{hasFilter ? "筛选结果" : "全部账单"}？</h2>
      <p>此操作会覆盖{hasFilter ? "当前筛选的" : "全部"} <b>{allRows.length}</b> 条账单的价格（包含已发货/已完成的），操作不可撤销。</p>
      <div className="sync-mode-warning"><AlertTriangle size={14} />已发货后覆盖成本会与买家已付款金额不一致，请先与财务核对</div>
      <div className="purchaser-create-actions">
        <button type="button" className="purchaser-create-action secondary" onClick={() => setConfirmingForce(false)}>再考虑一下</button>
        <button type="button" className="purchaser-create-action danger" onClick={() => { setConfirmingForce(false); onSync(allRows, true); }}><AlertTriangle size={15} />确认强制刷新</button>
      </div>
    </section></div> : null}
  </>;
}

export function BatchEditor({ config, rows, onSaved, notify }: { config: CrudConfig; rows: DataRow[]; onSaved: () => void; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const action = config.batchAction!;
  const [values, setValues] = useState<DataRow>({});
  const [saving, setSaving] = useState(false);
  const ids = rows.map((r) => r.id).filter((id): id is string | number => id !== undefined && id !== null);
  function update(key: string, value: unknown) { setValues((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = await action.submit(values, ids);
      notify(action.successMessage ? action.successMessage(payload) : "操作成功", "success");
      onSaved();
    } catch (error) {
      notify(error instanceof Error ? error.message : "操作失败", "error");
    } finally {
      setSaving(false);
    }
  }
  return <form className="mobile-form" onSubmit={submit}>
    <p className="batch-hint">将作用于当前已加载的 <b>{ids.length}</b> 条数据。仅修改下方已填写的字段；总成本（商品+快递+包装）会在改完后自动重算。</p>
    <div className="form-grid">{action.fields.map((field) => <label key={field.key}><span>{field.label}</span><FieldInput field={field} value={values[field.key]} onChange={(value) => update(field.key, value)} /></label>)}</div>
    <button className="button button-primary button-block" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}批量更新</button>
  </form>;
}

export function CrudEditor({ config, initial, onClose, onSaved, notify }: { config: CrudConfig; initial: DataRow | null; onClose: () => void; onSaved: () => void; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const [form, setForm] = useState<DataRow>(() => ({ ...(config.key === "stores" ? { isDelete: 1 } : {}), ...(initial || {}) }));
  const [saving, setSaving] = useState(false);
  function update(key: string, value: unknown) { setForm((current) => { const next = { ...current, [key]: value }; if (config.key === "bills") { const total = Number(next.goodsPrice || 0) + Number(next.packagePrice || 0) + Number(next.expPrice || 0) + Number(next.addPrice || 0); next.totalPrice = total; } if (config.key === "prices") next.totalPrice = Number(next.goodsPrice || 0) + Number(next.expPrice || 0) + Number(next.packagePrice || 0); return next; }); }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { const payload = { ...form }; if (config.key === "express" && typeof payload.expTime === "string") payload.expTime = payload.expTime.replace("T", " "); if (config.key === "stores") payload.isDelete = Number(payload.isDelete || 1); await apiRequest(config.api, { method: form.id ? "PUT" : "POST", body: payload }); notify(form.id ? "修改成功" : "新增成功", "success"); onSaved(); onClose(); } catch (error) { notify(error instanceof Error ? error.message : "保存失败", "error"); } finally { setSaving(false); } }
  return <form className={`mobile-form sheet-editor-form crud-editor-form crud-editor-form-${config.key}`} onSubmit={submit}><div className="form-grid">{config.fields.map((field) => <label className={field.type === "textarea" ? "span-full" : ""} key={field.key}><span>{field.label}{field.required ? " *" : ""}</span><FieldInput field={field} value={form[field.key]} onChange={(value) => update(field.key, value)} /></label>)}</div><button className="button button-primary button-block" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}保存</button></form>;
}
