
import { CalendarClock, CheckCircle2, Copy, ExternalLink, Link2, LoaderCircle, Phone, Search, Store, User, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest, copyToClipboard, getStoredToken } from "../../lib/api";
import { buildOrderLink, formatOrderLinkCopy } from "./format";

type StoreRow = { id?: number; name?: string; text?: string; value?: string; code?: string; isDelete?: number };
type Purchaser = { id?: number; name?: string; phone?: string; shortId?: string; storeId?: number; storeCode?: string; storeName?: string; createTime?: string; updateTime?: string; orderCodePwd?: string; lastOrderTime?: string; orderCount?: number | string | null };
type OrderSummary = { id?: number; orderCode?: string; orderNameDesc?: string; orderTypeDesc?: string; orderNum?: number; customer?: string; phone?: string; store?: string; orderStatusDesc?: string; orderTime?: string };
type Candidate = { purchaser?: Purchaser; orders?: OrderSummary[] };

/** 历史列表按 createTime 划分的组 */
type HistoryGroup = { key: "today" | "yesterday" | "thisWeek" | "earlier"; label: string; items: Purchaser[] };

function getTimeGroup(dateValue: string | undefined | null): HistoryGroup["key"] {
  if (!dateValue) return "earlier";
  const t = new Date(String(dateValue).replace(/-/g, "/")).getTime();
  if (Number.isNaN(t)) return "earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86400000;
  if (t >= startOfToday) return "today";
  if (t >= startOfToday - oneDay) return "yesterday";
  if (t >= startOfToday - oneDay * 7) return "thisWeek";
  return "earlier";
}

function groupHistory(items: Purchaser[]): HistoryGroup[] {
  const buckets: Record<HistoryGroup["key"], Purchaser[]> = { today: [], yesterday: [], thisWeek: [], earlier: [] };
  for (const item of items) {
    buckets[getTimeGroup(item.createTime)].push(item);
  }
  const ordered: HistoryGroup[] = [
    { key: "today", label: "今天", items: buckets.today },
    { key: "yesterday", label: "昨天", items: buckets.yesterday },
    { key: "thisWeek", label: "本周", items: buckets.thisWeek },
    { key: "earlier", label: "更早", items: buckets.earlier },
  ];
  return ordered.filter((group) => group.items.length > 0);
}

