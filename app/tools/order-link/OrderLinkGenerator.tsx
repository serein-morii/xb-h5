
import { CheckCircle2, Copy, ExternalLink, Link2, LoaderCircle, Phone, Search, Store, User, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, getStoredToken } from "../../lib/api";
import { buildOrderLink, formatOrderLinkCopy } from "./format";

type StoreRow = { id?: number; name?: string; text?: string; value?: string; code?: string; isDelete?: number };
type Purchaser = { id?: number; name?: string; phone?: string; shortId?: string; storeId?: number; storeCode?: string; storeName?: string; createTime?: string; updateTime?: string; orderCodePwd?: string };
type OrderSummary = { id?: number; orderCode?: string; orderNameDesc?: string; orderTypeDesc?: string; orderNum?: number; customer?: string; phone?: string; store?: string; orderStatusDesc?: string; orderTime?: string };
type Candidate = { purchaser?: Purchaser; orders?: OrderSummary[] };

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
  const [lastPwd, setLastPwd] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [historyCopied, setHistoryCopied] = useState("");

  useEffect(() => {
    const loggedIn = Boolean(getStoredToken());
    setAuthenticated(loggedIn);
    if (!loggedIn) return;
    Promise.all([
      apiRequest<{ data?: StoreRow[] }>("/search/store", { auth: false, query: { createBy: "", name: "" } }),
      apiRequest<{ data?: Purchaser[] }>("/biz/purchaser/list"),
    ]).then(([storeResult, purchaserResult]) => {
        const rows = Array.isArray(storeResult.data) ? storeResult.data.filter((item) => Number(item.isDelete ?? 1) === 1) : [];
        const purchaserRows = Array.isArray(purchaserResult.data) ? purchaserResult.data : [];
        setStores(rows); setHistory(purchaserRows.filter((item) => item.shortId && item.storeId && item.storeName).sort((left, right) => String(right.createTime || "").localeCompare(String(left.createTime || "")) || Number(right.id || 0) - Number(left.id || 0)));
        if (rows[0]?.code) setStoreCode(String(rows[0].code));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "店铺或历史链接加载失败"));
  }, []);

  function orderLink(purchaser: Purchaser) {
    return buildOrderLink(purchaser.shortId);
  }

  function buildLink(purchaser: Purchaser) {
    if (!purchaser.shortId) return setError("下单人短ID缺失，请先更新后端再重试");
    setLink(orderLink(purchaser));
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
    setBusy(true); setError(""); setLink(""); setSearched(false);
    try {
      const result = await apiRequest<{ data?: Candidate[] }>("/biz/purchaser/match", { query: { name: name.trim() } });
      const rows = Array.isArray(result.data) ? result.data : [];
      setCandidates(rows); setSearched(true);
      if (!rows.length) await createPurchaser();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下单人匹配失败"); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    const text = formatOrderLinkCopy(name, link, lastPwd);
    await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyHistoryLink(purchaser: Purchaser) {
    const value = orderLink(purchaser);
    const text = formatOrderLinkCopy(purchaser.name, value, purchaser.orderCodePwd);
    await navigator.clipboard.writeText(text); setHistoryCopied(String(purchaser.shortId)); window.setTimeout(() => setHistoryCopied(""), 1600);
  }

  if (!authenticated && !embedded) return <div className="tool-page"><section className="tool-hero"><span><Link2 size={25} /></span><div><small>PRIVATE LINK CREATOR</small><h1>生成链接</h1><p>该功能会检索买家档案，需要先登录管理后台。</p></div></section><section className="order-link-login"><User size={28} /><h2>请先登录</h2><p>登录后才能匹配买家、查看历史订单并生成专属链接。</p><a href="/">前往管理登录</a></section></div>;

  return <div className={`${embedded ? "admin-tool-module" : "tool-page"} order-link-page`}>
    <section className="tool-hero"><span><Link2 size={25} /></span><div><small>PURCHASER ORDER LINK</small><h1>生成链接</h1><p>店铺绑定在买家档案中，链接只保留6位短码。</p></div></section>
    <form className="tool-form-card order-link-form" onSubmit={searchPurchaser}>
      <label><span>下单店铺</span><div className="tool-input"><Store size={17} /><select value={storeCode} onChange={(event) => { setStoreCode(event.target.value); setLink(""); }}>{stores.map((item) => <option value={item.code} key={String(item.id || item.code)}>{item.name || item.text || item.value || item.code}</option>)}</select></div></label>
      <label><span>下单人姓名</span><div className="tool-input"><User size={17} /><input value={name} onChange={(event) => { setName(event.target.value); setLink(""); setSearched(false); }} placeholder="输入姓名后匹配下单人档案" /></div></label>
      <label><span>下单人手机号</span><div className="tool-input"><Phone size={17} /><input inputMode="tel" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="新建下单人时必填" /></div></label>
      {error ? <p className="tool-error">{error}</p> : null}
      <button className="tool-primary" disabled={busy || !stores.length} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}{busy ? "正在匹配" : "匹配下单人并生成"}</button>
    </form>

    {searched && candidates.length ? <section className="purchaser-match-panel"><header><div><small>MATCHED PURCHASERS</small><h2>找到 {candidates.length} 个同名下单人</h2><p>请核对手机号、绑定店铺和历史订单；不会静默换绑店铺。</p></div></header><div>{candidates.map((candidate) => <article key={String(candidate.purchaser?.id || candidate.purchaser?.shortId)}><div className="purchaser-match-person"><span>{String(candidate.purchaser?.name || "下").slice(0, 1)}</span><div><b>{candidate.purchaser?.name}</b><p>{candidate.purchaser?.phone} · ID {candidate.purchaser?.shortId}</p><em>{candidate.purchaser?.storeName ? `已绑定：${candidate.purchaser.storeName}` : "尚未绑定店铺"}</em></div><button type="button" onClick={async () => { if (!candidate.purchaser) return; setBusy(true); setError(""); try { await selectPurchaser(candidate.purchaser); } catch (cause) { setError(cause instanceof Error ? cause.message : "绑定失败"); } finally { setBusy(false); } }}>{candidate.purchaser?.storeId ? "就是这个下单人" : "绑定并生成"}</button></div><div className="purchaser-history">{candidate.orders?.length ? candidate.orders.map((order) => <p key={String(order.id)}><span><b>{order.orderNameDesc} {order.orderTypeDesc} × {order.orderNum || 1}</b><small>{order.customer} · {order.phone} · {String(order.orderTime || "").slice(0, 10)}</small></span><em>{order.orderStatusDesc || "--"}</em></p>) : <small>暂无可辅助确认的历史订单</small>}</div></article>)}</div><button className="purchaser-create-new" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await createPurchaser(); } catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); } finally { setBusy(false); } }}><UserPlus size={17} />都不是，创建新下单人并绑定店铺</button></section> : null}

    {link ? <section className="generated-link-card"><span><CheckCircle2 size={24} /></span><div><small>链接已生成</small><h2>{name}的专属下单链接</h2><p>{link}</p><div><button type="button" onClick={copyLink}><Copy size={16} />{copied ? "已复制" : "复制链接"}</button><a href={link} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开测试</a></div></div></section> : null}
    {!link && !searched ? <section className="generated-link-history"><header><div><small>EXISTING ORDER LINKS</small><h2>已有专属链接</h2><p>根据买家短 ID 实时拼接，按买家创建时间倒序排列。</p></div><em>{history.length} 个</em></header>{history.length ? <div>{history.map((item) => { const value = orderLink(item); return <article key={String(item.id || item.shortId)}><span>{String(item.name || "买").slice(0, 1)}</span><div><b>{item.name || "未命名买家"}</b><p>{item.storeName} · ID {item.shortId}</p><small>{item.createTime ? `创建于 ${String(item.createTime).slice(0, 16)}` : "创建时间暂无"}</small></div><button type="button" onClick={() => copyHistoryLink(item)}><Copy size={15} />{historyCopied === String(item.shortId) ? "已复制" : "复制"}</button><a href={value} target="_blank" rel="noreferrer" aria-label={`打开${item.name || "买家"}的下单链接`}><ExternalLink size={15} /></a></article>; })}</div> : <div className="generated-link-history-empty"><Link2 size={22} /><p>暂无已绑定店铺的买家链接</p></div>}</section> : null}
  </div>;
}
