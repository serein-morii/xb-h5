import {
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCw,
  ScanText,
  Search,
  SearchCheck,
  Send,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  Truck,
  User,
  UserPlus,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  apiRequest,
  copyToClipboard,
  downloadFile,
  readFromClipboard,
} from "../lib/api";
import { mergeOrderDetailPaymentStatus } from "../lib/orderPayment";
import type { DataRow, MenuKey } from "./core";
import {
  DictionaryContext,
  optionLabel,
  shortDate,
} from "./core";
import {
  clearOrderStatusView,
  ORDER_STATUS_CODES,
  type OrderStatusView,
  readOrderStatusView,
} from "./dashboard";
import { StatusBadge } from "./logistics";
import PurchaserFilterSearch from "./PurchaserFilterSearch";
import { ConfirmDialog, EmptyState, Sheet } from "./ui";

function formatSalePrice(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  const amount = Number(value);
  return Number.isFinite(amount) ? `¥${amount.toFixed(2)}` : "--";
}

function formatYuan(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "--";
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}元`;
}

function splitOrderAreaAndSize(value: string): { area: string; size: string } {
  const normalized = value.replace(/\s+/g, " ").replace(/[·・]/g, "·").trim();
  const pieces = normalized.split("·").map((item) => item.trim()).filter(Boolean);
  if (pieces.length >= 2) return { area: pieces[0], size: pieces.slice(1).join(" ") };
  const matchedArea = normalized.match(/湖南省[内外]/)?.[0] || "";
  if (matchedArea) return { area: matchedArea, size: normalized.replace(matchedArea, "").trim() || "--" };
  return { area: "", size: normalized || "--" };
}

type ProductSkuOption = {
  id?: number;
  skuCode?: string;
  displayName?: string;
  billOrderType?: string;
  salePrice?: number | string;
  status?: number;
  sortNum?: number;
};
type ProductCatalogRow = {
  id?: number;
  productCode?: string;
  name?: string;
  status?: number;
  skus?: ProductSkuOption[];
};
type OrderSkuOption = {
  value: string;
  label: string;
  skuId?: number;
  productId?: number;
  productCode?: string;
  productName?: string;
  billOrderType?: string;
  salePrice?: number;
};

function normalizeSpecText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[路·・]/g, "")
    .toLowerCase();
}

function inferOrderRegion(row: DataRow) {
  const source = [row.orderType, row.orderTypeDesc, row.address].filter(Boolean).join(" ");
  if (/新疆/i.test(source)) return "新疆";
  if (/湖南省内|省内|湖南/i.test(source)) return "湖南省内";
  if (/湖南省外|省外|外省|out/i.test(source)) return "湖南省外";
  return "";
}

function inferOrderWeight(row: DataRow) {
  const source = [row.orderType, row.orderTypeDesc].filter(Boolean).join(" ");
  if (/(^|[^0-9])10([^0-9]|$)|十斤/i.test(source)) return "10斤";
  if (/(^|[^0-9])5([^0-9]|$)|五斤/i.test(source)) return "5斤";
  return "";
}

function skuOptionsForProduct(catalog: ProductCatalogRow[], productCode: string, fallbackSizes: Array<{ value: string; label: string }>): OrderSkuOption[] {
  const product = catalog.find((item) => String(item.productCode || "") === String(productCode));
  if (!product) return fallbackSizes.map((item) => ({ value: item.value, label: item.label }));
  return (product.skus || [])
    .filter((sku) => Number(sku.status ?? 1) !== 0)
    .map((sku) => ({
      value: String(sku.skuCode || ""),
      label: String(sku.displayName || sku.skuCode || ""),
      skuId: sku.id,
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      billOrderType: sku.billOrderType,
      salePrice: sku.salePrice === null || sku.salePrice === undefined || sku.salePrice === "" ? undefined : Number(sku.salePrice),
    }))
    .filter((item) => item.value);
}

function findProductForOrder(catalog: ProductCatalogRow[], row: DataRow) {
  return catalog.find((item) => Number(item.id) === Number(row.productId))
    || catalog.find((item) => String(item.productCode || "") === String(row.orderName || ""))
    || catalog.find((item) => normalizeSpecText(item.name) === normalizeSpecText(row.orderNameDesc));
}

function findSkuForOrder(row: DataRow, options: OrderSkuOption[]) {
  const skuId = Number(row.skuId);
  if (Number.isFinite(skuId) && skuId > 0) {
    const exact = options.find((item) => Number(item.skuId) === skuId);
    if (exact) return exact;
  }
  const exactCode = options.find((item) => String(item.value) === String(row.orderType || ""));
  if (exactCode) return exactCode;
  const normalizedDesc = normalizeSpecText(row.orderTypeDesc);
  const exactLabel = options.find((item) => normalizeSpecText(item.label) === normalizedDesc);
  if (exactLabel) return exactLabel;
  const region = inferOrderRegion(row);
  const weight = inferOrderWeight(row);
  if (region && weight) {
    return options.find((item) => normalizeSpecText(item.label).includes(normalizeSpecText(region))
      && normalizeSpecText(item.label).includes(normalizeSpecText(weight)));
  }
  if (weight) {
    return options.find((item) => normalizeSpecText(item.billOrderType).includes(normalizeSpecText(weight))
      || normalizeSpecText(item.label).includes(normalizeSpecText(weight)));
  }
  return undefined;
}

function payStatusMeta(status: unknown) {
  const value = Number(status);
  if (value === 1) return { key: "paid", label: "已付款" };
  if (value === 2) return { key: "refunded", label: "已退款" };
  if (value === 3) return { key: "confirming", label: "待确认" };
  return { key: "unpaid", label: "未付款" };
}

export function OrderEditor({
  initial,
  onSaved,
  onClose,
  notify,
  formId = "order-editor-form",
  onSavingChange,
}: {
  initial: DataRow | null;
  onSaved: () => void;
  onClose: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  formId?: string;
  onSavingChange?: (saving: boolean) => void;
}) {
  const dictionaries = useContext(DictionaryContext);
  const [form, setForm] = useState<DataRow>(() => initial ? { ...initial } : { orderNum: 1, orderTime: new Date().toISOString().slice(0, 10), orderStatus: "DSH", isUpdateBill: false, isUpdateExp: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { onSavingChange?.(saving); }, [onSavingChange, saving]);
  useEffect(() => () => onSavingChange?.(false), [onSavingChange]);
  const [purchasers, setPurchasers] = useState<DataRow[]>([]);
  const [stores, setStores] = useState<DataRow[]>([]);
  const [purchaserLoading, setPurchaserLoading] = useState(true);
  const [productCatalog, setProductCatalog] = useState<ProductCatalogRow[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [createPurchaserOpen, setCreatePurchaserOpen] = useState(false);
  const [creatingPurchaser, setCreatingPurchaser] = useState(false);
  const [purchaserForm, setPurchaserForm] = useState({ name: "", phone: "", storeCode: "" });
  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<{ data?: DataRow[] }>("/biz/purchaser/list"),
      apiRequest<{ data?: DataRow[] }>("/biz/store/options", { query: { createBy: "", name: "" } }),
      apiRequest<{ data?: ProductCatalogRow[] }>("/biz/product/list"),
    ]).then(([purchaserResult, storeResult, productResult]) => {
      if (!mounted) return;
      const purchaserRows = Array.isArray(purchaserResult.data) ? purchaserResult.data : [];
      const storeRows = Array.isArray(storeResult.data) ? storeResult.data.filter((item) => Number(item.isDelete ?? 1) === 1) : [];
      const productRows = Array.isArray(productResult.data) ? productResult.data : [];
      setPurchasers(purchaserRows); setStores(storeRows);
      setProductCatalog(productRows);
      setPurchaserForm((current) => ({ ...current, storeCode: current.storeCode || String(storeRows[0]?.code || "") }));
    }).catch((error) => notify(error instanceof Error ? error.message : "买家/商品列表加载失败", "error"))
      .finally(() => {
        if (mounted) {
          setPurchaserLoading(false);
          setProductLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [notify]);
  const productOptions = useMemo(
    () => productCatalog.length
      ? productCatalog.filter((item) => Number(item.status ?? 1) !== 0).map((item) => ({ value: String(item.productCode || ""), label: String(item.name || item.productCode || "") })).filter((item) => item.value)
      : dictionaries.products,
    [dictionaries.products, productCatalog],
  );
  const currentSkuOptions = useMemo(
    () => skuOptionsForProduct(productCatalog, String(form.orderName || ""), dictionaries.sizes),
    [dictionaries.sizes, form.orderName, productCatalog],
  );
  useEffect(() => {
    if (!productCatalog.length) return;
    setForm((current) => {
      const product = findProductForOrder(productCatalog, current);
      if (!product?.productCode) return current;
      const sku = findSkuForOrder(current, skuOptionsForProduct(productCatalog, product.productCode, dictionaries.sizes));
      const next = {
        ...current,
        productId: product.id ?? current.productId,
        orderName: product.productCode,
        orderNameDesc: product.name || current.orderNameDesc,
        ...(sku ? {
          skuId: sku.skuId,
          orderType: sku.value,
          orderTypeDesc: sku.label,
          salePrice: current.salePrice === "" || current.salePrice === null || current.salePrice === undefined ? sku.salePrice : current.salePrice,
        } : {}),
      };
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [dictionaries.sizes, productCatalog]);
  const set = (key: string, value: unknown) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "orderName" && value !== "other") {
      const product = productCatalog.find((item) => String(item.productCode || "") === String(value));
      next.productId = product?.id;
      next.skuId = undefined;
      next.orderType = "";
      next.orderTypeDesc = "";
      next.orderNameDesc = product?.name || optionLabel(value, dictionaries.products);
    }
    if (key === "orderType" && value !== "other") {
      const sku = skuOptionsForProduct(productCatalog, String(next.orderName || ""), dictionaries.sizes).find((item) => item.value === value);
      next.skuId = sku?.skuId;
      next.productId = sku?.productId ?? next.productId;
      next.orderTypeDesc = sku?.label || optionLabel(value, dictionaries.sizes);
      if (sku?.salePrice !== undefined) next.salePrice = sku.salePrice;
    }
    if (key === "expCom") next.expComDesc = optionLabel(value, dictionaries.expressCompanies);
    if (key === "orderStatus") next.orderStatusDesc = optionLabel(value, dictionaries.orderStatuses);
    return next;
  });
  function selectPurchaser(shortId: string) {
    const purchaser = purchasers.find((item) => String(item.shortId) === shortId);
    if (!purchaser) {
      setForm((current) => ({ ...current, purchaserShortId: "" }));
      return;
    }
    if (!purchaser.storeId || !purchaser.storeName) {
      notify("该买家尚未绑定店铺，请先在买家管理中绑定", "info");
      return;
    }
    setForm((current) => ({ ...current, purchaser: purchaser.name || "", purchaserShortId: purchaser.shortId || "", store: purchaser.storeName || "" }));
  }
  async function createAndSelectPurchaser() {
    if (!purchaserForm.name.trim() || !/^1\d{10}$/.test(purchaserForm.phone) || !purchaserForm.storeCode) return notify("请填写买家姓名、11位手机号和绑定店铺", "info");
    setCreatingPurchaser(true);
    try {
      const result = await apiRequest<{ data?: DataRow }>("/biz/purchaser", { method: "POST", body: { name: purchaserForm.name.trim(), phone: purchaserForm.phone, storeCode: purchaserForm.storeCode } });
      if (!result.data) throw new Error("创建买家后未返回档案信息");
      const purchaser = result.data;
      setPurchasers((current) => [purchaser, ...current.filter((item) => item.id !== purchaser.id)]);
      setForm((current) => ({ ...current, purchaser: purchaser.name || "", purchaserShortId: purchaser.shortId || "", store: purchaser.storeName || "" }));
      setPurchaserForm({ name: "", phone: "", storeCode: String(stores[0]?.code || "") }); setCreatePurchaserOpen(false);
      notify("买家已创建并选中", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "创建买家失败", "error"); }
    finally { setCreatingPurchaser(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const salePrice = form.salePrice === "" || form.salePrice === null || form.salePrice === undefined
        ? null
        : Number(form.salePrice);
      await apiRequest("/biz/order", { method: form.id ? "PUT" : "POST", body: { ...form, orderNum: Number(form.orderNum || 1), salePrice } });
      notify(form.id ? "订单已修改" : "订单已新增", "success");
      onSaved(); onClose();
    } catch (error) { notify(error instanceof Error ? error.message : "保存失败", "error"); }
    finally { setSaving(false); }
  }
  return (
    <form id={formId} className="mobile-form sheet-editor-form order-editor-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="span-full order-purchaser-field"><span>下单人 *</span><div className="order-purchaser-select"><select required={!form.id} disabled={purchaserLoading} value={form.purchaserShortId || ""} onChange={(e) => selectPurchaser(e.target.value)}><option value="">{purchaserLoading ? "正在加载买家" : "请选择已绑定店铺的买家"}</option>{form.purchaser && form.purchaserShortId && !purchasers.some((item) => String(item.shortId) === String(form.purchaserShortId)) ? <option value={form.purchaserShortId}>{form.purchaser} · 当前买家</option> : null}{purchasers.map((item) => <option disabled={!item.storeId} key={String(item.id)} value={item.shortId || ""}>{item.name || "未命名"} · {item.phone || "无手机号"} · {item.storeName || "未绑定店铺"}</option>)}</select><button type="button" onClick={() => setCreatePurchaserOpen((value) => !value)}><UserPlus size={16} />新增买家</button></div>{form.purchaserShortId ? <small className="order-purchaser-current"><StoreIcon size={13} />{form.purchaser || "--"} · ID {form.purchaserShortId} · {form.store || "未绑定店铺"}</small> : null}</label>
        {createPurchaserOpen ? <div className="span-full order-purchaser-create"><div><label><span>买家姓名</span><input value={purchaserForm.name} onChange={(event) => setPurchaserForm((current) => ({ ...current, name: event.target.value }))} /></label><label><span>手机号</span><input inputMode="tel" maxLength={11} value={purchaserForm.phone} onChange={(event) => setPurchaserForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} /></label><label><span>绑定店铺</span><select value={purchaserForm.storeCode} onChange={(event) => setPurchaserForm((current) => ({ ...current, storeCode: event.target.value }))}><option value="">请选择</option>{stores.map((store) => <option key={String(store.id || store.code)} value={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select></label></div><button type="button" disabled={creatingPurchaser} onClick={createAndSelectPurchaser}>{creatingPurchaser ? <LoaderCircle className="spin" size={16} /> : <UserPlus size={16} />}创建并选中</button></div> : null}
        <label><span>下单时间 *</span><input required type="date" value={String(form.orderTime || "").slice(0, 10)} onChange={(e) => set("orderTime", e.target.value)} /></label>
        <label><span>订单状态</span><select value={form.orderStatus || ""} onChange={(e) => set("orderStatus", e.target.value)}><option value="">请选择</option>{dictionaries.orderStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>商品名称 *</span><select required disabled={productLoading} value={form.orderName || ""} onChange={(e) => set("orderName", e.target.value)}><option value="">{productLoading ? "正在加载商品" : "请选择"}</option>{form.orderName && !productOptions.some((item) => String(item.value) === String(form.orderName)) ? <option value={form.orderName}>{form.orderNameDesc || form.orderName}</option> : null}{productOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {form.orderName === "other" ? <label><span>自定义商品 *</span><input required value={form.orderNameDesc || ""} onChange={(e) => set("orderNameDesc", e.target.value)} /></label> : null}
        <label><span>商品规格 *</span><select required disabled={productLoading || (!form.orderName && productCatalog.length > 0)} value={form.orderType || ""} onChange={(e) => set("orderType", e.target.value)}><option value="">{productLoading ? "正在加载规格" : "请选择"}</option>{form.orderType && !currentSkuOptions.some((item) => String(item.value) === String(form.orderType)) ? <option value={form.orderType}>{form.orderTypeDesc || form.orderType}</option> : null}{currentSkuOptions.map((item) => <option key={`${item.value}-${item.skuId || "legacy"}`} value={item.value}>{item.label}{item.salePrice !== undefined ? ` · ¥${item.salePrice.toFixed(2)}` : ""}</option>)}</select></label>
        {form.orderType === "other" ? <label><span>自定义规格 *</span><input required value={form.orderTypeDesc || ""} onChange={(e) => set("orderTypeDesc", e.target.value)} /></label> : null}
        <label><span>商品数量 *</span><input required type="number" min="1" max="200" value={form.orderNum || 1} onChange={(e) => set("orderNum", e.target.value)} /></label>
        <label><span>销售价格</span><input type="number" inputMode="decimal" min="0" step="0.01" placeholder="留空按默认价格" value={form.salePrice ?? ""} onChange={(e) => set("salePrice", e.target.value)} /></label>
        <label><span>收件人 *</span><input required value={form.customer || ""} onChange={(e) => set("customer", e.target.value)} /></label>
        <label><span>手机号 *</span><input required inputMode="tel" maxLength={11} value={form.phone || ""} onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="span-full"><span>收货地址 *</span><textarea required rows={3} value={form.address || ""} onChange={(e) => set("address", e.target.value)} /></label>
        <label><span>快递公司</span><select value={form.expCom || ""} onChange={(e) => set("expCom", e.target.value)}><option value="">请选择</option>{dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>快递单号</span><input value={form.expCode || ""} onChange={(e) => set("expCode", e.target.value)} /></label>
        <label className="span-full"><span>备注</span><textarea rows={3} maxLength={500} value={form.orderDesc || ""} onChange={(e) => set("orderDesc", e.target.value)} /></label>
      </div>
      {form.id ? <div className="switch-row"><label><input type="checkbox" checked={Boolean(form.isUpdateBill)} onChange={(e) => set("isUpdateBill", e.target.checked)} />更新价格</label><label><input type="checkbox" checked={Boolean(form.isUpdateExp)} onChange={(e) => set("isUpdateExp", e.target.checked)} />更新物流</label></div> : null}
    </form>
  );
}

export function ShippingEditor({
  initial,
  onSaved,
  onClose,
  notify,
  formId = "shipping-editor-form",
  onSavingChange,
}: {
  initial: DataRow;
  onSaved: () => void;
  onClose: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  formId?: string;
  onSavingChange?: (saving: boolean) => void;
}) {
  const dictionaries = useContext(DictionaryContext);
  const [expCom, setExpCom] = useState(String(initial.expCom || ""));
  const [expCode, setExpCode] = useState(String(initial.expCode || ""));
  const [detecting, setDetecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { onSavingChange?.(saving); }, [onSavingChange, saving]);
  useEffect(() => () => onSavingChange?.(false), [onSavingChange]);
  async function detectExpress(codeToCheck?: string) {
    const code = (codeToCheck || expCode).trim();
    if (!code) return notify("请先输入快递单号", "info");
    setDetecting(true);
    try {
      const result = await apiRequest<{ data?: DataRow }>("/biz/exp/getCom", { query: { expCode: code } });
      const detected = String(result.data?.expCom || "");
      if (detected) { setExpCom(detected); notify(`已识别为${result.data?.expComDesc || optionLabel(detected, dictionaries.expressCompanies)}`, "success"); }
      else notify("暂未识别快递公司，请手动选择", "info");
    } catch (error) { notify(error instanceof Error ? error.message : "快递识别失败", "error"); }
    finally { setDetecting(false); }
  }
  // 从一段杂文本里挑出最像快递单号的那一截：优先 10+ 位纯数字，其次 10+ 位字母数字混合
  function extractTrackingNumber(text: string): string {
    const digitRuns = text.match(/\d{10,20}/g);
    if (digitRuns && digitRuns.length) {
      digitRuns.sort((a, b) => b.length - a.length);
      return digitRuns[0] || text.trim();
    }
    const alnum = text.match(/[A-Za-z0-9]{10,20}/g);
    if (alnum && alnum.length) {
      alnum.sort((a, b) => b.length - a.length);
      return alnum[0] || text.trim();
    }
    return text.trim();
  }
  async function scanExpress() {
    if (scanning) return;
    setScanning(true);
    try {
      // 优先尝试用 BarcodeDetector + 摄像头真扫码；不支持的浏览器/设备走剪贴板兜底（与录单页的「智能识别」一致）
      if (typeof window !== "undefined" && "BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia) {
        const Detector = (window as unknown as { BarcodeDetector: new (init?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "itf", "pdf417"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        const track = stream.getVideoTracks()[0];
        const capture = new ImageCapture(track);
        // grabFrame 已在 Chromium 实现但 lib.dom.d.ts 未声明，绕过类型检查
        const grabFrame = (capture as unknown as { grabFrame: () => Promise<ImageBitmap> }).grabFrame.bind(capture);
        try {
          for (let attempt = 0; attempt < 30; attempt += 1) {
            const bitmap = await grabFrame();
            const codes = await detector.detect(bitmap);
            if (codes.length) {
              const number = extractTrackingNumber(codes[0].rawValue || "");
              if (number) {
                setExpCode(number);
                notify("扫码成功，正在识别快递公司", "success");
                detectExpress(number);
                return;
              }
            }
            await new Promise((resolve) => window.setTimeout(resolve, 250));
          }
          notify("未识别到快递单号，请手动输入或粘贴", "info");
        } finally {
          track.stop();
          stream.getTracks().forEach((t) => t.stop());
        }
        return;
      }
      // 兜底：从剪贴板读取（手机端扫完码通常会复制，或用户手动复制）
      const text = await readFromClipboard();
      const trimmed = (text || "").trim();
      if (!trimmed) return notify("剪贴板为空，请先扫描或复制快递单号", "info");
      const number = extractTrackingNumber(trimmed);
      if (!number) return notify("未识别到快递单号", "info");
      setExpCode(number);
      notify("已读取剪贴板单号，正在识别快递公司", "success");
      detectExpress(number);
    } catch (error) { notify(error instanceof Error ? error.message : "扫码失败", "error"); }
    finally { setScanning(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!expCom || !expCode.trim()) return notify("请选择快递公司并填写快递单号", "info");
    setSaving(true);
    try {
      await apiRequest("/biz/order", { method: "PUT", body: { ...initial, expCom, expComDesc: optionLabel(expCom, dictionaries.expressCompanies), expCode: expCode.trim(), orderStatus: "YFH", orderStatusDesc: "已发货", isUpdateBill: false, isUpdateExp: false } });
      notify("发货成功，快递信息已保存", "success"); onSaved(); onClose();
    } catch (error) { notify(error instanceof Error ? error.message : "发货失败", "error"); }
    finally { setSaving(false); }
  }
  return (
    <form id={formId} className="shipping-editor" onSubmit={submit}>
      <section>
        <span><Truck size={22} /></span>
        <div>
          <small>待发货订单</small>
          <h3>{initial.orderCode || "--"}</h3>
          <p>{initial.customer || "--"} · {initial.orderNameDesc || initial.orderName || "--"} {initial.orderTypeDesc || initial.orderType || ""}</p>
        </div>
      </section>
      <label>
        <span>快递公司 *</span>
        <select required value={expCom} onChange={(event) => setExpCom(event.target.value)}>
          <option value="">请选择快递公司</option>
          {dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>
        <span>快递单号 *</span>
        <div className="shipping-code-input">
          <input required value={expCode} onChange={(event) => setExpCode(event.target.value.trim())} placeholder="请输入或扫描快递单号" />
          <button type="button" disabled={scanning} onClick={scanExpress} aria-label="扫描快递单号">{scanning ? <LoaderCircle className="spin" size={15} /> : <ScanText size={15} />}扫码</button>
          <button type="button" disabled={detecting} onClick={() => detectExpress()}>{detecting ? <LoaderCircle className="spin" size={15} /> : <SearchCheck size={15} />}识别</button>
        </div>
      </label>
      <p><ShieldCheck size={14} />提交后订单将变为已发货，并记录物流节点。请点右上角「发货」确认。</p>
    </form>
  );
}

export function OrderCopyMenu({ row, onCopy }: { row: DataRow; onCopy: (text: string, message: string) => void }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const orderLink = `${origin}/tools/order#${encodeURIComponent(String(row.signId || ""))}`;
  const purchaserLink = `${origin}/tools/order#${encodeURIComponent(`v-${String(row.signId || "")}`)}`;
  const orderDetail = `【订单详情】\n订单号: ${row.orderCode || ""}\n下单时间: ${shortDate(row.orderTime)}\n商品: ${row.orderNameDesc || ""} ${row.orderTypeDesc || ""} × ${row.orderNum || 1}\n收件人: ${row.customer || ""}\n手机号: ${row.phone || ""}\n地址: ${row.address || ""}\n快递: ${row.expComDesc || ""} ${row.expCode || ""}\n查看更多: ${orderLink}`;
  const purchaserOrders = `【${row.purchaser || "下单人"}】的订单列表：\n${purchaserLink}`;
  const customerOrders = `【${row.customer || "收件人"}】的订单：\n${orderLink}`;
  const expressInfo = `${row.orderNameDesc || ""}   ${row.orderTypeDesc || ""}   ${row.expComDesc || ""}\n\n收件人: ${row.customer || ""}\n手机号: ${row.phone || ""}\n地址: ${row.address || ""}`;
  const items = [
    { label: "订单详情", desc: "完整订单、快递及查询链接", icon: ReceiptText, text: orderDetail, message: "订单详情已复制", tone: "green" },
    { label: "下单人链接", desc: `${row.purchaser || "下单人"}的订单列表`, icon: User, text: purchaserOrders, message: "下单人查询链接已复制", tone: "blue" },
    { label: "收件人链接", desc: `${row.customer || "收件人"}的订单查询`, icon: ExternalLink, text: customerOrders, message: "收件人查询链接已复制", tone: "amber" },
    { label: "发货识别信息", desc: "商品、收件人、手机和地址", icon: Truck, text: expressInfo, message: "快递识别信息已复制", tone: "peach" },
  ];
  return <div className="order-copy-menu"><section><span><Copy size={21} /></span><div><small>订单 {row.orderCode || "--"}</small><h3>选择要复制的内容</h3><p>与 PC 端订单列表的复制按钮保持一致</p></div></section><div>{items.map((item) => { const Icon = item.icon; return <button type="button" key={item.label} onClick={() => onCopy(item.text, item.message)}><span className={`copy-tone-${item.tone}`}><Icon size={19} /></span><div><b>{item.label}</b><small>{item.desc}</small></div><Copy size={16} /></button>; })}</div></div>;
}