/** "3 分钟前" / "2 小时前" / "昨天 18:30" / "2026-07-12" 这种相对化的时间展示 */
function formatRelativeTime(value: string | undefined | null): string {
  if (!value) return "—";
  const t = new Date(String(value).replace(/-/g, "/")).getTime();
  if (Number.isNaN(t)) return String(value).slice(0, 10);
  const diff = Date.now() - t;
  const minute = 60000, hour = 3600000, day = 86400000;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 2) return `昨天 ${new Date(t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return new Date(t).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function OrderLinkGenerator({ embedded = false }: { embedded?: boolean }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [history, setHistory] = useState<Purchaser[]>([]);
  const [storeCode, setStoreCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [linkFor, setLinkFor] = useState("");
  const [lastPwd, setLastPwd] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [historyCopied, setHistoryCopied] = useState("");
  // 历史列表的搜索/过滤
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyStoreFilter, setHistoryStoreFilter] = useState("");

  useEffect(() => {
    const loggedIn = Boolean(getStoredToken());
    setAuthenticated(loggedIn);
    if (!loggedIn) return;
    Promise.all([
      apiRequest<{ data?: StoreRow[] }>("/biz/store/options", { query: { createBy: "", name: "" } }),
      apiRequest<{ data?: Purchaser[] }>("/biz/purchaser/list"),
    ]).then(([storeResult, purchaserResult]) => {
        const rows = Array.isArray(storeResult.data) ? storeResult.data.filter((item) => Number(item.isDelete ?? 1) === 1) : [];
        const purchaserRows = Array.isArray(purchaserResult.data) ? purchaserResult.data : [];
        setStores(rows); setHistory(purchaserRows.filter((item) => item.shortId && item.storeId && item.storeName).sort((left, right) => String(right.createTime || "").localeCompare(String(left.createTime || "")) || Number(right.id || 0) - Number(left.id || 0)));
        if (rows[0]?.code) setStoreCode(String(rows[0].code));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "店铺或历史链接加载失败"));
  }, []);

  // 历史列表过滤 + 分组
  const filteredHistory = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase();
    if (!keyword && !historyStoreFilter) return history;
    return history.filter((item) => {
      if (historyStoreFilter && item.storeCode !== historyStoreFilter) return false;
      if (!keyword) return true;
      return [item.name, item.phone, item.shortId].some((field) => String(field || "").toLowerCase().includes(keyword));
    });
  }, [history, historyKeyword, historyStoreFilter]);

  const groupedHistory = useMemo(() => groupHistory(filteredHistory), [filteredHistory]);
  const historyStoreOptions = useMemo(() => {
    const seen = new Set<string>();
    const result: { code: string; name: string }[] = [];
    for (const item of history) {
      if (item.storeCode && !seen.has(item.storeCode)) {
        seen.add(item.storeCode);
        result.push({ code: item.storeCode, name: item.storeName || item.storeCode });
      }
    }
    return result;
  }, [history]);

  function orderLink(purchaser: Purchaser) {
    return buildOrderLink(purchaser.shortId);
  }

  function buildLink(purchaser: Purchaser) {
    if (!purchaser.shortId) return setError("下单人短ID缺失，请先更新后端再重试");
    setLink(orderLink(purchaser));
    setLinkFor(purchaser.name || "");
    setLastPwd(purchaser.orderCodePwd || null);
    setCandidates([]); setSearched(false); setError("");
  }

  async function selectPurchaser(purchaser: Purchaser) {
    if (!purchaser.id) return setError("下单人数据不完整");
    if (purchaser.storeId && purchaser.storeCode !== storeCode) return setError(`该买家已绑定“${purchaser.storeName || "其他店铺"}”，请先在买家管理中解绑`);
    if (!purchaser.storeId) {
      const result = await apiRequest<{ data?: Purchaser }>(`/biz/purchaser/${purchaser.id}/store`, { method: "PUT", body: { storeCode } });
      if (!result.data) throw new Error("绑定店铺后未返回下单人数据");
      buildLink(result.data); return;
    }
    buildLink(purchaser);
  }

  async function createPurchaser() {
    if (!/^1\d{10}$/.test(phone.trim())) return setError("创建新下单人需要填写正确的11位手机号");
    const result = await apiRequest<{ data?: Purchaser }>("/biz/purchaser", { method: "POST", body: { name: name.trim(), phone: phone.trim(), storeCode } });
    if (!result.data) throw new Error("创建下单人后未返回数据");
    buildLink(result.data);
  }

  async function searchPurchaser(event: FormEvent) {
    event.preventDefault();
    if (!storeCode) return setError("请选择店铺");
    if (!name.trim()) return setError("请输入下单人姓名");
    setBusy(true); setError(""); setLink(""); setLinkFor(""); setSearched(false);
    try {
      const result = await apiRequest<{ data?: Candidate[] }>("/biz/purchaser/match", { query: { name: name.trim() } });
      const rows = Array.isArray(result.data) ? result.data : [];
      setCandidates(rows); setSearched(true);
      if (!rows.length) await createPurchaser();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下单人匹配失败"); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    const text = formatOrderLinkCopy(linkFor || name, link, lastPwd);
    const ok = await copyToClipboard(text);
    if (!ok) return alert("复制失败，请手动选择链接复制");
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  function dismissLink() {
    setLink(""); setLinkFor(""); setLastPwd(null);
  }

  async function copyHistoryLink(purchaser: Purchaser) {
    const value = orderLink(purchaser);
    const text = formatOrderLinkCopy(purchaser.name, value, purchaser.orderCodePwd);
    const ok = await copyToClipboard(text);
    if (!ok) return alert("复制失败，请手动选择链接复制");
    setHistoryCopied(String(purchaser.shortId)); window.setTimeout(() => setHistoryCopied(""), 1600);
  }

  if (!authenticated && !embedded) return <div className="tool-page"><section className="tool-hero"><span><Link2 size={25} /></span><div><small>PRIVATE LINK CREATOR</small><h1>生成链接</h1><p>该功能会检索买家档案，需要先登录管理后台。</p></div></section><section className="order-link-login"><User size={28} /><h2>请先登录</h2><p>登录后才能匹配买家、查看历史订单并生成专属链接。</p><a href="/manage">前往管理登录</a></section></div>;

  return <div className={`${embedded ? "admin-tool-module" : "tool-page"} order-link-page`}>
    <section className="tool-hero"><span><Link2 size={25} /></span><div><small>PURCHASER ORDER LINK</small><h1>生成链接</h1><p>店铺绑定在买家档案中，链接只保留6位短码。</p></div></section>

    {link ? <section className="generated-link-card generated-link-card-sticky">
      <span><CheckCircle2 size={24} /></span>
      <div>
        <small>链接已生成 · {linkFor || name}</small>
        <h2>专属下单链接</h2>
        <p className="generated-link-url">{link}</p>
        {lastPwd ? <p className="generated-link-pwd">下单码：<b>{lastPwd}</b></p> : null}
        <div className="generated-link-actions">
          <button type="button" onClick={copyLink}><Copy size={16} />{copied ? "已复制" : "复制链接"}</button>
          <a href={link} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开测试</a>
          <button type="button" className="generated-link-dismiss" onClick={dismissLink} aria-label="收起"><X size={16} /></button>
        </div>
      </div>
    </section> : null}

    <form className="tool-form-card order-link-form" onSubmit={searchPurchaser}>
      <div className="order-link-form-row">
        <label><span>下单店铺</span><div className="tool-input"><Store size={16} /><select value={storeCode} onChange={(event) => { setStoreCode(event.target.value); setLink(""); setLinkFor(""); }}>{stores.map((item) => <option value={item.code} key={String(item.id || item.code)}>{item.name || item.text || item.value || item.code}</option>)}</select></div></label>
        <label><span>下单人姓名</span><div className="tool-input"><User size={16} /><input value={name} onChange={(event) => { setName(event.target.value); setLink(""); setLinkFor(""); setSearched(false); }} placeholder="姓名（必填）" /></div></label>
        <label><span>下单人手机号</span><div className="tool-input"><Phone size={16} /><input inputMode="tel" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="11 位手机号（新建时必填）" /></div></label>
      </div>
      {error ? <p className="tool-error">{error}</p> : null}
      <button className="tool-primary" disabled={busy || !stores.length} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}{busy ? "正在匹配" : "匹配下单人并生成链接"}</button>
    </form>

    {searched && candidates.length ? <section className="purchaser-match-panel"><header><div><small>MATCHED PURCHASERS</small><h2>找到 {candidates.length} 个同名下单人</h2><p>请核对手机号、绑定店铺和历史订单；不会静默换绑店铺。</p></div></header><div>{candidates.map((candidate) => <article key={String(candidate.purchaser?.id || candidate.purchaser?.shortId)}><div className="purchaser-match-person"><span>{String(candidate.purchaser?.name || "下").slice(0, 1)}</span><div><b>{candidate.purchaser?.name}</b><p>{candidate.purchaser?.phone} · ID {candidate.purchaser?.shortId}</p><em>{candidate.purchaser?.storeName ? `已绑定：${candidate.purchaser.storeName}` : "尚未绑定店铺"}</em></div><button type="button" onClick={async () => { if (!candidate.purchaser) return; setBusy(true); setError(""); try { await selectPurchaser(candidate.purchaser); } catch (cause) { setError(cause instanceof Error ? cause.message : "绑定失败"); } finally { setBusy(false); } }}>{candidate.purchaser?.storeId ? "就是这个下单人" : "绑定并生成"}</button></div><div className="purchaser-history">{candidate.orders?.length ? candidate.orders.map((order) => <p key={String(order.id)}><span><b>{order.orderNameDesc} {order.orderTypeDesc} × {order.orderNum || 1}</b><small>{order.customer} · {order.phone} · {String(order.orderTime || "").slice(0, 10)}</small></span><em>{order.orderStatusDesc || "--"}</em></p>) : <small>暂无可辅助确认的历史订单</small>}</div></article>)}</div><button className="purchaser-create-new" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await createPurchaser(); } catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); } finally { setBusy(false); } }}><UserPlus size={17} />都不是，创建新下单人并绑定店铺</button></section> : null}

    {!searched ? <section className="generated-link-history">
      <header>
        <div>
          <small>EXISTING ORDER LINKS</small>
          <h2>已有专属链接</h2>
          <p>{history.length === filteredHistory.length ? `按创建时间分组，共 ${history.length} 个。` : `匹配 ${filteredHistory.length} / ${history.length} 个。`}</p>
        </div>
        <em>{filteredHistory.length} 个</em>
      </header>

      {history.length ? <div className="generated-link-history-filter">
        <div className="tool-input">
          <Search size={16} />
          <input
            value={historyKeyword}
            onChange={(event) => setHistoryKeyword(event.target.value)}
            placeholder="搜索姓名 / 手机号 / 短 ID"
          />
          {historyKeyword ? <button type="button" className="filter-clear" onClick={() => setHistoryKeyword("")} aria-label="清空搜索"><X size={14} /></button> : null}
        </div>
        <div className="tool-input">
          <Store size={16} />
          <select value={historyStoreFilter} onChange={(event) => setHistoryStoreFilter(event.target.value)}>
            <option value="">全部店铺</option>
            {historyStoreOptions.map((opt) => <option value={opt.code} key={opt.code}>{opt.name}</option>)}
          </select>
        </div>
      </div> : null}

      {history.length === 0 ? <div className="generated-link-history-empty"><Link2 size={22} /><p>暂无已绑定店铺的买家链接</p></div> : null}
      {history.length > 0 && filteredHistory.length === 0 ? <div className="generated-link-history-empty"><Search size={22} /><p>没有匹配「{historyKeyword}」的链接{historyStoreFilter ? "（已按店铺过滤）" : ""}</p><button type="button" onClick={() => { setHistoryKeyword(""); setHistoryStoreFilter(""); }}>清除过滤</button></div> : null}

      {groupedHistory.map((group) => <div className="generated-link-history-group" key={group.key}>
        <div className="generated-link-history-group-header"><span>{group.label}</span><em>{group.items.length}</em></div>
        <div>{group.items.map((item) => {
          const value = orderLink(item);
          const parsedOrderCount = Number(item.orderCount);
          const hasOrderCount = item.orderCount !== undefined && item.orderCount !== null && item.orderCount !== "" && Number.isFinite(parsedOrderCount);
          return <article key={String(item.id || item.shortId)} className="generated-link-card-item">
            <div className="generated-link-card-main">
              <span className="generated-link-avatar">{String(item.name || "买").slice(0, 1)}</span>
              <div className="generated-link-card-info">
                <div className="generated-link-card-title">
                  <b>{item.name || "未命名买家"}</b>
                  <span className="generated-link-short-id">ID {item.shortId}</span>
                </div>
                <p className="generated-link-meta">
                  <Store size={11} />{item.storeName || item.storeCode || "未指定店铺"}
                </p>
                <p className="generated-link-stats">
                  <CalendarClock size={11} />
                  {hasOrderCount ? <>
                    {item.lastOrderTime ? <>最近下单 <b>{formatRelativeTime(item.lastOrderTime)}</b><span className="generated-link-divider">·</span></> : null}
                    <span className="generated-link-order-count">共 <b>{Math.max(0, parsedOrderCount)}</b> 单</span>
                    <span className="generated-link-divider">·</span>
                  </> : null}
                  <span>创建于 {formatRelativeTime(item.createTime)}</span>
                </p>
              </div>
            </div>
            <div className="generated-link-card-actions">
              <button type="button" onClick={() => copyHistoryLink(item)} className="generated-link-action-primary">
                <Copy size={14} />{historyCopied === String(item.shortId) ? "已复制" : "复制链接"}
              </button>
              <a href={value} target="_blank" rel="noreferrer" aria-label={`打开${item.name || "买家"}的下单链接`} className="generated-link-action-secondary">
                <ExternalLink size={14} />打开
              </a>
            </div>
          </article>;
        })}</div>
      </div>)}
    </section> : null}
  </div>;
}
