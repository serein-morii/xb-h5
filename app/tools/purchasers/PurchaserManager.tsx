
import { CheckCircle2, Copy, Link2, LoaderCircle, Phone, Plus, RefreshCw, Search, Store, Unlink, User, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, getStoredToken } from "../../lib/api";
import { buildOrderLink, formatOrderLinkCopy } from "../order-link/format";

type Purchaser = { id: number; name?: string; phone?: string; shortId?: string; storeId?: number; storeCode?: string; storeName?: string; createTime?: string; updateTime?: string };
type StoreRow = { code?: string; name?: string; text?: string; value?: string };

export default function PurchaserManager({ embedded = false }: { embedded?: boolean }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [purchasers, setPurchasers] = useState<Purchaser[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [draftStore, setDraftStore] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", storeCode: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [purchaserResult, storeResult] = await Promise.all([
        apiRequest<{ data?: Purchaser[] }>("/biz/purchaser/list"),
        apiRequest<{ data?: StoreRow[] }>("/search/store", { auth: false }),
      ]);
      const rows = Array.isArray(purchaserResult.data) ? purchaserResult.data : [];
      setPurchasers(rows); setStores(Array.isArray(storeResult.data) ? storeResult.data : []);
      setDraftStore(Object.fromEntries(rows.map((item) => [item.id, item.storeCode || ""])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下单人列表加载失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const loggedIn = Boolean(getStoredToken()); setAuthenticated(loggedIn); if (loggedIn) load(); else setLoading(false); }, [load]);

  const visible = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return purchasers;
    return purchasers.filter((item) => [item.name, item.phone, item.shortId, item.storeName].some((field) => String(field || "").toLowerCase().includes(value)));
  }, [keyword, purchasers]);

  async function bind(item: Purchaser) {
    const storeCode = draftStore[item.id]; if (!storeCode) return setError("请选择要绑定的店铺");
    setBusyId(item.id); setError("");
    try {
      await apiRequest(`/biz/purchaser/${item.id}/store`, { method: "PUT", body: { storeCode } });
      setNotice("店铺绑定已更新"); await load(); window.setTimeout(() => setNotice(""), 1600);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "绑定失败"); }
    finally { setBusyId(null); }
  }

  async function unbind(item: Purchaser) {
    if (!window.confirm(`确认解除“${item.name || "该下单人"}”与“${item.storeName || "当前店铺"}”的绑定吗？解绑后原专属链接将暂时失效。`)) return;
    setBusyId(item.id); setError("");
    try {
      await apiRequest(`/biz/purchaser/${item.id}/store/unbind`, { method: "PATCH" });
      setNotice("已解绑，原下单链接暂时失效"); await load(); window.setTimeout(() => setNotice(""), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "解绑失败"); }
    finally { setBusyId(null); }
  }

  async function copyOrderLink(item: Purchaser) {
    if (!item.shortId || !item.storeId) return setError("该买家尚未绑定有效店铺，暂不能复制下单链接");
    const text = formatOrderLinkCopy(item.name, buildOrderLink(item.shortId));
    await navigator.clipboard.writeText(text);
    setNotice(`已复制${item.name || "买家"}的下单链接`); window.setTimeout(() => setNotice(""), 1800);
  }

  async function createPurchaser() {
    if (!createForm.name.trim() || !/^1\d{10}$/.test(createForm.phone) || !createForm.storeCode) return setError("请完整填写下单人姓名、11位手机号和绑定店铺");
    setBusyId(-1); setError("");
    try {
      await apiRequest("/biz/purchaser", { method: "POST", body: { name: createForm.name.trim(), phone: createForm.phone, storeCode: createForm.storeCode } });
      setCreateOpen(false); setCreateForm({ name: "", phone: "", storeCode: "" }); setNotice("下单人已创建并绑定店铺"); await load(); window.setTimeout(() => setNotice(""), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); }
    finally { setBusyId(null); }
  }

  if (!authenticated && !embedded) return <div className="tool-page"><section className="tool-hero"><span><Users size={25} /></span><div><small>PURCHASER MANAGEMENT</small><h1>买家管理</h1><p>查看、绑定或解绑买家的所属店铺。</p></div></section><section className="order-link-login"><User size={28} /><h2>请先登录</h2><p>店铺绑定属于管理操作，登录后才可以查看和修改。</p><a href="/">前往管理登录</a></section></div>;

  return <div className={`${embedded ? "admin-tool-module" : "tool-page"} purchaser-manager-page`}>
    <section className="tool-hero"><span><Users size={25} /></span><div><small>PURCHASER MANAGEMENT</small><h1>买家管理</h1><p>一个买家绑定一个店铺；解绑后对应短链接立即失效。</p></div></section>
    <section className="purchaser-manager-toolbar"><div><Search size={16} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名、手机号、短ID或店铺" /></div><button type="button" title="新建下单人" onClick={() => { setCreateForm((current) => ({ ...current, storeCode: current.storeCode || stores[0]?.code || "" })); setCreateOpen(true); }}><Plus size={18} /></button><button type="button" title="刷新" onClick={load}><RefreshCw className={loading ? "spin" : ""} size={17} /></button></section>
    {error ? <p className="tool-error purchaser-manager-message">{error}</p> : null}
    {notice ? <p className="tool-success purchaser-manager-message"><CheckCircle2 size={14} />{notice}</p> : null}
    {loading ? <div className="purchaser-manager-loading"><LoaderCircle className="spin" size={24} />正在加载下单人</div> : <section className="purchaser-manager-list">{visible.map((item) => <article key={item.id}><header><span>{String(item.name || "下").slice(0, 1)}</span><div><h2>{item.name || "未命名"}</h2><p><Phone size={12} />{item.phone || "--"}<em>ID {item.shortId}</em></p></div><i className={item.storeId ? "bound" : ""}>{item.storeId ? "已绑定" : "未绑定"}</i></header><div className="purchaser-current-store"><Store size={16} /><div><small>当前店铺</small><b>{item.storeName || "尚未绑定店铺"}</b></div>{item.storeId ? <><button className="copy-link" type="button" onClick={() => copyOrderLink(item)}><Copy size={14} />复制链接</button><button type="button" disabled={busyId === item.id} onClick={() => unbind(item)}><Unlink size={14} />解绑</button></> : null}</div><div className="purchaser-bind-row"><select value={draftStore[item.id] || ""} onChange={(event) => setDraftStore((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">选择店铺</option>{stores.map((store) => <option value={store.code} key={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select><button type="button" disabled={busyId === item.id} onClick={() => bind(item)}>{busyId === item.id ? <LoaderCircle className="spin" size={15} /> : <Link2 size={15} />}{item.storeId ? "更换绑定" : "绑定店铺"}</button></div></article>)}</section>}
    {!loading && !visible.length ? <div className="tool-list-empty">没有符合条件的下单人</div> : null}
    {createOpen ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}><section className="purchaser-create-modal"><button type="button" onClick={() => setCreateOpen(false)}><X size={18} /></button><span><UserPlus size={22} /></span><small>NEW PURCHASER</small><h2>新建下单人</h2><p>创建时必须绑定店铺，生成链接时无需再携带店铺编码。</p><label><em>下单人姓名</em><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="请输入姓名" /></label><label><em>手机号</em><input inputMode="tel" maxLength={11} value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} placeholder="请输入11位手机号" /></label><label><em>绑定店铺</em><select value={createForm.storeCode} onChange={(event) => setCreateForm((current) => ({ ...current, storeCode: event.target.value }))}><option value="">请选择店铺</option>{stores.map((store) => <option value={store.code} key={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select></label><button className="purchaser-create-submit" type="button" disabled={busyId === -1} onClick={createPurchaser}>{busyId === -1 ? <LoaderCircle className="spin" size={17} /> : <UserPlus size={17} />}创建并绑定店铺</button></section></div> : null}
  </div>;
}
