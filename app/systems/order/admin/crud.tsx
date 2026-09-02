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
  Mail,
  Pencil,
  Plus,
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
import { API_PATHS } from "../../../lib/pathConventions";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, copyToClipboard, downloadFile, uploadFile } from "../../../lib/api";
import type { DataRow, Dictionaries, FieldConfig, MenuKey } from "./core";
import {
  EXPRESS_STATUS_OPTIONS,
  optionLabel,
  orderTypeLabel,
  shortDate,
  STORE_STATUS_OPTIONS,
} from "./core";
import { StatusBadge } from "./logistics";
import PurchaserFilterSearch from "./PurchaserFilterSearch";
import { ConfirmDialog, EmptyState, FieldInput, Sheet } from "./ui";
import { applyCrudOverride, type CrudOverridesConfig } from "./crudConfigs.config";

const BILL_PAY_STATUS_OPTIONS = [
  { value: 0, label: "未付款" },
  { value: 1, label: "已付款" },
  { value: 2, label: "已退款" },
  { value: 3, label: "待确认" },
];

const STORE_BLOCK_DISPLAY_OPTIONS = [
  { value: "banner", label: "顶部提示" },
  { value: "fullscreen", label: "整页拦截" },
  { value: "confirm", label: "确认弹窗" },
];

function billOrderStatusLabel(row: DataRow, dictionaries: Dictionaries) {
  const desc = String(row.orderStatusDesc || "").trim();
  if (desc && desc !== String(row.orderStatus || "")) return desc;
  return optionLabel(row.orderStatus, dictionaries.orderStatuses);
}

function billPayStatusLabel(row: DataRow) {
  const desc = String(row.payStatusDesc || "").trim();
  if (desc && desc !== String(row.payStatus ?? "")) return desc;
  return optionLabel(row.payStatus, BILL_PAY_STATUS_OPTIONS);
}

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