export function OrdersPage({ notify, onNavigate }: { notify: (message: string, type?: "success" | "error" | "info") => void; onNavigate?: (key: MenuKey) => void }) {
  const dictionaries = useContext(DictionaryContext);
  const [initialStatusFilter] = useState<OrderStatusView | null>(readOrderStatusView);
  useEffect(() => { clearOrderStatusView(); }, []);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadAllState, setLoadAllState] = useState<{ loading: boolean; current: number; total: number }>({ loading: false, current: 0, total: 0 });
  const [filters, setFilters] = useState<DataRow>(() => ({
    pageNum: 1,
    pageSize: 20,
    ...(initialStatusFilter ? { orderStatus: ORDER_STATUS_CODES[initialStatusFilter] } : {}),
  }));
  const [pageKeyword, setPageKeyword] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [detail, setDetail] = useState<DataRow | null>(null);
  const [shipping, setShipping] = useState<DataRow | null>(null);
  const [shippingSaving, setShippingSaving] = useState(false);
  const [copyTarget, setCopyTarget] = useState<DataRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<OrderStatusView | null>(initialStatusFilter);
  const [counts, setCounts] = useState({ pending: 0, shipping: 0, transit: 0, completed: 0 });
  // 串行刷新物流进度（与同步所有同款结构）
  const [refreshState, setRefreshState] = useState<{ loading: boolean; current: number; total: number; success: number; failed: number }>({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
  const [markPayState, setMarkPayState] = useState<{ loading: boolean; kind: "paid" | "unpaid"; current: number; total: number; success: number; failed: number }>({ loading: false, kind: "paid", current: 0, total: 0, success: 0, failed: 0 });
  const [batchActionState, setBatchActionState] = useState<{ loading: boolean; path: string; label: string; current: number; total: number; success: number; failed: number }>({ loading: false, path: "", label: "", current: 0, total: 0, success: 0, failed: 0 });
  const [batchSaleOpen, setBatchSaleOpen] = useState(false);
  const [batchSalePrice, setBatchSalePrice] = useState("");
  const [batchSaleSaving, setBatchSaleSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, stats] = await Promise.all([
        apiRequest<DataRow>("/biz/order/list", { query: filters }),
        apiRequest<{ data?: DataRow }>("/biz/order/stats"),
      ]);
      setRows(Array.isArray(result.rows) ? result.rows : []); setTotal(Number(result.total || 0));
      const statsData = (stats.data && typeof stats.data === "object" ? stats.data : {}) as DataRow;
      setCounts({
        pending: Number(statsData.pending || 0),
        shipping: Number(statsData.waiting || 0),
        transit: Number(statsData.sent || 0),
        completed: Number(statsData.completed || 0),
      });
    } catch (error) { notify(error instanceof Error ? error.message : "订单加载失败", "error"); }
    finally { setLoading(false); }
  }, [filters, notify]);
  useEffect(() => { load(); }, [load]);
  // order_info.store 现在统一存的是 storeCode。订单详情展示时拿 code 反查店名，
  // 让运营看到的还是「小曾桃铺」而不是「xiaozeng_001」。
  const [storeList, setStoreList] = useState<DataRow[]>([]);
  useEffect(() => {
    let mounted = true;
    apiRequest<{ data?: DataRow[] }>("/biz/store/options", { query: { createBy: "", name: "" } })
      .then((result) => {
        if (!mounted) return;
        const list = Array.isArray(result.data) ? result.data : [];
        setStoreList(list.filter((item) => Number(item.isDelete ?? 1) === 1));
      })
      .catch(() => { /* 加载失败不影响主功能 */ });
    return () => { mounted = false; };
  }, []);
  const [purchasers, setPurchasers] = useState<DataRow[]>([]);
  useEffect(() => {
    apiRequest<{ data?: DataRow[] }>("/biz/purchaser/list")
      .then((result) => { setPurchasers(Array.isArray(result.data) ? result.data : []); })
      .catch(() => { });
  }, []);
  const storeNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    storeList.forEach((row) => {
      const code = String(row.code || "").trim();
      const name = String(row.name || row.value || "").trim();
      if (code && name) map[code] = name;
    });
    return map;
  }, [storeList]);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(String(row.id))), [rows, selected]);
  const selectionSummary = useMemo(() => {
    const combinations = new Map<string, { product: string; area: string; size: string; count: number; saleTotal: number }>();
    selectedRows.forEach((row) => {
      const quantity = Math.max(1, Number(row.orderNum) || 1);
      const product = String(row.orderNameDesc || optionLabel(row.orderName, dictionaries.products) || "未命名商品").trim();
      const { area, size } = splitOrderAreaAndSize(String(row.orderTypeDesc || optionLabel(row.orderType, dictionaries.sizes) || "未标规格"));
      const salePrice = Number(row.salePrice);
      const key = `${product}\u0000${area}\u0000${size}`;
      const current = combinations.get(key);
      combinations.set(key, {
        product,
        area,
        size,
        count: (current?.count || 0) + quantity,
        saleTotal: (current?.saleTotal || 0) + (Number.isFinite(salePrice) ? salePrice * quantity : 0),
      });
    });
    return Array.from(combinations.values()).sort((left, right) => right.count - left.count
      || left.product.localeCompare(right.product, "zh-CN")
      || left.area.localeCompare(right.area, "zh-CN")
      || left.size.localeCompare(right.size, "zh-CN"));
  }, [dictionaries.products, dictionaries.sizes, selectedRows]);
  const selectedSaleTotal = useMemo(
    () => selectionSummary.reduce((total, item) => total + item.saleTotal, 0),
    [selectionSummary],
  );
  const ids = selectedRows.map((row) => row.id).join(",");
  const applyStatusFilter = (status: OrderStatusView | null) => {
    setStatusFilter(status);
    setSelected(new Set());
    setFilters((current: DataRow) => {
      const next: DataRow = { ...current, pageNum: 1 };
      if (status) next.orderStatus = ORDER_STATUS_CODES[status];
      else delete next.orderStatus;
      return next;
    });
  };
  // 付款状态快捷筛选数量（基于全量 rows 客户端聚合）
  const payCounts = useMemo(() => ({
    paid: rows.filter((row) => Number(row.payStatus) === 1).length,
    confirming: rows.filter((row) => Number(row.payStatus) === 3).length,
    unpaid: rows.filter((row) => ![1, 3].includes(Number(row.payStatus))).length,
  }), [rows]);
  const visibleRows = useMemo(() => {
    const statusRows = !statusFilter
      ? rows
      : statusFilter === "pending"
        ? rows.filter((row) => /DSH|待处理/.test(`${row.orderStatus}${row.orderStatusDesc}`))
        : statusFilter === "shipping"
          ? rows.filter((row) => /DTF|DFH|待发/.test(`${row.orderStatus}${row.orderStatusDesc}`))
          : statusFilter === "transit"
            ? rows.filter((row) => /YFH|YSJ|YSZ|发货|运输/.test(`${row.orderStatus}${row.orderStatusDesc}`))
            : rows.filter((row) => /YWC|已完成|已归档/.test(`${row.orderStatus}${row.orderStatusDesc}`));
    const keywords = pageKeyword.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!keywords.length) return statusRows;
    return statusRows.filter((row) => {
      const searchableText = [
        row.orderCode,
        row.orderNameDesc,
        optionLabel(row.orderName, dictionaries.products),
        row.orderTypeDesc,
        optionLabel(row.orderType, dictionaries.sizes),
        row.purchaser,
        row.customer,
        row.phone,
        row.address,
        row.expComDesc,
        optionLabel(row.expCom, dictionaries.expressCompanies),
        row.expCode,
        row.orderStatusDesc,
        row.expNewDesc,
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return keywords.every((keyword) => searchableText.includes(keyword));
    });
  }, [dictionaries.expressCompanies, dictionaries.products, dictionaries.sizes, pageKeyword, rows, statusFilter]);

  function toggle(id: unknown) {
    const value = String(id);
    setSelected((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; });
  }
  async function getDetail(row: DataRow) {
    try {
      const result = await apiRequest<DataRow>(`/biz/order/${row.id}`);
      const detailRow = result.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? result.data as DataRow
        : null;
      setDetail(mergeOrderDetailPaymentStatus(row, detailRow));
    }
    catch (error) { notify(error instanceof Error ? error.message : "详情加载失败", "error"); }
  }
  async function getEditor(row: DataRow) {
    try {
      const result = await apiRequest<DataRow>(`/biz/order/${row.id}`);
      const detailRow = result.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? result.data as DataRow
        : {};
      setEditor({
        ...row,
        ...detailRow,
        salePrice: detailRow.salePrice ?? row.salePrice ?? null,
      });
    }
    catch {
      // 列表接口本身已包含编辑所需字段；详情接口短暂失败时仍允许修改。
      setEditor({ ...row });
      notify("详情刷新失败，已使用当前订单数据打开修改", "info");
    }
  }
  async function openShipping(row?: DataRow) {
    const target = row || selectedRows[0];
    if (!target) return notify("请先选择一个订单", "info");
    if (!row && selectedRows.length > 1) return notify("每个订单的快递单号不同，请逐笔填写发货", "info");
    try { const result = await apiRequest<DataRow>(`/biz/order/${target.id}`); setShipping(result.data || target); }
    catch (error) { notify(error instanceof Error ? error.message : "订单信息加载失败", "error"); }
  }
  function action(path: string, actionIds: string, success: string) {
    return async () => {
      try { await apiRequest(`/biz/order/${path}/${actionIds}`, { method: "PATCH" }); notify(success, "success"); setSelected(new Set()); await load(); }
      catch (error) { notify(error instanceof Error ? error.message : "操作失败", "error"); }
    };
  }
  // 批量逐条串行执行（发货/完成/待发）：进度展示在批量条按钮上
  async function runBatchSequential(path: string, label: string, idArr: string[]) {
    if (batchActionState.loading) return;
    const total = idArr.length;
    let success = 0;
    let failed = 0;
    let firstErrorMsg = "";
    setBatchActionState({ loading: true, path, label, current: 0, total, success: 0, failed: 0 });
    for (const id of idArr) {
      try {
        await apiRequest(`/biz/order/${path}/${id}`, { method: "PATCH" });
        success += 1;
      } catch (error) {
        failed += 1;
        if (!firstErrorMsg) firstErrorMsg = error instanceof Error ? error.message : "操作失败";
      }
      setBatchActionState({ loading: true, path, label, current: success + failed, total, success, failed });
    }
    setBatchActionState({ loading: false, path: "", label: "", current: 0, total: 0, success: 0, failed: 0 });
    const summary = `${label}：成功 ${success} 条，失败 ${failed} 条${firstErrorMsg ? `（${firstErrorMsg}）` : ""}`;
    notify(summary, failed ? "error" : "success");
    setSelected(new Set());
    await load();
  }
  function requestBatch(path: string, label: string, row?: DataRow) {
    const targetIds = row ? String(row.id) : ids;
    const count = row ? 1 : selected.size;
    if (!targetIds) return notify("请先选择订单", "info");
    // 发货/完成/待发：逐条串行 + 进度；取消待发等仍走一次性
    const sequential = ["send", "finish", "tosend"].includes(path);
    const idArr = targetIds.split(",").filter(Boolean);
    setConfirm({
      title: label,
      message: `确认对 ${count} 个订单执行“${label}”吗？${sequential && count > 1 ? "（将逐条执行并显示进度）" : ""}`,
      action: sequential
        ? async () => { await runBatchSequential(path, label, idArr); }
        : action(path, targetIds, `${label}成功`),
    });
  }
  
  function requestDelete(row?: DataRow) {
    const target = row ? String(row.id) : ids;
    if (!target) return notify("请先选择订单", "info");
    setConfirm({ title: "删除订单", message: `删除后无法恢复，确认删除 ${row ? 1 : selected.size} 个订单？`, danger: true, action: async () => { await apiRequest(`/biz/order/${target}`, { method: "DELETE" }); notify("删除成功", "success"); setSelected(new Set()); await load(); } });
  }

  function openBatchSalePrice() {
    if (!selectedRows.length) return notify("请先选择订单", "info");
    const prices = new Set(selectedRows
      .map((row) => row.salePrice)
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map((value) => Number(value).toFixed(2)));
    setBatchSalePrice(prices.size === 1 ? Array.from(prices)[0] : "");
    setBatchSaleOpen(true);
  }

  async function submitBatchSalePrice(event: FormEvent) {
    event.preventDefault();
    const salePrice = Number(batchSalePrice);
    if (batchSalePrice.trim() === "" || !Number.isFinite(salePrice) || salePrice < 0) {
      return notify("请输入正确的销售价格", "info");
    }
    const targetIds = selectedRows.map((row) => Number(row.id)).filter(Number.isFinite);
    if (!targetIds.length) return notify("请先选择订单", "info");
    setBatchSaleSaving(true);
    try {
      await apiRequest("/biz/order/salePrice", { method: "PATCH", body: { ids: targetIds, salePrice } });
      notify(`已统一修改 ${targetIds.length} 个订单的销售价格`, "success");
      setBatchSaleOpen(false);
      setBatchSalePrice("");
      setSelected(new Set());
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "批量修改销售价格失败", "error");
    } finally {
      setBatchSaleSaving(false);
    }
  }
  // 标记付款 / 取消付款（批量条用，逐条串行 + 按钮进度）
  async function markPay(kind: "paid" | "unpaid", row?: DataRow) {
    if (markPayState.loading) return;
    const path = kind === "paid" ? "markPaid" : "markUnpaid";
    const label = kind === "paid" ? "已标记已付款" : "已取消付款标记";
    const idList = row ? [String(row.id)] : ids.split(",").filter(Boolean);
    if (!idList.length) return notify("请先选择订单", "info");
    const total = idList.length;
    let success = 0;
    let failed = 0;
    let firstErrorMsg = "";
    setMarkPayState({ loading: true, kind, current: 0, total, success: 0, failed: 0 });
    for (const id of idList) {
      try {
        await apiRequest(`/biz/order/${path}`, { method: "PATCH", body: { ids: [id] } });
        success += 1;
      } catch (error) {
        failed += 1;
        if (!firstErrorMsg) firstErrorMsg = error instanceof Error ? error.message : "操作失败";
      }
      setMarkPayState({ loading: true, kind, current: success + failed, total, success, failed });
    }
    setMarkPayState({ loading: false, kind, current: 0, total: 0, success: 0, failed: 0 });
    const summary = `${label}：成功 ${success} 条，失败 ${failed} 条${firstErrorMsg ? `（${firstErrorMsg}）` : ""}`;
    notify(summary, failed ? "error" : "success");
    setSelected(new Set());
    await load();
  }
  
