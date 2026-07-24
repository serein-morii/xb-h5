
import { CheckCircle2, Copy, KeyRound, Link2, LoaderCircle, Phone, Plus, RefreshCw, Search, ShieldCheck, Store, Unlink, User, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, getStoredToken } from "../../lib/api";
import { buildOrderLink, formatOrderLinkCopy } from "../order-link/format";

type Purchaser = { id: number; name?: string; phone?: string; shortId?: string; storeId?: number; storeCode?: string; storeName?: string; requirePwd?: number; orderCodePwd?: string; orderCodePwdExpire?: string; createTime?: string; updateTime?: string };
type StoreRow = { code?: string; name?: string; text?: string; value?: string; orderCodeRequirePwd?: number };

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
  // 下单码配置弹窗
  const [codeTarget, setCodeTarget] = useState<Purchaser | null>(null);
  const [codeForm, setCodeForm] = useState({ requirePwd: 0, pwd: "", expireDays: "7", useCustom: false });
  const [codeBusy, setCodeBusy] = useState(false);

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
    const text = formatOrderLinkCopy(item.name, buildOrderLink(item.shortId), item.orderCodePwd);
    await navigator.clipboard.writeText(text);
    setNotice(`已复制${item.name || "买家"}的下单链接`); window.setTimeout(() => setNotice(""), 1800);
  }

  function openCodeConfig(item: Purchaser) {
    setCodeTarget(item);
    // 已有配置 -> 回填；没有 -> 默认跟店铺（requirePwd=null 但表单用 -1 表示"跟店铺"）
    const cur = item.requirePwd;
    setCodeForm({
      requirePwd: cur === null || cur === undefined ? -1 : cur,
      pwd: item.orderCodePwd || "",
      expireDays: "7",
      useCustom: Boolean(item.orderCodePwd),
    });
  }

  async function saveCodeConfig() {
    if (!codeTarget) return;
    // 前端用 -1 表示"跟店铺"，传给后端转 null
    const requirePwd = codeForm.requirePwd === -1 ? null : codeForm.requirePwd;
    let pwd: string | undefined;
    if (requirePwd === 1 && codeForm.useCustom) {
      if (!/^\d{4,6}$/.test(codeForm.pwd.trim())) { setError("自定义下单码必须是 4-6 位数字"); return; }
      pwd = codeForm.pwd.trim();
    }
    // 后端 @JsonFormat 期望 yyyy-MM-dd HH:mm:ss，toISOString() 是 ISO 格式会解析失败
    const days = Number(codeForm.expireDays) || 7;
    const d = new Date(Date.now() + days * 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expireStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    setCodeBusy(true); setError("");
    try {
      await apiRequest(`/biz/purchaser/${codeTarget.id}/order-code`, {
        method: "PUT",
        body: { requirePwd, orderCodePwd: pwd, orderCodePwdExpire: requirePwd === 1 ? expireStr : null },
      });
      setCodeTarget(null);
      setNotice("下单码配置已更新"); await load(); window.setTimeout(() => setNotice(""), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "配置失败"); }
    finally { setCodeBusy(false); }
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
    {loading ? <div className="purchaser-manager-loading"><LoaderCircle className="spin" size={24} />正在加载下单人</div> : <section className="purchaser-manager-list">{visible.map((item) => <article key={item.id}><header><span>{String(item.name || "下").slice(0, 1)}</span><div><h2>{item.name || "未命名"}</h2><p><Phone size={12} />{item.phone || "--"}<em>ID {item.shortId}</em></p></div><i className={item.storeId ? "bound" : ""}>{item.storeId ? "已绑定" : "未绑定"}</i></header><div className="purchaser-current-store"><Store size={16} /><div><small>当前店铺</small><b>{item.storeName || "尚未绑定店铺"}</b></div>{item.storeId ? <><button className="copy-link" type="button" onClick={() => copyOrderLink(item)}><Copy size={14} />复制链接</button><button type="button" disabled={busyId === item.id} onClick={() => unbind(item)}><Unlink size={14} />解绑</button></> : null}</div><div className="purchaser-order-code-row"><KeyRound size={15} /><div className="purchaser-order-code-info"><small>下单码</small><b>{item.requirePwd === 1 ? "需密码" : item.requirePwd === 0 ? "免密码" : "跟店铺"}</b>{item.orderCodePwd ? <em>码 {item.orderCodePwd}</em> : null}{item.orderCodePwdExpire ? <em>至 {String(item.orderCodePwdExpire).slice(0, 10)}</em> : null}</div><button type="button" className="purchaser-order-code-btn" onClick={() => openCodeConfig(item)}>配置</button></div><div className="purchaser-bind-row"><select value={draftStore[item.id] || ""} onChange={(event) => setDraftStore((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">选择店铺</option>{stores.map((store) => <option value={store.code} key={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select><button type="button" disabled={busyId === item.id} onClick={() => bind(item)}>{busyId === item.id ? <LoaderCircle className="spin" size={15} /> : <Link2 size={15} />}{item.storeId ? "更换绑定" : "绑定店铺"}</button></div></article>)}</section>}
    {!loading && !visible.length ? <div className="tool-list-empty">没有符合条件的下单人</div> : null}
    {createOpen ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}><section className="purchaser-create-modal"><button type="button" onClick={() => setCreateOpen(false)}><X size={18} /></button><span><UserPlus size={22} /></span><small>NEW PURCHASER</small><h2>新建下单人</h2><p>创建时必须绑定店铺，生成链接时无需再携带店铺编码。</p><label><em>下单人姓名</em><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="请输入姓名" /></label><label><em>手机号</em><input inputMode="tel" maxLength={11} value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} placeholder="请输入11位手机号" /></label><label><em>绑定店铺</em><select value={createForm.storeCode} onChange={(event) => setCreateForm((current) => ({ ...current, storeCode: event.target.value }))}><option value="">请选择店铺</option>{stores.map((store) => <option value={store.code} key={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select></label><button className="purchaser-create-submit" type="button" disabled={busyId === -1} onClick={createPurchaser}>{busyId === -1 ? <LoaderCircle className="spin" size={17} /> : <UserPlus size={17} />}创建并绑定店铺</button></section></div> : null}
    {codeTarget ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCodeTarget(null)}><section className="purchaser-create-modal purchaser-code-modal"><button type="button" onClick={() => setCodeTarget(null)}><X size={18} /></button><span><KeyRound size={22} /></span><small>ORDER CODE</small><h2>下单码配置 · {codeTarget.name}</h2><p>开启后买家下单需输入密码；适合"微信付款后录单"场景。</p>
      <div className="purchaser-code-switch-group">
        <label className={codeForm.requirePwd === -1 ? "active" : ""}><input type="radio" name="pwdSwitch" checked={codeForm.requirePwd === -1} onChange={() => setCodeForm((c) => ({ ...c, requirePwd: -1 }))} />跟店铺设置</label>
        <label className={codeForm.requirePwd === 1 ? "active" : ""}><input type="radio" name="pwdSwitch" checked={codeForm.requirePwd === 1} onChange={() => setCodeForm((c) => ({ ...c, requirePwd: 1 }))} />需要密码</label>
        <label className={codeForm.requirePwd === 0 ? "active" : ""}><input type="radio" name="pwdSwitch" checked={codeForm.requirePwd === 0} onChange={() => setCodeForm((c) => ({ ...c, requirePwd: 0 }))} />免密码</label>
      </div>
      {codeForm.requirePwd === 1 ? <>
        <label className="purchaser-code-pwd-toggle"><input type="checkbox" checked={codeForm.useCustom} onChange={(e) => setCodeForm((c) => ({ ...c, useCustom: e.target.checked }))} /><em>自定义下单码（不勾选则随机生成）</em></label>
        {codeForm.useCustom ? <label><em>自定义下单码（4-6 位数字）</em><input inputMode="numeric" maxLength={6} value={codeForm.pwd} onChange={(event) => setCodeForm((c) => ({ ...c, pwd: event.target.value.replace(/\D/g, "") }))} placeholder="如 1234" /></label> : <p className="purchaser-code-hint"><ShieldCheck size={13} />未自定义，保存时自动生成 4-6 位随机密码</p>}
        <label><em>有效天数</em><input inputMode="numeric" value={codeForm.expireDays} onChange={(event) => setCodeForm((c) => ({ ...c, expireDays: event.target.value.replace(/\D/g, "") }))} placeholder="默认 7 天" /></label>
      </> : null}
      {error ? <p className="tool-error">{error}</p> : null}
      <button className="purchaser-create-submit" type="button" disabled={codeBusy} onClick={saveCodeConfig}>{codeBusy ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}保存配置</button>
    </section></div> : null}
  </div>;
}