export function createCrudConfigs(dictionaries: Dictionaries, overrides: CrudOverridesConfig = { version: 1, overrides: {} }): Record<Exclude<MenuKey, "home" | "orders" | "orderEntry" | "batchOrder" | "orderLink" | "purchasers" | "tracking" | "logistics" | "shortLinks" | "products" | "systemCenter" | "operationsCenter" | "mobileMenu" | "sysUsers" | "sysRoles" | "sysDepts" | "sysPosts" | "sysMenus" | "sysDictTypes" | "sysConfigs" | "sysRiskIps" | "sysNotices" | "opsOnline" | "opsJobs" | "opsJobLogs" | "opsOperLogs" | "opsLoginLogs" | "opsServer" | "opsCache" | "opsDruid" | "opsGenerator" | "opsSwagger" | "opsMessages">, CrudConfig> {
  const ov = overrides.overrides;
  const base: Record<Exclude<MenuKey, "home" | "orders" | "orderEntry" | "batchOrder" | "orderLink" | "purchasers" | "tracking" | "logistics" | "shortLinks" | "products" | "systemCenter" | "operationsCenter" | "mobileMenu" | "sysUsers" | "sysRoles" | "sysDepts" | "sysPosts" | "sysMenus" | "sysDictTypes" | "sysConfigs" | "sysRiskIps" | "sysNotices" | "opsOnline" | "opsJobs" | "opsJobLogs" | "opsOperLogs" | "opsLoginLogs" | "opsServer" | "opsCache" | "opsDruid" | "opsGenerator" | "opsSwagger" | "opsMessages">, CrudConfig> = {
  bills: {
    key: "bills", title: "账单管理", itemName: "账单", api: API_PATHS.billing.bills, icon: ReceiptText, titleKey: "orderCode",
    subtitle: (row) => `${row.orderNameDesc || optionLabel(row.orderName, dictionaries.products)} · ${orderTypeLabel(row.orderType, dictionaries.sizes, row.orderTypeDesc)} · ${row.customer || "暂无收件人"}`,
    searchFields: [
      { key: "orderCode", label: "订单号" },
      { key: "orderStatus", label: "订单状态", type: "select", options: dictionaries.orderStatuses },
      { key: "payStatus", label: "付款状态", type: "select", options: BILL_PAY_STATUS_OPTIONS },
      { key: "orderName", label: "商品名称", type: "select", options: dictionaries.products },
      { key: "orderType", label: "商品规格", type: "select", options: dictionaries.sizes },
      { key: "customer", label: "收件人" },
      { key: "phone", label: "手机号" },
      { key: "purchaser", label: "下单人" },
      { key: "expCom", label: "快递公司", type: "select", options: dictionaries.expressCompanies },
      { key: "expCode", label: "快递单号" },
      { key: "orderTime", label: "下单时间", type: "date" },
      { key: "orderDesc", label: "备注" },
      { key: "createBy", label: "创建人" },
    ],
    fields: [{ key: "orderCode", label: "订单号", required: true }, { key: "goodsPrice", label: "商品成本", type: "number" }, { key: "packagePrice", label: "包装费", type: "number" }, { key: "expPrice", label: "快递费", type: "number" }, { key: "addPrice", label: "附加费", type: "number" }, { key: "totalPrice", label: "总成本", type: "number", readonly: true }, { key: "remark", label: "备注", type: "textarea" }],
    summary: [
      { key: "totalPrice", label: "总成本", money: true, tone: "default" },
      { key: "salePrice", label: "销售价格", money: true, tone: "default" },
      { key: "gainPrice", label: "利润", money: true, tone: "success" },
    ],
    display: [
      { key: "orderName", label: "商品名称", options: dictionaries.products },
      { key: "orderTypeNum", label: "规格×数量", format: (row) => `${orderTypeLabel(row.orderType, dictionaries.sizes, row.orderTypeDesc)} × ${row.orderNum || 1}` },
      { key: "orderStatus", label: "订单状态", format: (row) => billOrderStatusLabel(row, dictionaries) },
      { key: "payStatus", label: "付款状态", format: (row) => billPayStatusLabel(row) },
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
          path: () => `${API_PATHS.billing.bills}/force-sync/${row.id}`,
          method: "PATCH",
          danger: true,
          confirm: `该账单关联订单状态为「${billOrderStatusLabel(row, dictionaries)}」，已发货/已产生物流的价格通常不应再被覆盖。\n\n确认要强制刷新吗？（会重算成本）`,
        };
      }
      return { label: "同步价格", path: () => `${API_PATHS.billing.bills}/${row.id}`, method: "PATCH" };
    },
  },
  express: {
    key: "express", title: "快递管理", itemName: "快递信息", api: API_PATHS.logistics.shipments, icon: Truck, titleKey: "expCode",
    subtitle: (row) => String(row.orderCode || "暂无关联订单"),
    searchFields: [{ key: "orderCode", label: "订单号" }, { key: "expCode", label: "快递单号" }, { key: "expTime", label: "快递时间", type: "date" }, { key: "expStatus", label: "快递状态", type: "select", options: EXPRESS_STATUS_OPTIONS }],
    fields: [{ key: "expCode", label: "快递单号", required: true }, { key: "expTime", label: "快递时间", type: "datetime-local" }, { key: "expStatus", label: "快递状态", type: "select", options: EXPRESS_STATUS_OPTIONS }, { key: "expDesc", label: "快递描述", type: "textarea" }],
    display: [{ key: "orderCode", label: "订单号" }, { key: "expStatus", label: "快递状态", format: (row) => String(row.expStatusDesc || optionLabel(row.expStatus, EXPRESS_STATUS_OPTIONS)) }, { key: "expTime", label: "快递时间", format: (row) => shortDate(row.expTime, true) }],
    note: (row) => String(row.expDesc || ""),
    extraAction: { label: "刷新物流", path: (row) => `${API_PATHS.logistics.shipments}/refresh/${row.orderCode || row.expCode}`, method: "PATCH" },
  },
  prices: {
    key: "prices", title: "价格管理", itemName: "价格方案", api: API_PATHS.catalog.prices, icon: BadgeDollarSign, titleKey: "priceCode",
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
        return apiRequest(`${API_PATHS.catalog.prices}/batch`, { method: "PUT", body: { ids, ...values } });
      },
      successMessage: () => "批量改价成功（已自动重算总成本）",
    },
  },
  stores: {
    key: "stores", title: "店铺管理", itemName: "店铺", api: API_PATHS.stores.root, icon: StoreIcon, titleKey: "name",
    subtitle: (row) => String(row.code || "暂无店铺编码"),
    summary: [
      { key: "isDelete", label: "营业状态", tone: "default", valueFormat: (row) => Number(row.isDelete) === 1 ? "营业中" : Number(row.isDelete) === 2 ? "已暂停" : "未知" },
      { key: "orderCodeRequirePwd", label: "下单码", tone: "default", valueFormat: (row) => Number(row.orderCodeRequirePwd) === 1 ? (row.orderCodePwd ? "需要 · 密码已设" : "需要 · 密码未设") : "免下单码" },
      { key: "blockOrder", label: "下单拦截", tone: "danger", valueFormat: (row) => Number(row.blockOrder) === 1 ? "已禁止" : "未拦截" },
      { key: "blockQuery", label: "查单拦截", tone: "danger", valueFormat: (row) => Number(row.blockQuery) === 1 ? "已禁止" : "未拦截" },
      { key: "accountRequired", label: "客户账号", tone: "default", valueFormat: (row) => Number(row.accountRequired) === 1 ? "统一要求注册" : "按买家设置" },
      { key: "mailEnabled", label: "邮件发送", tone: "default", valueFormat: (row) => Number(row.mailEnabled) === 1 ? (Number(row.mailDefault) === 1 ? "已启用 · 默认" : "已启用") : "未配置" },
    ],
    searchFields: [{ key: "code", label: "店铺编码" }, { key: "name", label: "店铺名称" }, { key: "isDelete", label: "营业状态", type: "select", options: STORE_STATUS_OPTIONS }, { key: "defPurchaser", label: "默认买家" }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", type: "date" }],
    fields: [{ key: "code", label: "店铺编码", required: true }, { key: "name", label: "店铺名称", required: true }, { key: "defPurchaser", label: "默认买家", placeholder: "可选，用于新建订单时默认带入" }],
    display: [{ key: "isDelete", label: "营业状态", options: STORE_STATUS_OPTIONS }, { key: "code", label: "店铺编码" }, { key: "accountRequired", label: "转换注册客户", format: (row) => Number(row.accountRequired) === 1 ? "店铺统一要求" : "按买家设置" }, { key: "orderCodeRequirePwd", label: "下单码", format: (row) => Number(row.orderCodeRequirePwd) === 1 ? "需要" : "不需要" }, { key: "blockOrder", label: "禁止下单", format: (row) => Number(row.blockOrder) === 1 ? "已禁止" : "未拦截" }, { key: "blockQuery", label: "禁止查单", format: (row) => Number(row.blockQuery) === 1 ? "已禁止" : "未拦截" }, { key: "blockDisplayType", label: "拦截展示", options: STORE_BLOCK_DISPLAY_OPTIONS }, { key: "defPurchaser", label: "默认买家" }, { key: "noticeType", label: "通知类型", options: dictionaries.platforms }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", format: (row) => shortDate(row.createTime) }, { key: "updateTime", label: "更新时间", format: (row) => shortDate(row.updateTime) }],
    note: (row) => [row.notice, row.noticeUrl].filter(Boolean).join(" · "),
  },
  };
  return applyCrudConfigOverrides(base, ov);
}

function applyCrudConfigOverrides<T extends Record<string, CrudConfig>>(
  base: T,
  overrides: CrudOverridesConfig["overrides"],
): T {
  if (!overrides) return base;
  const out = { ...base } as T;
  for (const key of Object.keys(overrides)) {
    const cfg: CrudConfig | undefined = out[key];
    const o = overrides[key as keyof typeof overrides];
    if (!cfg || !o) continue;
    const next: CrudConfig = { ...cfg };
    if (o.searchFields) next.searchFields = applyCrudOverride(next.searchFields, o.searchFields);
    if (o.fields) next.fields = applyCrudOverride(next.fields, o.fields);
    if (o.display) next.display = applyCrudOverride(next.display, o.display);
    if (o.expand && next.expand) next.expand = applyCrudOverride(next.expand, o.expand);
    if (o.summary && next.summary) next.summary = applyCrudOverride(next.summary, o.summary);
    (out as Record<string, CrudConfig>)[key] = next;
  }
  return out;
}