// 单条刷新（卡片/批量条都用）
  async function refreshLogistics(row?: DataRow) {
    const targets = row ? [String(row.orderCode)] : selectedRows.map((item) => String(item.orderCode)).filter(Boolean);
    if (!targets.length) return notify("请先选择订单", "info");
    try { await apiRequest("/biz/exp/refresh", { method: "PATCH", body: targets, timeoutMs: 55_000 }); notify("物流轨迹已更新", "success"); await load(); }
    catch (error) { notify(error instanceof Error ? error.message : "物流刷新失败", "error"); }
  }
  // 逐单提交并展示真实进度，单张订单最长等待 55 秒，避免一个长请求被网关断开后整批结果不明。
  async function refreshLogisticsAll() {
    if (refreshState.loading) return;
    // 选中有 → 只刷选中的已发货；未选 → 刷当前可见的已发货（顶部过滤后剩余）
    const pool = selected.size ? selectedRows : visibleRows;
    const targets = pool.filter((row) => /YFH|已发货/.test(`${row.orderStatus}${row.orderStatusDesc}`));
    if (!targets.length) {
      notify("没有可刷新的已发货订单", "info");
      return;
    }
    const total = targets.length;
    setRefreshState({ loading: true, current: 0, total, success: 0, failed: 0 });
    let success = 0;
    let failed = 0;
    let firstError = "";
    for (const target of targets) {
      const orderCode = String(target.orderCode || "").trim();
      if (!orderCode) {
        failed += 1;
      } else {
        try {
          await apiRequest("/biz/exp/refresh", {
            method: "PATCH",
            body: [orderCode],
            timeoutMs: 55_000,
          });
          success += 1;
        } catch (error) {
          failed += 1;
          if (!firstError) firstError = error instanceof Error ? error.message : "物流刷新失败";
        }
      }
      setRefreshState({ loading: true, current: success + failed, total, success, failed });
    }
    setRefreshState({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
    notify(`刷新完成：成功 ${success} 条，失败 ${failed} 条${firstError ? `（${firstError}）` : ""}`, failed ? "error" : "success");
    setSelected(new Set());
    await load();
  }
  async function copy(text: string, message: string) {
    const ok = await copyToClipboard(text);
    if (ok) notify(message, "success");
    else notify("复制失败，请手动选择文本复制", "error");
  }
  async function loadAllOrders() {
    if (loadAllState.loading) return;
    const pageSize = Number(filters.pageSize || 20) || 20;
    setLoadAllState({ loading: true, current: 0, total: 0 });
    const accumulated: DataRow[] = [];
    let serverTotal = 0;
    let pageNum = 1;
    const maxPages = 200;
    try {
      while (pageNum <= maxPages) {
        const result = await apiRequest<DataRow>("/biz/order/list", { query: { ...filters, pageNum, pageSize } });
        const pageRows = Array.isArray(result.rows) ? result.rows : [];
        serverTotal = Number(result.total || 0);
        accumulated.push(...pageRows);
        setLoadAllState({ loading: true, current: accumulated.length, total: serverTotal });
        if (!pageRows.length || accumulated.length >= serverTotal) break;
        pageNum += 1;
      }
      setRows(accumulated);
      setTotal(serverTotal);
      notify(`已加载全部 ${accumulated.length} 条订单`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "加载所有订单失败", "error");
      if (accumulated.length) {
        setRows(accumulated);
        setTotal(serverTotal);
      }
    } finally {
      setLoadAllState({ loading: false, current: 0, total: 0 });
    }
  }

  return (
    <div className="module-page order-page">
      <div className="module-hero">
        <div><span className="eyebrow">今日工作台</span><h1>订单管理</h1><p>查询、审核、发货与物流跟进</p></div>
        <button className="round-add" type="button" onClick={() => setEditor("new")}><Plus size={22} /><span>新增</span></button>
      </div>
      <div className="metric-grid orders-status-grid">
        <button type="button" className={statusFilter === null ? "active" : ""} onClick={() => applyStatusFilter(null)} aria-pressed={statusFilter === null}><span className="metric-icon peach"><ShoppingBag size={19} /></span><p>本页订单</p><b>{rows.length}</b></button>
        <button type="button" className={statusFilter === "pending" ? "active" : ""} onClick={() => applyStatusFilter("pending")} aria-pressed={statusFilter === "pending"}><span className="metric-icon amber"><RotateCw size={19} /></span><p>待处理</p><b>{counts.pending}</b></button>
        <button type="button" className={statusFilter === "shipping" ? "active" : ""} onClick={() => applyStatusFilter("shipping")} aria-pressed={statusFilter === "shipping"}><span className="metric-icon blue"><PackageCheck size={19} /></span><p>待发货</p><b>{counts.shipping}</b></button>
        <button type="button" className={statusFilter === "transit" ? "active" : ""} onClick={() => applyStatusFilter("transit")} aria-pressed={statusFilter === "transit"}><span className="metric-icon green"><Truck size={19} /></span><p>运输中</p><b>{counts.transit}</b></button>
        <button type="button" className={statusFilter === "completed" ? "active" : ""} onClick={() => applyStatusFilter("completed")} aria-pressed={statusFilter === "completed"}><span className="metric-icon green"><CircleCheck size={19} /></span><p>已完成</p><b>{counts.completed}</b></button>
      </div>
      <div className="quick-pay-filter" role="toolbar" aria-label="付款状态快捷筛选"><button type="button" className={!filters.payStatus ? "active" : ""} onClick={() => setFilters((current: DataRow) => { const next: DataRow = { ...current, pageNum: 1 }; if (current.payStatus) delete next.payStatus; return next; })}>全部付款 {rows.length}</button><button type="button" className={String(filters.payStatus || "") === "1" ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, payStatus: "1", pageNum: 1 }))}><CreditCard size={13} />已付款 {payCounts.paid}</button><button type="button" className={String(filters.payStatus || "") === "3" ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, payStatus: "3", pageNum: 1 }))}>待确认 {payCounts.confirming}</button><button type="button" className={String(filters.payStatus || "") === "0" ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, payStatus: "0", pageNum: 1 }))}>未付款 {payCounts.unpaid}</button></div>
      <div className="toolbar-card search-toolbar">
        <label className="quick-search">
          <Search size={15} strokeWidth={2.2} />
          <input
            value={pageKeyword}
            onChange={(e) => setPageKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="检索本页关键信息"
            aria-label="检索当前页面已加载的订单内容"
            enterKeyHint="search"
          />
          {pageKeyword ? <button className="search-clear" type="button" aria-label="清空本页检索" onClick={() => setPageKeyword("")}><X size={14} /></button> : null}
        </label>
        <button
          className={`filter-chip${[filters.orderCode, filters.orderStatus, filters.payStatus, filters.orderName, filters.orderType, filters.customer, filters.phone, filters.purchaser, filters.store, filters.expCom, filters.expCode].some((value) => String(value || "").trim()) ? " active" : ""}`}
          type="button"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal size={14} strokeWidth={2.2} />
          筛选
        </button>
        <button className="toolbar-icon" type="button" onClick={load} aria-label="刷新"><RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} /></button>
      </div>
      <div className="secondary-actions">
        <button type="button" onClick={() => onNavigate?.("batchOrder")}><FileSpreadsheet size={16} />批量录入</button>
        <button type="button" onClick={() => downloadFile("biz/order/export", filters, `order_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><Download size={16} />导出</button>
        <button type="button" onClick={loadAllOrders} disabled={loadAllState.loading} className={loadAllState.loading ? "is-loading" : ""}>
          {loadAllState.loading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
          {loadAllState.loading ? (loadAllState.total ? `加载中 ${loadAllState.current}/${loadAllState.total}` : "加载中…") : "加载所有"}
        </button>
      </div>

      {selected.size ? <div className="batch-bar">
        <div><b>已选 {selected.size} 项</b><span className="batch-head-actions"><button type="button" className="batch-sale-trigger" onClick={openBatchSalePrice}><ReceiptText size={12} />改售价</button><button type="button" onClick={() => setSelected(new Set())}>取消选择</button></span></div>
        <div className="batch-scroll"><button onClick={() => requestBatch("cancelsend", "取消待发")}><X size={15} />取消待发</button><button onClick={() => requestBatch("tosend", "设为待发")} disabled={batchActionState.loading && batchActionState.path === "tosend"} className={batchActionState.loading && batchActionState.path === "tosend" ? "is-loading" : ""}>{batchActionState.loading && batchActionState.path === "tosend" ? <LoaderCircle className="spin" size={15} /> : <RotateCw size={15} />}{batchActionState.loading && batchActionState.path === "tosend" ? `待发中 ${batchActionState.success + batchActionState.failed}/${batchActionState.total}` : "待发"}</button><button onClick={() => requestBatch("send", "一键发货")} disabled={batchActionState.loading && batchActionState.path === "send"} className={batchActionState.loading && batchActionState.path === "send" ? "is-loading" : ""}>{batchActionState.loading && batchActionState.path === "send" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}{batchActionState.loading && batchActionState.path === "send" ? `发货中 ${batchActionState.success + batchActionState.failed}/${batchActionState.total}` : "一键发货"}</button><button onClick={() => requestBatch("finish", "一键完成")} disabled={batchActionState.loading && batchActionState.path === "finish"} className={batchActionState.loading && batchActionState.path === "finish" ? "is-loading" : ""}>{batchActionState.loading && batchActionState.path === "finish" ? <LoaderCircle className="spin" size={15} /> : <CircleCheck size={15} />}{batchActionState.loading && batchActionState.path === "finish" ? `完成中 ${batchActionState.success + batchActionState.failed}/${batchActionState.total}` : "完成"}</button><button onClick={refreshLogisticsAll} disabled={refreshState.loading} className={refreshState.loading ? "is-loading" : ""}>{refreshState.loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{refreshState.loading ? `刷新中 ${refreshState.success + refreshState.failed}/${refreshState.total}` : "刷新物流"}</button><button onClick={() => markPay("paid")} disabled={markPayState.loading} className={markPayState.loading ? "is-loading" : ""}>{markPayState.loading && markPayState.kind === "paid" ? <LoaderCircle className="spin" size={15} /> : <CreditCard size={15} />}{markPayState.loading && markPayState.kind === "paid" ? `付款标记中 ${markPayState.success + markPayState.failed}/${markPayState.total}` : "标已付"}</button><button onClick={() => markPay("unpaid")} disabled={markPayState.loading} className={markPayState.loading ? "is-loading" : ""}>{markPayState.loading && markPayState.kind === "unpaid" ? <LoaderCircle className="spin" size={15} /> : <X size={15} />}{markPayState.loading && markPayState.kind === "unpaid" ? `取消中 ${markPayState.success + markPayState.failed}/${markPayState.total}` : "取消付款"}</button><button className="danger" onClick={() => requestDelete()}><Trash2 size={15} />删除</button></div>
        <div className="batch-selection-summary">
          {selectionSummary.map((item) => (
            <span key={`${item.product}-${item.area}-${item.size}`} className="batch-selection-cell" title={`${item.product} ${item.area} ${item.size} ${item.count}件 ${formatYuan(item.saleTotal)}`}>
              <span className="batch-selection-product">{item.product}</span>
              <span className="batch-selection-area">{item.area || "--"}</span>
              <span className="batch-selection-size">{item.size || "--"}</span>
              <span className="batch-selection-count">{item.count}件</span>
              <span className="batch-selection-amount">{formatYuan(item.saleTotal)}</span>
            </span>
          ))}
          <div className="batch-selection-total"><span>销售总额</span><b>{formatYuan(selectedSaleTotal)}</b></div>
        </div>
      </div> : null}

      <div className="list-heading"><div><h2>订单列表</h2><span>共 {total} 条{statusFilter || pageKeyword.trim() ? ` · 本页匹配 ${visibleRows.length} 条` : ""}</span></div>{visibleRows.length ? <button type="button" onClick={() => setSelected(visibleRows.every((row) => selected.has(String(row.id))) ? new Set() : new Set(visibleRows.map((row) => String(row.id))))}>{visibleRows.every((row) => selected.has(String(row.id))) ? "取消全选" : "全选本页"}</button> : null}</div>
      <div className="mobile-card-list">
        {!visibleRows.length ? <EmptyState loading={loading} label={pageKeyword.trim() ? "本页匹配结果" : statusFilter ? "筛选结果" : "订单"} /> : visibleRows.map((row) => {
          const payMeta = payStatusMeta(row.payStatus);
          return (
          <article className={`order-card ${selected.has(String(row.id)) ? "selected" : ""}`} key={String(row.id)}>
            <div className="card-topline"><label className="select-check"><input type="checkbox" checked={selected.has(String(row.id))} onChange={() => toggle(row.id)} /><span><Check size={13} /></span></label><button className="order-number" type="button" onClick={() => setCopyTarget(row)}>{row.orderCode || "暂无订单号"}<Copy size={13} /></button><div className="card-topline-badges"><span className={`order-pay-badge pay-${payMeta.key}`}><CreditCard size={11} />{payMeta.label}</span><StatusBadge row={row} /></div></div>
            <button className="card-main" type="button" onClick={() => getDetail(row)}>
              <span className="product-avatar">{String(row.orderNameDesc || "果").slice(-1)}</span>
              <span className="product-copy"><b>{row.orderNameDesc || optionLabel(row.orderName, dictionaries.products) || "未命名商品"}</b><small>{row.orderTypeDesc || optionLabel(row.orderType, dictionaries.sizes)} · 数量 {row.orderNum || 1} · {row.purchaser || "--"}</small></span>
              <span className="order-price"><small>销售价格</small><b>{formatSalePrice(row.salePrice)}</b></span>
            </button>
            <div className="recipient-block"><div><User size={16} /><b>{row.customer || "--"}</b><a href={`tel:${row.phone || ""}`}><Phone size={14} />{row.phone || "--"}</a></div><p><MapPin size={15} />{row.address || "暂无收货地址"}</p></div>
            <div className="shipping-line"><span><Truck size={15} />{row.expComDesc || (row.expCom ? optionLabel(row.expCom, dictionaries.expressCompanies) : "尚未选择快递")}</span><span>{row.expCode || row.orderTime?.slice(0, 10) || ""}</span></div>
            {row.expNewDesc ? <p className="latest-route"><span />{row.expNewDesc}</p> : null}
            <div className="card-actions"><button onClick={() => getDetail(row)}><Eye size={16} />详情</button><button onClick={() => getEditor(row)}><Pencil size={16} />修改</button><button onClick={() => setCopyTarget(row)}><Copy size={16} />复制</button><button className="primary-action" onClick={() => openShipping(row)}><Send size={16} />发货</button></div>
            <div className="card-more"><button onClick={() => requestBatch("tosend", "设为待发", row)}>设为待发</button><button onClick={() => requestBatch("finish", "完成订单", row)}>完成</button><button onClick={() => refreshLogistics(row)}>刷新物流</button>{Number(row.payStatus) === 1 ? <button onClick={() => markPay("unpaid", row)}>取消付款</button> : <button onClick={() => markPay("paid", row)}>标已付款</button>}<button className="danger-text" onClick={() => requestDelete(row)}>删除</button></div>
          </article>
        );})}
      </div>
      {rows.length < total ? <button className="load-more" type="button" onClick={() => setFilters((current: DataRow) => ({ ...current, pageSize: Number(current.pageSize || 20) + 20 }))}>{loading ? <LoaderCircle className="spin" size={17} /> : <ChevronRight size={17} />}加载更多</button> : null}

      <Sheet open={filterOpen} title="筛选订单" onClose={() => setFilterOpen(false)}>
        <form
          className="filter-sheet"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((current: DataRow) => ({ ...current, pageNum: 1 }));
            setFilterOpen(false);
            load();
          }}
        >
          <div className="filter-sheet-body">
            <section className="filter-section">
              <header><h3>订单状态</h3></header>
              <div className="filter-chips" role="listbox" aria-label="订单状态">
                <button type="button" className={!filters.orderStatus ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, orderStatus: "" }))}>全部</button>
                {dictionaries.orderStatuses.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    className={String(filters.orderStatus || "") === String(item.value) ? "active" : ""}
                    onClick={() => setFilters((current: DataRow) => ({ ...current, orderStatus: item.value }))}
                  >{item.label}</button>
                ))}
              </div>
            </section>

            <section className="filter-section">
              <header><h3>付款状态</h3></header>
              <div className="filter-chips" role="listbox" aria-label="付款状态">
                <button type="button" className={!filters.payStatus ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, payStatus: "" }))}>全部</button>
                <button type="button" className={String(filters.payStatus || "") === "1" ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, payStatus: "1" }))}>已付款</button>
                <button type="button" className={String(filters.payStatus || "") === "3" ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, payStatus: "3" }))}>待确认</button>
                <button type="button" className={String(filters.payStatus || "") === "0" ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, payStatus: "0" }))}>未付款</button>
              </div>
            </section>

            <section className="filter-section">
              <header><h3>商品与规格</h3></header>
              <div className="filter-field-grid">
                <label>
                  <span>商品</span>
                  <select value={filters.orderName || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderName: e.target.value }))}>
                    <option value="">全部商品</option>
                    {dictionaries.products.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>规格</span>
                  <select value={filters.orderType || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderType: e.target.value }))}>
                    <option value="">全部规格</option>
                    {dictionaries.sizes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="filter-section">
              <header><h3>收件信息</h3></header>
              <div className="filter-field-stack">
                <label>
                  <span>订单号</span>
                  <input value={filters.orderCode || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderCode: e.target.value }))} placeholder="输入订单号" />
                </label>
                <div className="filter-field-grid">
                  <label className="filter-purchaser-field">
                    <span>收件人</span>
                    <input value={filters.customer || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, customer: e.target.value }))} placeholder="姓名" />
                  </label>
                  <label>
                    <span>手机号</span>
                    <input inputMode="tel" value={filters.phone || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, phone: e.target.value }))} placeholder="手机号" />
                  </label>
                </div>
              </div>
            </section>

            <section className="filter-section">
              <header><h3>物流与人员</h3></header>
              <div className="filter-field-stack">
                <div className="filter-field-grid">
                  <label>
                    <span>快递公司</span>
                    <select value={filters.expCom || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, expCom: e.target.value }))}>
                      <option value="">全部快递</option>
                      {dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>快递单号</span>
                    <input value={filters.expCode || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, expCode: e.target.value }))} placeholder="运单号" />
                  </label>
                </div>
                <div className="filter-field-grid">
                  <label>
                    <span>下单人</span>
                    <PurchaserFilterSearch
                      value={filters.purchaser}
                      purchasers={purchasers}
                      onChange={(value) => setFilters((current: DataRow) => {
                        const next: DataRow = { ...current };
                        if (value) next.purchaser = value;
                        else delete next.purchaser;
                        return next;
                      })}
                    />
                  </label>
                  <label>
                    <span>创建人</span>
                    <input value={filters.createBy || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, createBy: e.target.value }))} placeholder="创建人" />
                  </label>
                </div>
                <div className="filter-field-grid">
                  <label>
                    <span>下单时间</span>
                    <input type="date" value={filters.orderTime || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderTime: e.target.value }))} />
                  </label>
                  <label>
                    <span>备注</span>
                    <input value={filters.orderDesc || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderDesc: e.target.value }))} placeholder="备注关键词" />
                  </label>
                </div>
              </div>
            </section>
          </div>

          <div className="filter-sheet-footer">
            <button
              type="button"
              className="filter-reset"
              onClick={() => {
                setFilters({ pageNum: 1, pageSize: 20 });
              }}
            >重置</button>
            <button className="filter-apply" type="submit">查看结果</button>
          </div>
        </form>
      </Sheet>
      <Sheet
        open={editor !== null}
        title={editor === "new" ? "新增订单" : "修改订单"}
        onClose={() => { setEditor(null); setEditorSaving(false); }}
        wide
        headerAction={
          editor !== null ? (
            <button className="sheet-header-save" type="submit" form="order-editor-form" disabled={editorSaving}>
              {editorSaving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
              {editorSaving ? "保存中" : "保存订单"}
            </button>
          ) : null
        }
      >
        {editor !== null ? (
          <OrderEditor
            initial={editor === "new" ? null : editor}
            formId="order-editor-form"
            onSavingChange={setEditorSaving}
            onSaved={load}
            onClose={() => { setEditor(null); setEditorSaving(false); }}
            notify={notify}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={shipping !== null}
        title="填写发货信息"
        onClose={() => { setShipping(null); setShippingSaving(false); }}
        headerAction={
          shipping ? (
            <button className="sheet-header-save" type="submit" form="shipping-editor-form" disabled={shippingSaving}>
              {shippingSaving ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
              {shippingSaving ? "提交中" : "发货"}
            </button>
          ) : null
        }
      >
        {shipping ? (
          <ShippingEditor
            initial={shipping}
            formId="shipping-editor-form"
            onSavingChange={setShippingSaving}
            onSaved={() => { setSelected(new Set()); load(); }}
            onClose={() => { setShipping(null); setShippingSaving(false); }}
            notify={notify}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={batchSaleOpen}
        title="批量修改售价"
        onClose={() => { if (!batchSaleSaving) setBatchSaleOpen(false); }}
        headerAction={<button className="sheet-header-save" type="submit" form="batch-sale-form" disabled={batchSaleSaving}>{batchSaleSaving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{batchSaleSaving ? "保存中" : "确认修改"}</button>}
      >
        <form id="batch-sale-form" className="batch-sale-editor" onSubmit={submitBatchSalePrice}>
          <div><small>已选择</small><b>{selectedRows.length} 个订单</b><span>修改后会同步更新账单利润</span></div>
          <label><span>统一销售价格</span><div><i>¥</i><input required type="number" inputMode="decimal" min="0" step="0.01" value={batchSalePrice} onChange={(event) => setBatchSalePrice(event.target.value)} placeholder="0.00" /></div></label>
        </form>
      </Sheet>
      <Sheet open={copyTarget !== null} title="复制订单信息" onClose={() => setCopyTarget(null)}>{copyTarget ? <OrderCopyMenu row={copyTarget} onCopy={(text, message) => { copy(text, message); setCopyTarget(null); }} /> : null}</Sheet>
      <Sheet open={detail !== null} title="订单详情" onClose={() => setDetail(null)} wide>{detail ? <OrderDetail row={detail} onCopy={() => { setCopyTarget(detail); setDetail(null); }} storeNameByCode={storeNameByCode} /> : null}</Sheet>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export function statusTone(code?: string): "default" | "success" | "info" | "warning" | "danger" {
  if (code === "YWC") return "success";
  if (/YFH|YSJ|YSZ|YSD/.test(code || "")) return "info";
  if (/YC|YQX/.test(code || "")) return "danger";
  return "warning";
}

export function OrderDetail({ row, onCopy, storeNameByCode }: { row: DataRow; onCopy: () => void; storeNameByCode: Record<string, string> }) {
  const tone = statusTone(row.orderStatus);
  const tracking = Array.isArray(row.expInfoList) ? row.expInfoList : [];
  const product = `${row.orderNameDesc || row.orderName || ""} ${row.orderTypeDesc || row.orderType || ""} × ${row.orderNum || 1}`.trim();
  // order_info.store 是 storeCode，展示时用 code→name 反查；如果没匹配上再 fallback 显示原文
  const storeCode = String(row.store || "").trim();
  const storeName = storeCode ? storeNameByCode[storeCode] || storeCode : "";
  return <div className="order-detail">
    <div className="order-detail-head">
      <div className="order-detail-head-info">
        <small>订单编号</small>
        <b>{row.orderCode || "--"}</b>
        <span className={`pill pill-${tone}`}>{row.orderStatusDesc || row.orderStatus || "未知"}</span>
      </div>
      <button className="icon-button" type="button" onClick={onCopy} aria-label="复制订单"><Copy size={18} /></button>
    </div>

    <section className="order-detail-section">
      <header className="order-detail-section-head"><ShoppingBag size={15} /><h3>订单信息</h3></header>
      <div className="order-detail-grid">
        <div><span>下单人</span><b>{row.purchaser || "--"}</b></div>
        <div><span>下单时间</span><b>{String(row.orderTime || "").replace("T", " ").slice(0, 19) || "--"}</b></div>
        <div><span>付款状态</span><b>{payStatusMeta(row.payStatus).label}</b></div>
        <div><span>销售价格</span><b>{formatSalePrice(row.salePrice)}</b></div>
        {[1, 3].includes(Number(row.payStatus)) && row.paidTime ? <div><span>{Number(row.payStatus) === 3 ? "提交确认时间" : "付款时间"}</span><b>{String(row.paidTime).replace("T", " ").slice(0, 16)}</b></div> : null}
        <div className="full-width"><span>商品</span><b>{product || "--"}</b></div>
        {storeName ? <div><span>店铺</span><b>{storeName}</b></div> : null}
      </div>
    </section>

    <section className="order-detail-section">
      <header className="order-detail-section-head"><User size={15} /><h3>收件信息</h3></header>
      <div className="order-detail-grid">
        <div><span>收件人</span><b>{row.customer || "--"}</b></div>
        <div><span>手机号</span><b>{row.phone || "--"}</b></div>
        {row.address ? <div className="full-width"><span>收货地址</span><b>{row.address}</b></div> : null}
      </div>
    </section>

    <section className="order-detail-section">
      <header className="order-detail-section-head"><Truck size={15} /><h3>物流信息</h3></header>
      <div className="order-detail-grid">
        <div><span>快递公司</span><b>{row.expComDesc || row.expCom || "暂无"}</b></div>
        <div><span>快递单号</span><b>{row.expCode && row.expCode !== "无" ? row.expCode : "暂无"}</b></div>
      </div>
      {tracking.length ? <div className="order-detail-timeline">{tracking.map((item, index) => <div className={index === 0 ? "latest" : ""} key={String(item.id || `${item.expTime}-${index}`)}><i /><div><b>{item.expStatusDesc || item.expDesc || "物流更新"}</b><p>{item.expDesc || item.desc || "状态已更新"}</p><small>{item.expTime || item.createTime || ""}</small></div></div>)}</div> : <p className="order-detail-empty">暂无物流轨迹</p>}
    </section>

    {row.orderDesc ? <section className="order-detail-section">
      <header className="order-detail-section-head"><Sparkles size={15} /><h3>备注</h3></header>
      <p className="order-detail-note">{row.orderDesc}</p>
    </section> : null}
  </div>;
}
