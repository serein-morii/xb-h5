import { ArrowLeft, Ban, CheckCircle2, LoaderCircle, Phone, RefreshCw, Search, Store as StoreIcon } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, listPublicStores, PublicStoreRow } from "../../lib/api";
import OrderList, { PublicOrderRecord } from "../OrderList";
import { OrderStatsCards, StatusFilter, computeOrderStats, filterOrdersByStatus } from "../OrderStatsCards";

type Row = Record<string, unknown>;

type Props = {
  /** 路径里的店铺编码；为空时由组件尝试从 location.pathname 解析 */
  storeCode?: string;
  /** 店铺名解析到后回传 App.tsx，用于更新浏览器 tab title */
  onResolvedName?: (name: string) => void;
};

function resolveStoreCodeFromPath(): string {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^\/tools\/store-query\/([^/?#]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export default function StoreQuery({ storeCode: storeCodeProp, onResolvedName }: Props) {
  const storeCode = useMemo(() => {
    const prop = String(storeCodeProp || "").trim();
    if (prop) return prop;
    return resolveStoreCodeFromPath();
  }, [storeCodeProp]);

  const [store, setStore] = useState<PublicStoreRow | null>(null);
  const [storeError, setStoreError] = useState("");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [uuid, setUuid] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // 拉店铺信息（顶部要展示店铺名 + 提示「仅查该店铺的订单」）
  useEffect(() => {
    if (!storeCode) {
      setStoreError("缺少店铺编码");
      onResolvedName?.("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await listPublicStores({ code: storeCode });
        const data = Array.isArray(result) ? result : Array.isArray(result.data) ? result.data : [];
        if (cancelled) return;
        if (data.length) {
          setStore(data[0]);
          setStoreError("");
          // 把解析到的真名回传给 App.tsx，让浏览器 tab title 显示「店铺名｜专属查询」而不是 URL code
          const resolved = String(data[0].value || data[0].text || "").trim();
          onResolvedName?.(resolved);
        } else {
          setStore(null);
          setStoreError("店铺不存在或已下架");
          onResolvedName?.("");
        }
      } catch (cause) {
        if (cancelled) return;
        setStore(null);
        setStoreError(cause instanceof Error ? cause.message : "店铺信息加载失败");
        onResolvedName?.("");
      }
    })();
    return () => { cancelled = true; };
  }, [storeCode, onResolvedName]);

  const loadCaptcha = useCallback(async () => {
    try {
      const result = await apiRequest<Row>("/captchaImage", { auth: false });
      setUuid(String(result.uuid || "")); setCaptcha(result.img ? `data:image/png;base64,${result.img}` : ""); setCode("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "验证码加载失败"); }
  }, []);
  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);

  useEffect(() => {
    if (!orders.length) return;
    const node = resultsRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.4) {
      window.scrollBy({ top: rect.top - 80, behavior: "smooth" });
    }
  }, [orders]);

  const stats = useMemo(() => computeOrderStats(orders), [orders]);
  const filteredOrders = useMemo(() => filterOrdersByStatus(orders, statusFilter), [orders, statusFilter]);
  const queryBlocked = Number(store?.blockQuery) === 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (queryBlocked) return setError("该店铺已暂停订单查询，请联系店铺或客服了解恢复时间");
    if (!phone.trim() || !code.trim()) return setError("请输入手机号和验证码");
    if (!storeCode) return setError("缺少店铺编码");
    setLoading(true); setError(""); setOrders([]); setStatusFilter(null);
    try {
      // 关键：与原 /search 不同的是带上 storeCode 字段，后端 OrderInfoSearchDTO
      // 会用这个值在订单表上再加一道 store = storeCode 过滤。
      const result = await apiRequest<{ data?: PublicOrderRecord[] }>("/search", {
        auth: false,
        method: "POST",
        body: {
          searchKey: phone.trim(),
          code: code.trim(),
          uuid,
          storeCode,
        },
      });
      const data = Array.isArray(result.data) ? result.data : [];
      setOrders(data);
      if (!data.length) setError("该店铺下暂无订单记录");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "查询失败，请稍后重试");
      await loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  const storeName = String(store?.value || store?.text || "").trim() || storeCode;
  const storeNotice = String(store?.notice || "").trim();

  return <div className="tool-page order-search-tool store-query-tool">
    <a className="store-query-back" href="/tools/store-query">
      <ArrowLeft size={16} />
      <span>返回店铺列表</span>
    </a>
    <section className="tool-hero">
      <span><StoreIcon size={25} /></span>
      <div>
        <small>STORE-SCOPED ORDER SEARCH</small>
        <h1>{storeName}</h1>
        <p>这是该店铺的专属订单查询链接。</p>
      </div>
    </section>
    {storeNotice ? <p className="store-query-notice">{storeNotice}</p> : null}
    {queryBlocked ? <p className="tool-error store-query-blocked"><Ban size={14} />该店铺已暂停订单查询，请联系店铺或客服了解恢复时间。</p> : null}
    {storeError ? <p className="tool-error">{storeError}</p> : null}
    <form className="tool-form-card" onSubmit={submit}>
      <label>
        <span>手机号</span>
        <div className="tool-input">
          <Phone size={17} />
          <input
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="请输入收件手机号"
            disabled={queryBlocked}
          />
        </div>
      </label>
      <label>
        <span>验证码</span>
        <div className="tool-captcha">
          <div className="tool-input">
            <CheckCircle2 size={17} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="请输入验证码"
              disabled={queryBlocked}
            />
          </div>
          <button type="button" onClick={loadCaptcha} disabled={queryBlocked}>
            {captcha ? <img src={captcha} alt="验证码" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </label>
      {error ? <p className="tool-error">{error}</p> : null}
      <button className="tool-primary" disabled={loading || queryBlocked} type="submit">
        {loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
        {queryBlocked ? "该店铺已暂停查单" : loading ? "正在查询" : "查询该店铺订单"}
      </button>
    </form>
    {orders.length ? <div ref={resultsRef}>
      <OrderStatsCards stats={stats} filter={statusFilter} onSelect={setStatusFilter} label="店铺订单概览" />
      <OrderList orders={filteredOrders} contact={orders[0]?.linkNameAndPhone?.trim()} />
    </div> : null}
  </div>;
}