function BillOrderFilter({
  dictionaries,
  query,
  purchasers,
  onChange,
}: {
  dictionaries: Dictionaries;
  query: DataRow;
  purchasers: DataRow[];
  onChange: (key: string, value: unknown) => void;
}) {
  return <>
    <section className="filter-section">
      <header><h3>订单状态</h3></header>
      <div className="filter-chips" role="listbox" aria-label="订单状态">
        <button type="button" className={!query.orderStatus ? "active" : ""} onClick={() => onChange("orderStatus", "")}>全部</button>
        {dictionaries.orderStatuses.map((item) => <button type="button" key={item.value} className={String(query.orderStatus || "") === String(item.value) ? "active" : ""} onClick={() => onChange("orderStatus", item.value)}>{item.label}</button>)}
      </div>
    </section>
    <section className="filter-section">
      <header><h3>付款状态</h3></header>
      <div className="filter-chips" role="listbox" aria-label="付款状态">
        <button type="button" className={query.payStatus === "" || query.payStatus === null || query.payStatus === undefined ? "active" : ""} onClick={() => onChange("payStatus", "")}>全部</button>
        <button type="button" className={String(query.payStatus ?? "") === "1" ? "active" : ""} onClick={() => onChange("payStatus", "1")}>已付款</button>
        <button type="button" className={String(query.payStatus ?? "") === "3" ? "active" : ""} onClick={() => onChange("payStatus", "3")}>待确认</button>
        <button type="button" className={String(query.payStatus ?? "") === "0" ? "active" : ""} onClick={() => onChange("payStatus", "0")}>未付款</button>
      </div>
    </section>
    <section className="filter-section">
      <header><h3>商品与规格</h3></header>
      <div className="filter-field-grid">
        <label><span>商品</span><select value={query.orderName || ""} onChange={(event) => onChange("orderName", event.target.value)}><option value="">全部商品</option>{dictionaries.products.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>规格</span><select value={query.orderType || ""} onChange={(event) => onChange("orderType", event.target.value)}><option value="">全部规格</option>{dictionaries.sizes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
    </section>
    <section className="filter-section">
      <header><h3>收件信息</h3></header>
      <div className="filter-field-stack">
        <label><span>订单号</span><input value={query.orderCode || ""} onChange={(event) => onChange("orderCode", event.target.value)} placeholder="输入订单号" /></label>
        <div className="filter-field-grid">
          <label><span>收件人</span><input value={query.customer || ""} onChange={(event) => onChange("customer", event.target.value)} placeholder="姓名" /></label>
          <label><span>手机号</span><input inputMode="tel" value={query.phone || ""} onChange={(event) => onChange("phone", event.target.value)} placeholder="手机号" /></label>
        </div>
      </div>
    </section>
    <section className="filter-section">
      <header><h3>物流与人员</h3></header>
      <div className="filter-field-stack">
        <div className="filter-field-grid">
          <label><span>快递公司</span><select value={query.expCom || ""} onChange={(event) => onChange("expCom", event.target.value)}><option value="">全部快递</option>{dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>快递单号</span><input value={query.expCode || ""} onChange={(event) => onChange("expCode", event.target.value)} placeholder="运单号" /></label>
        </div>
        <div className="filter-field-grid">
          <label className="filter-purchaser-field"><span>下单人</span><PurchaserFilterSearch value={query.purchaser} purchasers={purchasers} onChange={(value) => onChange("purchaser", value)} /></label>
          <label><span>创建人</span><input value={query.createBy || ""} onChange={(event) => onChange("createBy", event.target.value)} placeholder="创建人" /></label>
        </div>
        <div className="filter-field-grid">
          <label><span>下单时间</span><input type="date" value={query.orderTime || ""} onChange={(event) => onChange("orderTime", event.target.value)} /></label>
          <label><span>备注</span><input value={query.orderDesc || ""} onChange={(event) => onChange("orderDesc", event.target.value)} placeholder="备注关键词" /></label>
        </div>
      </div>
    </section>
  </>;
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
  const [editorSaving, setEditorSaving] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [syncModeOpen, setSyncModeOpen] = useState(false);
  const [mailStore, setMailStore] = useState<DataRow | null>(null);
  const [noticeStore, setNoticeStore] = useState<DataRow | null>(null);
  const [accessStore, setAccessStore] = useState<DataRow | null>(null);
  const [storeSwitchBusy, setStoreSwitchBusy] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [filterPurchasers, setFilterPurchasers] = useState<DataRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { setLoading(true); try { const result = await apiRequest<DataRow>(config.api, { query }); setRows(Array.isArray(result.rows) ? result.rows : []); setTotal(Number(result.total || 0)); } catch (error) { notify(error instanceof Error ? error.message : `${config.itemName}加载失败`, "error"); } finally { setLoading(false); } }, [config, notify, query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setExpanded(new Set()); setPageKeyword(""); }, [config.key]);
  useEffect(() => {
    if (config.key !== "bills") return;
    apiRequest<{ data?: DataRow[] }>(API_PATHS.customers.purchasers)
      .then((result) => setFilterPurchasers(Array.isArray(result.data) ? result.data : []))
      .catch(() => setFilterPurchasers([]));
  }, [config.key]);
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
  async function refreshLoadedRange(expectedDelta = 0) {
    const pageSize = Number(query.pageSize || 15) || 15;
    const hadAllRows = total > 0 && rows.length >= total;
    const targetSize = Math.max(pageSize, rows.length + expectedDelta);
    const accumulated: DataRow[] = [];
    let serverTotal = total;
    let pageNum = 1;
    try {
      while (pageNum <= 200) {
        const requestSize = hadAllRows ? pageSize : targetSize;
        const result = await apiRequest<DataRow>(config.api, { query: { ...query, pageNum, pageSize: requestSize } });
        const pageRows = Array.isArray(result.rows) ? result.rows : [];
        serverTotal = Number(result.total || 0);
        accumulated.push(...pageRows);
        if (!hadAllRows || !pageRows.length || accumulated.length >= serverTotal) break;
        pageNum += 1;
      }
      setRows(accumulated);
      setTotal(serverTotal);
    } catch (error) {
      notify(error instanceof Error ? error.message : `${config.itemName}刷新失败`, "error");
    }
  }
  async function extra(row: DataRow) { const action = resolveExtra(row); if (!action) return; const doCall = async () => { try { await apiRequest(action.path(row), { method: action.method }); notify(`${action.label}成功`, "success"); await refreshLoadedRange(); } catch (error) { notify(error instanceof Error ? error.message : "操作失败", "error"); } }; if (action.confirm) { setConfirm({ title: action.label, message: action.confirm, danger: action.danger, action: async () => { await doCall(); setConfirm(null); } }); } else { await doCall(); } }
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
        const result = await apiRequest<DataRow>(config.api, { query: { ...query, pageNum, pageSize } });
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
   * - force=true：走 /billing/bills/force-sync/{id}（无视订单状态）
   * - force=false：走 /billing/bills/{id}（后端仍兜底校验状态）
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
        const path = force ? `${API_PATHS.billing.bills}/force-sync/${row.id}` : `${API_PATHS.billing.bills}/${row.id}`;
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
      await refreshLoadedRange();
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
  function patchStoreRow(id: unknown, patch: DataRow) {
    setRows((current) => current.map((item) => String(item.id) === String(id) ? { ...item, ...patch } : item));
  }

  async function saveStoreSwitch(row: DataRow, key: string, patch: DataRow, request: () => Promise<unknown>, success: string) {
    const busyKey = `${row.id}:${key}`;
    if (storeSwitchBusy.has(busyKey)) return;
    const previous = Object.fromEntries(Object.keys(patch).map((field) => [field, row[field]]));
    patchStoreRow(row.id, patch);
    setStoreSwitchBusy((current) => new Set(current).add(busyKey));
    try {
      await request();
      notify(success, "success");
    } catch (error) {
      patchStoreRow(row.id, previous);
      notify(error instanceof Error ? error.message : "店铺设置保存失败", "error");
    } finally {
      setStoreSwitchBusy((current) => { const next = new Set(current); next.delete(busyKey); return next; });
    }
  }

  async function toggleStoreStatus(row: DataRow) {
    const nextValue = Number(row.isDelete) === 1 ? 2 : 1;
    await saveStoreSwitch(row, "isDelete", { isDelete: nextValue },
      () => apiRequest(config.api, { method: "PUT", body: { id: row.id, isDelete: nextValue } }),
      nextValue === 1 ? "店铺已恢复营业" : "店铺已暂停营业");
  }

  async function toggleStoreBlock(row: DataRow, field: "blockOrder" | "blockQuery") {
    const nextValue = Number(row[field]) === 1 ? 0 : 1;
    const label = field === "blockOrder" ? "下单" : "查单";
    await saveStoreSwitch(row, field, { [field]: nextValue },
      () => apiRequest(`${config.api}/${row.id}/block`, { method: "PUT", body: { [field]: nextValue } }),
      nextValue === 1 ? `已禁止${label}` : `已恢复${label}`);
  }

  async function toggleStoreCustomerAccess(row: DataRow) {
    const nextValue = Number(row.accountRequired) === 1 ? 0 : 1;
    await saveStoreSwitch(row, "accountRequired", { accountRequired: nextValue },
      () => apiRequest(`${config.api}/${row.id}/customer-access`, { method: "PUT", body: { accountRequired: nextValue } }),
      nextValue === 1 ? "已要求店铺客户注册" : "已改为按买家设置");
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
    <div className={`module-page crud-page crud-page-${config.key}`}>
      <div className="module-hero compact-hero"><div><span className="eyebrow">订单管理模块</span><h1>{config.title}</h1><p>共 {total} 条数据，支持手机端快速维护</p></div><button className="round-add" type="button" onClick={() => setEditor("new")}><Plus size={22} /><span>新增</span></button></div>
      <div className="toolbar-card search-toolbar"><label className="quick-search"><Search size={15} strokeWidth={2.2} /><input value={pageKeyword} onChange={(event) => setPageKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="检索本页关键信息" aria-label={`检索当前页面已加载的${config.itemName}内容`} enterKeyHint="search" />{pageKeyword ? <button className="search-clear" type="button" aria-label="清空本页检索" onClick={() => setPageKeyword("")}><X size={14} /></button> : null}</label><button className={`filter-chip${config.searchFields.some((field) => String(query[field.key] || "").trim()) ? " active" : ""}`} type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={14} strokeWidth={2.2} />筛选</button><button className="toolbar-icon" type="button" onClick={load} aria-label="刷新"><RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} /></button></div>
      <div className="secondary-actions">
        <button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/export`, query, `${config.key}_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><Download size={16} />导出</button>
        {config.importable ? <><button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />导入</button><button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/import-template`, {}, `${config.key}_template_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><FileSpreadsheet size={16} />模板</button><input ref={fileRef} hidden type="file" accept=".xls,.xlsx" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadFile(`${config.api}/import`, file, { updateSupport: false }); notify("导入成功", "success"); await refreshLoadedRange(1); } catch (error) { notify(error instanceof Error ? error.message : "导入失败", "error"); } event.target.value = ""; }} /></> : null}
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
          if (config.key === "stores") {
            return <StoreManagementCard
              key={String(row.id)}
              row={row}
              dictionaries={dictionaries}
              expanded={isOpen}
              busy={storeSwitchBusy}
              onToggleExpand={() => toggleExpand(row.id as string | number)}
              onToggleStatus={() => { void toggleStoreStatus(row); }}
              onToggleRegistration={() => { void toggleStoreCustomerAccess(row); }}
              onToggleBlock={(field) => { void toggleStoreBlock(row, field); }}
              onEdit={() => edit(row)}
              onNotice={() => setNoticeStore(row)}
              onMail={() => setMailStore(row)}
              onAccess={() => setAccessStore(row)}
              onCopy={copyText}
              onDelete={() => setConfirm({ title: "删除店铺", message: `删除「${String(row.name || row.code || "该店铺")}」后无法恢复，是否继续？`, danger: true, action: async () => { await apiRequest(`${config.api}/${row.id}`, { method: "DELETE" }); notify("删除成功", "success"); await refreshLoadedRange(-1); } })}
            />;
          }
          return <article className={`data-card data-card-${config.key}`} key={String(row.id)}>
            <div className="data-card-head"><span className="data-icon"><Icon size={20} /></span><div><b>{row[config.titleKey] || `未命名${config.itemName}`}</b><small>{config.subtitle?.(row) || shortDate(row.createTime, true)}</small></div>{config.key === "express" ? <StatusBadge row={row} /> : config.key === "bills" && row.orderStatus ? (() => { const status = String(row.orderStatus); const tone = status === "DSH" || status === "DFH" ? "status-success" : status === "YQX" || status === "YC" ? "status-neutral" : "status-warning"; const label = billOrderStatusLabel(row, dictionaries); return <span className={`status ${tone}`}><span />{label}</span>; })() : row.isDefault !== undefined ? <span className={`status ${Number(row.isDefault) === 1 ? "status-success" : "status-neutral"}`}><span />{Number(row.isDefault) === 1 ? "默认" : "普通"}</span> : null}</div>
            {summary?.length ? <div className={`data-card-summary data-card-summary-${summary.length}`}>{summary.map((item) => { const tone = summaryTone(row, item); return <div className={`summary-cell tone-${tone}`} key={item.key}><span>{item.label}</span><b>{summaryValue(row, item)}</b></div>; })}</div> : null}
            <div className="data-metrics">{config.display.map((item) => <div key={item.key} className={item.fullWidth ? "full-width" : ""}><span>{item.label}</span><b className={item.money ? "money" : ""}>{displayValue(row, item)}</b></div>)}</div>
            {hasExpand ? <div className={`expand-wrapper ${isOpen ? "open" : ""}`}><div className="expand-inner"><div className="data-metrics data-metrics-expand">{expand!.map((item) => <div key={item.key}><span>{item.label}</span><b className={item.money ? "money" : ""}>{displayValue(row, item)}</b></div>)}</div></div></div> : null}
            {hasExpand ? <button type="button" className={`data-more-toggle ${isOpen ? "open" : ""}`} onClick={() => toggleExpand(row.id as string | number)} aria-expanded={isOpen}><span>{isOpen ? "收起明细" : "查看更多"}</span><ChevronDown size={15} /></button> : null}
            {note ? <p className="data-note">{note}</p> : null}
            <div className="card-actions"><button type="button" onClick={() => edit(row)}><Pencil size={16} />修改</button>{(() => { const action = resolveExtra(row); if (!action) return null; return <button type="button" className={action.danger ? "primary-action danger-action" : "primary-action"} onClick={() => extra(row)}><RefreshCw size={16} />{action.label}</button>; })()}<button type="button" className="danger-text" onClick={() => setConfirm({ title: `删除${config.itemName}`, message: "删除后无法恢复，是否继续？", danger: true, action: async () => { await apiRequest(`${config.api}/${row.id}`, { method: "DELETE" }); notify("删除成功", "success"); await refreshLoadedRange(-1); } })}><Trash2 size={16} />删除</button></div>
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
          }}
        >
          <div className="filter-sheet-body">
            {config.key === "bills" ? <BillOrderFilter dictionaries={dictionaries} query={query} purchasers={filterPurchasers} onChange={(key, value) => setQuery((current: DataRow) => ({ ...current, [key]: value }))} /> : <section className="filter-section">
              <header><h3>筛选条件</h3></header>
              <div className="filter-field-stack">
                {config.searchFields.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <FieldInput field={field} value={query[field.key]} onChange={(value) => setQuery((current: DataRow) => ({ ...current, [field.key]: value }))} />
                  </label>
                ))}
              </div>
            </section>}
          </div>
          <div className="filter-sheet-footer">
            <button type="button" className="filter-reset" onClick={() => setQuery({ pageNum: 1, pageSize: 15 })}>重置</button>
            <button className="filter-apply" type="submit">查看结果</button>
          </div>
        </form>
      </Sheet>
      <Sheet
        open={editor !== null}
        title={`${editor === "new" ? "新增" : "修改"}${config.itemName}`}
        onClose={() => { setEditor(null); setEditorSaving(false); }}
        wide
        headerAction={
          editor !== null ? (
            <button className="sheet-header-save" type="submit" form={`crud-editor-${config.key}`} disabled={editorSaving}>
              {editorSaving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
              {editorSaving ? "保存中" : "保存"}
            </button>
          ) : null
        }
      >
        {editor !== null ? (
          <CrudEditor
            config={config}
            initial={editor === "new" ? null : editor}
            formId={`crud-editor-${config.key}`}
            onSavingChange={setEditorSaving}
            onClose={() => { setEditor(null); setEditorSaving(false); }}
            onSaved={() => { void refreshLoadedRange(editor === "new" ? 1 : 0); }}
            notify={notify}
          />
        ) : null}
      </Sheet>
      <Sheet open={mailStore !== null} title={`邮件发送 · ${String(mailStore?.name || "店铺")}`} onClose={() => setMailStore(null)} wide>
        {mailStore ? <StoreMailSettingsEditor store={mailStore} notify={notify} onClose={() => setMailStore(null)} onSaved={() => { void refreshLoadedRange(); }} /> : null}
      </Sheet>
      <Sheet open={noticeStore !== null} title={`店铺通知 · ${String(noticeStore?.name || "店铺")}`} onClose={() => setNoticeStore(null)} wide>
        {noticeStore ? <StoreNoticeEditor store={noticeStore} dictionaries={dictionaries} notify={notify} onClose={() => setNoticeStore(null)} onSaved={(updated) => patchStoreRow(noticeStore.id, updated)} /> : null}
      </Sheet>
      <Sheet open={accessStore !== null} title={`访问设置 · ${String(accessStore?.name || "店铺")}`} onClose={() => setAccessStore(null)}>
        {accessStore ? <StoreAccessEditor store={accessStore} notify={notify} onClose={() => setAccessStore(null)} onSaved={(updated) => patchStoreRow(accessStore.id, updated)} /> : null}
      </Sheet>
      {config.batchAction ? (
        <Sheet
          open={batchOpen}
          title={config.batchAction.title}
          onClose={() => { setBatchOpen(false); setBatchSaving(false); }}
          wide
          headerAction={
            batchOpen ? (
              <button className="sheet-header-save" type="submit" form={`crud-batch-${config.key}`} disabled={batchSaving}>
                {batchSaving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
                {batchSaving ? "更新中" : "批量更新"}
              </button>
            ) : null
          }
        >
          <BatchEditor
            config={config}
            rows={visibleRows}
            formId={`crud-batch-${config.key}`}
            onSavingChange={setBatchSaving}
            onSaved={() => { setBatchOpen(false); setBatchSaving(false); void refreshLoadedRange(); }}
            notify={notify}
          />
        </Sheet>
      ) : null}
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
          const result = await apiRequest<DataRow>(api, { query: { ...baseQuery, pageNum, pageSize } });
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

export function BatchEditor({
  config,
  rows,
  onSaved,
  notify,
  formId = "crud-batch-form",
  onSavingChange,
}: {
  config: CrudConfig;
  rows: DataRow[];
  onSaved: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  formId?: string;
  onSavingChange?: (saving: boolean) => void;
}) {
  const action = config.batchAction!;
  const [values, setValues] = useState<DataRow>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { onSavingChange?.(saving); }, [onSavingChange, saving]);
  useEffect(() => () => onSavingChange?.(false), [onSavingChange]);
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
  return (
    <form id={formId} className="mobile-form sheet-editor-form" onSubmit={submit}>
      <p className="batch-hint">将作用于当前已加载的 <b>{ids.length}</b> 条数据。仅修改下方已填写的字段；总成本（商品+快递+包装）会在改完后自动重算。</p>
      <div className="form-grid">{action.fields.map((field) => <label key={field.key}><span>{field.label}</span><FieldInput field={field} value={values[field.key]} onChange={(value) => update(field.key, value)} /></label>)}</div>
    </form>
  );
}

export function CrudEditor({
  config,
  initial,
  onClose,
  onSaved,
  notify,
  formId = "crud-editor-form",
  onSavingChange,
}: {
  config: CrudConfig;
  initial: DataRow | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  formId?: string;
  onSavingChange?: (saving: boolean) => void;
}) {
  const [form, setForm] = useState<DataRow>(() => ({ ...(config.key === "stores" ? { isDelete: 1 } : {}), ...(initial || {}) }));
  const [saving, setSaving] = useState(false);
  useEffect(() => { onSavingChange?.(saving); }, [onSavingChange, saving]);
  useEffect(() => () => onSavingChange?.(false), [onSavingChange]);
  function update(key: string, value: unknown) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (config.key === "bills") {
        const total = Number(next.goodsPrice || 0) + Number(next.packagePrice || 0) + Number(next.expPrice || 0) + Number(next.addPrice || 0);
        next.totalPrice = total;
      }
      if (config.key === "prices") next.totalPrice = Number(next.goodsPrice || 0) + Number(next.expPrice || 0) + Number(next.packagePrice || 0);
      return next;
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (config.key === "express" && typeof payload.expTime === "string") payload.expTime = payload.expTime.replace("T", " ");
      if (config.key === "stores") payload.isDelete = Number(payload.isDelete || 1);
      await apiRequest(config.api, { method: form.id ? "PUT" : "POST", body: payload });
      notify(form.id ? "修改成功" : "新增成功", "success");
      onSaved();
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form id={formId} className={`mobile-form sheet-editor-form crud-editor-form crud-editor-form-${config.key}`} onSubmit={submit}>
      <div className="form-grid">
        {config.fields.map((field) => (
          <label className={field.type === "textarea" ? "span-full" : ""} key={field.key}>
            <span>{field.label}{field.required ? " *" : ""}</span>
            <FieldInput field={field} value={form[field.key]} onChange={(value) => update(field.key, value)} />
          </label>
        ))}
      </div>
    </form>
  );
}

function StoreManagementCard({
  row,
  dictionaries,
  expanded,
  busy,
  onToggleExpand,
  onToggleStatus,
  onToggleRegistration,
  onToggleBlock,
  onEdit,
  onNotice,
  onMail,
  onAccess,
  onCopy,
  onDelete,
}: {
  row: DataRow;
  dictionaries: Dictionaries;
  expanded: boolean;
  busy: Set<string>;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
  onToggleRegistration: () => void;
  onToggleBlock: (field: "blockOrder" | "blockQuery") => void;
  onEdit: () => void;
  onNotice: () => void;
  onMail: () => void;
  onAccess: () => void;
  onCopy: (text: string, message: string) => void;
  onDelete: () => void;
}) {
  const id = String(row.id);
  const isOpen = Number(row.isDelete) === 1;
  const registration = Number(row.accountRequired) === 1;
  const orderAllowed = Number(row.blockOrder) !== 1;
  const queryAllowed = Number(row.blockQuery) !== 1;
  const mailEnabled = Number(row.mailEnabled) === 1;
  const switchItem = (key: string, label: string, description: string, checked: boolean, onClick: () => void, tone = "normal") => (
    <button type="button" className={`store-control-switch tone-${tone}`} role="switch" aria-checked={checked} disabled={busy.has(`${id}:${key}`)} onClick={onClick}>
      <span className="store-control-copy"><b>{label}</b><small>{description}</small></span>
      <span className={`store-switch${checked ? " on" : ""}`}>{busy.has(`${id}:${key}`) ? <LoaderCircle className="spin" size={12} /> : <i />}</span>
    </button>
  );
  return (
    <article className={`data-card store-card-modern${expanded ? " expanded" : ""}`}>
      <header className="store-card-header">
        <span className="store-card-icon"><StoreIcon size={19} /></span>
        <div className="store-card-identity"><b>{String(row.name || "未命名店铺")}</b><small>{String(row.code || "暂无编码")}</small></div>
        <div className="store-card-badges"><span className={`store-state-pill ${isOpen ? "open" : "paused"}`}><i />{isOpen ? "营业中" : "已暂停"}</span>{Number(row.mailDefault) === 1 ? <span className="store-default-pill">默认发件</span> : null}</div>
      </header>

      {row.notice ? <button type="button" className="store-notice-preview" onClick={onNotice}><Bell size={14} /><span><b>{row.noticeType ? optionLabel(row.noticeType, dictionaries.platforms) : "店铺通知"}</b><small>{String(row.notice)}</small></span><ChevronRight size={15} /></button> : <button type="button" className="store-notice-preview empty" onClick={onNotice}><Bell size={14} /><span><b>店铺通知</b><small>尚未设置，点击添加通知内容</small></span><Plus size={14} /></button>}

      <section className="store-control-grid" aria-label="店铺快速开关">
        {switchItem("isDelete", "店铺营业", isOpen ? "客户可以正常访问店铺" : "店铺当前暂停对外服务", isOpen, onToggleStatus)}
        {switchItem("accountRequired", "客户注册", registration ? "专属链接需要先注册" : "按买家自己的设置执行", registration, onToggleRegistration)}
        {switchItem("blockOrder", "允许下单", orderAllowed ? "客户可以提交新订单" : "所有买家均被禁止下单", orderAllowed, () => onToggleBlock("blockOrder"), orderAllowed ? "normal" : "danger")}
        {switchItem("blockQuery", "允许查单", queryAllowed ? "客户可以查询订单" : "所有买家均被禁止查单", queryAllowed, () => onToggleBlock("blockQuery"), queryAllowed ? "normal" : "danger")}
      </section>

      <nav className="store-card-quick-actions" aria-label="店铺配置入口">
        <button type="button" onClick={onEdit}><Pencil size={15} /><span>基本资料</span></button>
        <button type="button" onClick={onNotice}><Bell size={15} /><span>通知设置</span></button>
        <button type="button" className={mailEnabled ? "configured" : ""} onClick={onMail}><Mail size={15} /><span>邮件配置</span>{mailEnabled ? <i /> : null}</button>
        <button type="button" onClick={onAccess}><LockKeyhole size={15} /><span>访问设置</span></button>
      </nav>

      <div className={`store-detail-collapse${expanded ? " open" : ""}`}>
        <div className="store-detail-inner">
          <dl className="store-detail-grid">
            <div><dt>默认买家</dt><dd>{String(row.defPurchaser || "未设置")}</dd></div>
            <div><dt>下单码</dt><dd>{Number(row.orderCodeRequirePwd) === 1 ? (row.orderCodePwd ? "已启用" : "待设置") : "免验证"}</dd></div>
            <div><dt>拦截样式</dt><dd>{row.blockDisplayType ? optionLabel(row.blockDisplayType, STORE_BLOCK_DISPLAY_OPTIONS) : "顶部提示"}</dd></div>
            <div><dt>邮件发送</dt><dd>{mailEnabled ? (Number(row.mailDefault) === 1 ? "已启用 · 系统默认" : "已启用") : "未配置"}</dd></div>
            <div><dt>创建人</dt><dd>{String(row.createBy || "--")}</dd></div>
            <div><dt>最近更新</dt><dd>{shortDate(row.updateTime || row.createTime, true)}</dd></div>
          </dl>
          {row.noticeUrl ? <div className="store-detail-link"><ExternalLink size={13} /><span>{String(row.noticeUrl)}</span><button type="button" onClick={() => onCopy(String(row.noticeUrl), "通知地址已复制")}><Copy size={12} />复制</button></div> : null}
          {Number(row.orderCodeRequirePwd) === 1 && row.orderCodePwd ? <div className="store-detail-link"><LockKeyhole size={13} /><span>店铺下单码：{String(row.orderCodePwd)}</span><button type="button" onClick={() => onCopy(String(row.orderCodePwd), "下单码已复制")}><Copy size={12} />复制</button></div> : null}
          <button type="button" className="store-delete-action" onClick={onDelete}><Trash2 size={14} />删除店铺</button>
        </div>
      </div>
      <button type="button" className={`store-detail-toggle${expanded ? " open" : ""}`} onClick={onToggleExpand} aria-expanded={expanded}><span>{expanded ? "收起店铺信息" : "更多店铺信息"}</span><ChevronDown size={15} /></button>
    </article>
  );
}

function StoreNoticeEditor({ store, dictionaries, notify, onClose, onSaved }: { store: DataRow; dictionaries: Dictionaries; notify: (message: string, type?: "success" | "error" | "info") => void; onClose: () => void; onSaved: (updated: DataRow) => void }) {
  const [form, setForm] = useState({ notice: String(store.notice || ""), noticeType: String(store.noticeType || ""), noticeUrl: String(store.noticeUrl || "") });
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiRequest<DataRow>(`${API_PATHS.stores.root}/${store.id}/notice-settings`, { method: "PUT", body: form });
      const updated = result.data && typeof result.data === "object" ? result.data as DataRow : { ...store, ...form };
      notify(form.notice.trim() ? "店铺通知已更新" : "店铺通知已清空", "success");
      onSaved(updated);
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "店铺通知保存失败", "error");
    } finally { setSaving(false); }
  }
  return <form className="store-setting-editor" onSubmit={submit}>
    <section className="store-setting-intro"><span><Bell size={18} /></span><div><b>独立维护店铺通知</b><p>通知内容会在专属下单页展示。删除全部文字并保存即可清空通知。</p></div></section>
    <label className="span-full"><span>通知内容</span><textarea rows={5} value={form.notice} onChange={(event) => setForm((current) => ({ ...current, notice: event.target.value }))} placeholder="例如：欢迎购买本店商品，预计两日内发货" /></label>
    <div className="store-setting-grid"><label><span>通知类型</span><select value={form.noticeType} onChange={(event) => setForm((current) => ({ ...current, noticeType: event.target.value }))}><option value="">普通通知</option>{dictionaries.platforms.map((item) => <option key={String(item.value)} value={String(item.value)}>{item.label}</option>)}</select></label><label><span>跳转地址</span><input value={form.noticeUrl} onChange={(event) => setForm((current) => ({ ...current, noticeUrl: event.target.value }))} placeholder="https://...（可选）" /></label></div>
    <section className={`store-notice-live-preview${form.notice.trim() ? "" : " empty"}`}><Bell size={14} /><div><b>{form.noticeType ? optionLabel(form.noticeType, dictionaries.platforms) : "店铺通知"}</b><p>{form.notice.trim() || "通知清空后，专属下单页不会展示此模块"}</p></div></section>
    <div className="mail-settings-actions"><button type="button" onClick={onClose}>取消</button><button className="primary-action" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? "保存中" : "保存通知"}</button></div>
  </form>;
}

function StoreAccessEditor({ store, notify, onClose, onSaved }: { store: DataRow; notify: (message: string, type?: "success" | "error" | "info") => void; onClose: () => void; onSaved: (updated: DataRow) => void }) {
  const [form, setForm] = useState({ orderCodeRequirePwd: Number(store.orderCodeRequirePwd || 0), orderCodePwd: String(store.orderCodePwd || ""), blockDisplayType: String(store.blockDisplayType || "banner") });
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.orderCodeRequirePwd === 1 && !/^\d{4,6}$/.test(form.orderCodePwd)) return notify("下单码必须是 4-6 位数字", "info");
    setSaving(true);
    try {
      const patch = { ...form, orderCodePwd: form.orderCodeRequirePwd === 1 ? form.orderCodePwd : "", id: store.id };
      await apiRequest(API_PATHS.stores.root, { method: "PUT", body: patch });
      notify("店铺访问设置已保存", "success");
      onSaved({ ...store, ...patch });
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "访问设置保存失败", "error");
    } finally { setSaving(false); }
  }
  return <form className="store-setting-editor" onSubmit={submit}>
    <section className="store-setting-intro"><span><LockKeyhole size={18} /></span><div><b>下单访问与拦截展示</b><p>下单码用于店铺级统一验证；拦截展示形式只在禁止下单或查单时生效。</p></div></section>
    <label><span>店铺下单码</span><select value={String(form.orderCodeRequirePwd)} onChange={(event) => setForm((current) => ({ ...current, orderCodeRequirePwd: Number(event.target.value) }))}><option value="0">免下单码</option><option value="1">需要下单码</option></select></label>
    {form.orderCodeRequirePwd === 1 ? <label><span>4-6 位数字下单码</span><input inputMode="numeric" maxLength={6} value={form.orderCodePwd} onChange={(event) => setForm((current) => ({ ...current, orderCodePwd: event.target.value.replace(/\D/g, "") }))} placeholder="请输入下单码" /></label> : null}
    <label><span>拦截提示样式</span><select value={form.blockDisplayType} onChange={(event) => setForm((current) => ({ ...current, blockDisplayType: event.target.value }))}>{STORE_BLOCK_DISPLAY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <div className="mail-settings-actions"><button type="button" onClick={onClose}>取消</button><button className="primary-action" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? "保存中" : "保存访问设置"}</button></div>
  </form>;
}

function StoreMailSettingsEditor({
  store,
  notify,
  onClose,
  onSaved,
}: {
  store: DataRow;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<DataRow>({
    enabled: 0,
    defaultSender: 0,
    host: "smtp.163.com",
    port: 465,
    username: "",
    password: "",
    security: "SSL",
    fromAddress: "",
    fromName: String(store.name || ""),
    passwordConfigured: false,
    applyToAllStores: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<DataRow>(`${API_PATHS.stores.root}/${store.id}/mail-settings`)
      .then((result) => {
        if (!active) return;
        const data = result.data && typeof result.data === "object" ? result.data as DataRow : {};
        setForm((current) => ({ ...current, ...data, password: "", applyToAllStores: true }));
      })
      .catch((error) => { if (active) notify(error instanceof Error ? error.message : "邮件配置加载失败", "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notify, store.id]);

  function update(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest(`${API_PATHS.stores.root}/${store.id}/mail-settings`, {
        method: "PUT",
        body: {
          ...form,
          enabled: Number(form.enabled || 0),
          defaultSender: Number(form.defaultSender || 0),
          port: Number(form.port || 0),
        },
      });
      notify(form.applyToAllStores ? "邮件配置已同步到全部店铺" : "店铺邮件配置已保存", "success");
      onSaved();
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "邮件配置保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mail-settings-loading"><LoaderCircle className="spin" size={21} />正在读取邮件配置</div>;
  const enabled = Number(form.enabled) === 1;
  return (
    <form className="mail-settings-editor" onSubmit={submit}>
      <section className="mail-settings-intro">
        <span><Mail size={18} /></span>
        <div><b>SMTP 发件服务</b><p>客户注册、邮箱登录和找回密码均使用当前店铺配置。授权码加密保存且不会回显。</p></div>
      </section>
      <label className="mail-settings-switch"><div><b>启用邮件发送</b><small>未启用时邮箱登录会提示使用账号密码登录</small></div><input type="checkbox" checked={enabled} onChange={(event) => update("enabled", event.target.checked ? 1 : 0)} /><span /></label>
      <div className={`mail-settings-fields${enabled ? "" : " disabled"}`}>
        <label><span>SMTP 主机</span><input disabled={!enabled} value={String(form.host || "")} onChange={(event) => update("host", event.target.value)} placeholder="smtp.163.com" /></label>
        <label><span>端口</span><input disabled={!enabled} type="number" value={String(form.port || "")} onChange={(event) => update("port", event.target.value)} placeholder="465" /></label>
        <label><span>安全连接</span><select disabled={!enabled} value={String(form.security || "SSL")} onChange={(event) => update("security", event.target.value)}><option value="SSL">SSL（常用 465）</option><option value="STARTTLS">STARTTLS（常用 587）</option></select></label>
        <label><span>SMTP 用户名</span><input disabled={!enabled} value={String(form.username || "")} onChange={(event) => update("username", event.target.value)} placeholder="完整邮箱地址" autoComplete="off" /></label>
        <label className="span-full"><span>授权码 / SMTP 密码</span><input disabled={!enabled} type="password" value={String(form.password || "")} onChange={(event) => update("password", event.target.value)} placeholder={form.passwordConfigured ? "已安全保存，留空表示不修改" : "请输入邮箱服务商提供的 SMTP 授权码"} autoComplete="new-password" /></label>
        <label><span>发件邮箱</span><input disabled={!enabled} value={String(form.fromAddress || "")} onChange={(event) => update("fromAddress", event.target.value)} placeholder="留空时使用 SMTP 用户名" /></label>
        <label><span>发件人名称</span><input disabled={!enabled} value={String(form.fromName || "")} onChange={(event) => update("fromName", event.target.value)} placeholder="如：炎陵黄桃" /></label>
      </div>
      <section className="mail-settings-options">
        <label><input type="checkbox" disabled={!enabled} checked={enabled && Number(form.defaultSender) === 1} onChange={(event) => update("defaultSender", event.target.checked ? 1 : 0)} /><span><b>设为系统默认发件配置</b><small>用于管理端邮箱登录等没有店铺上下文的场景</small></span></label>
        <label><input type="checkbox" checked={Boolean(form.applyToAllStores)} onChange={(event) => update("applyToAllStores", event.target.checked)} /><span><b>同步到全部店铺</b><small>一次覆盖所有正常店铺，之后仍可单独修改某个店铺</small></span></label>
      </section>
      <div className="mail-settings-actions"><button type="button" onClick={onClose}>取消</button><button className="primary-action" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? "保存中" : "保存邮件配置"}</button></div>
    </form>
  );
}
