
import { Ban, CheckCircle2, Copy, KeyRound, Link2, LoaderCircle, Monitor, Pencil, Phone, Plus, RefreshCw, Search, ShieldCheck, Store, Trash2, Unlink, User, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, copyToClipboard, getStoredToken } from "../../lib/api";
import { buildOrderLink, formatOrderLinkCopy } from "../order-link/format";

type Purchaser = { id: number; name?: string; phone?: string; shortId?: string; storeId?: number; storeCode?: string; storeName?: string; requirePwd?: number; orderCodePwd?: string; orderCodePwdExpire?: string; remark?: string; blockOrder?: number; blockQuery?: number; blockDisplayType?: string; createTime?: string; updateTime?: string };
type BlockDisplay = "banner" | "fullscreen" | "confirm";
const BLOCK_DISPLAY_OPTIONS: { value: BlockDisplay; label: string; hint: string }[] = [
  { value: "banner", label: "顶部 tab", hint: "禁用哪个，整个页面不展示，tab 没有选项，只显示一个占满整行" },
  { value: "fullscreen", label: "全屏占用", hint: "哪个禁用就在哪个 tab 页下面显示禁用；两个都禁用就整个画面都禁用" },
  { value: "confirm", label: "弹窗提醒", hint: "进入/切到被拦 tab 时弹窗提醒，提交按钮禁用，查询确认后不展示数据" },
];
type StoreRow = { code?: string; name?: string; text?: string; value?: string; orderCodeRequirePwd?: number };
type EditForm = { name: string; phone: string; storeCode: string; remark: string };
const EMPTY_EDIT: EditForm = { name: "", phone: "", storeCode: "", remark: "" };

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
  // 编辑买家弹窗
  const [editTarget, setEditTarget] = useState<Purchaser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [editBusy, setEditBusy] = useState(false);
  // block 开关：记录哪张卡正在保存
  const [blockBusyId, setBlockBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [purchaserResult, storeResult] = await Promise.all([
        apiRequest<{ data?: Purchaser[] }>("/biz/purchaser/list"),
        apiRequest<{ data?: StoreRow[] }>("/biz/store/options"),
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
    setBusyId(item.id); setError("");
    try {
      await apiRequest(`/biz/purchaser/${item.id}/store/unbind`, { method: "PATCH" });
      setConfirmingUnbind(null);
      setNotice("已解绑，原下单链接暂时失效"); await load(); window.setTimeout(() => setNotice(""), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "解绑失败"); }
    finally { setBusyId(null); }
  }

  function requestUnbind(item: Purchaser) {
    setConfirmingUnbind(item);
    setError("");
  }

  async function copyOrderLink(item: Purchaser) {
    if (!item.shortId || !item.storeId) return setError("该买家尚未绑定有效店铺，暂不能复制下单链接");
    const text = formatOrderLinkCopy(item.name, buildOrderLink(item.shortId), item.orderCodePwd);
    const ok = await copyToClipboard(text);
    if (!ok) return setError("复制失败，请手动选择链接复制");
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

  function openEdit(item: Purchaser) {
    setEditTarget(item);
    // storeCode 为空时显示"未绑定"选项；保留原始值，原"换绑"按钮也能改店铺，两条入口并存
    setEditForm({
      name: item.name || "",
      phone: item.phone || "",
      storeCode: item.storeCode || "",
      remark: item.remark || "",
    });
    setError("");
  }

  function closeEdit() {
    setEditTarget(null);
    setEditForm(EMPTY_EDIT);
    setError("");
  }

  async function saveEdit() {
    if (!editTarget) return;
    if (!editForm.name.trim() || !/^1\d{10}$/.test(editForm.phone)) return setError("请输入正确的姓名和11位手机号");
    setEditBusy(true); setError("");
    try {
      // storeCode 为空 -> 传空串视为解绑；后端 patch.storeCode != null 时会处理
      // 想保留原店铺不动：传当前 storeCode；想解绑：传空串；想换绑：传新 code
      await apiRequest(`/biz/purchaser/${editTarget.id}`, {
        method: "PUT",
        body: {
          name: editForm.name.trim(),
          phone: editForm.phone,
          storeCode: editForm.storeCode,
          remark: editForm.remark,
        },
      });
      setEditTarget(null);
      setEditForm(EMPTY_EDIT);
      setNotice("买家信息已更新"); await load(); window.setTimeout(() => setNotice(""), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setEditBusy(false); }
  }

  // 删除确认弹窗（自定义 modal，跟其他弹窗统一风格，不再用 window.confirm）
  const [confirmingDelete, setConfirmingDelete] = useState<Purchaser | null>(null);
  // 解绑确认弹窗
  const [confirmingUnbind, setConfirmingUnbind] = useState<Purchaser | null>(null);

  function requestDelete(item: Purchaser) {
    setConfirmingDelete(item);
    setError("");
  }

  async function submitDelete() {
    if (!confirmingDelete) return;
    setBusyId(confirmingDelete.id); setError("");
    try {
      await apiRequest(`/biz/purchaser/${confirmingDelete.id}`, { method: "DELETE" });
      setConfirmingDelete(null);
      setNotice("买家已删除"); await load(); window.setTimeout(() => setNotice(""), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); }
    finally { setBusyId(null); }
  }

  async function toggleBlock(item: Purchaser, field: "blockOrder" | "blockQuery", next: 0 | 1) {
    if (blockBusyId === item.id) return;
    setBlockBusyId(item.id); setError("");
    try {
      // 只传变化的那一项，避免覆盖另一项
      const body = field === "blockOrder" ? { blockOrder: next } : { blockQuery: next };
      await apiRequest(`/biz/purchaser/${item.id}/block`, { method: "PUT", body });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
    finally { setBlockBusyId(null); }
  }

  async function setBlockDisplay(item: Purchaser, next: BlockDisplay) {
    if (blockBusyId === item.id) return;
    if ((item.blockDisplayType || "banner") === next) return;
    setBlockBusyId(item.id); setError("");
    try {
      await apiRequest(`/biz/purchaser/${item.id}/block`, { method: "PUT", body: { blockDisplayType: next } });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBlockBusyId(null); }
  }

  if (!authenticated && !embedded) return <div className="tool-page"><section className="tool-hero"><span><Users size={25} /></span><div><small>PURCHASER MANAGEMENT</small><h1>买家管理</h1><p>查看、绑定或解绑买家的所属店铺。</p></div></section><section className="order-link-login"><User size={28} /><h2>请先登录</h2><p>店铺绑定属于管理操作，登录后才可以查看和修改。</p><a href="/">前往管理登录</a></section></div>;

  return <div className={`${embedded ? "admin-tool-module" : "tool-page"} purchaser-manager-page`}>
    <section className="tool-hero"><span><Users size={25} /></span><div><small>PURCHASER MANAGEMENT</small><h1>买家管理</h1><p>一个买家绑定一个店铺；解绑后对应短链接立即失效。</p></div></section>
    <section className="purchaser-manager-toolbar"><div><Search size={16} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名、手机号、短ID或店铺" /></div><button type="button" title="新建下单人" onClick={() => { setCreateForm((current) => ({ ...current, storeCode: current.storeCode || stores[0]?.code || "" })); setCreateOpen(true); }}><Plus size={18} /></button><button type="button" title="刷新" onClick={load}><RefreshCw className={loading ? "spin" : ""} size={17} /></button></section>
    {error ? <p className="tool-error purchaser-manager-message">{error}</p> : null}
    {notice ? <p className="tool-success purchaser-manager-message"><CheckCircle2 size={14} />{notice}</p> : null}
    {loading ? <div className="purchaser-manager-loading"><LoaderCircle className="spin" size={24} />正在加载下单人</div> : <section className="purchaser-manager-list">{visible.map((item) => <article key={item.id}><header><span>{String(item.name || "下").slice(0, 1)}</span><div><h2>{item.name || "未命名"}</h2><p><Phone size={12} />{item.phone || "--"}<em>ID {item.shortId}</em></p></div><i className={item.storeId ? "bound" : ""}>{item.storeId ? "已绑定" : "未绑定"}</i></header><div className="purchaser-current-store"><Store size={16} /><div className="purchaser-current-store-info"><small>当前店铺</small><b>{item.storeName || "尚未绑定店铺"}</b></div><select className="purchaser-current-store-select" value={draftStore[item.id] || ""} onChange={(event) => setDraftStore((current) => ({ ...current, [item.id]: event.target.value }))} disabled={busyId === item.id}><option value="">{item.storeId ? "换绑到…" : "选择店铺"}</option>{stores.map((store) => <option value={store.code} key={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select><button type="button" className={`purchaser-current-store-bind ${item.storeId ? "rebind" : "bind"}`} disabled={busyId === item.id || !draftStore[item.id]} onClick={() => bind(item)}>{busyId === item.id ? <LoaderCircle className="spin" size={14} /> : <Link2 size={14} />}{item.storeId ? "换绑" : "绑定"}</button>{item.storeId ? <><button className="copy-link" type="button" onClick={() => copyOrderLink(item)}><Copy size={14} />复制链接</button><button type="button" disabled={busyId === item.id} onClick={() => requestUnbind(item)}><Unlink size={14} />解绑</button></> : null}</div><div className="purchaser-order-code-row"><KeyRound size={15} /><div className="purchaser-order-code-info"><small>下单码</small><b>{item.requirePwd === 1 ? "需密码" : item.requirePwd === 0 ? "免密码" : "跟店铺"}</b>{item.orderCodePwd ? <em>码 {item.orderCodePwd}</em> : null}{item.orderCodePwdExpire ? <em>至 {String(item.orderCodePwdExpire).slice(0, 10)}</em> : null}</div><button type="button" className="purchaser-order-code-btn" onClick={() => openCodeConfig(item)}>配置</button></div>
      <div className="purchaser-block-group">
        <div className="purchaser-block-group-head"><Ban size={14} /><span>访问控制</span><em>每个买家独立配置</em></div>
        <div className="purchaser-block-row">
          <Ban size={15} />
          <div className="purchaser-block-info"><small>禁止下单</small><b>{item.blockOrder === 1 ? "已拦截下单" : "未拦截"}</b></div>
          <div className="purchaser-block-toggle">
            {blockBusyId === item.id ? <LoaderCircle className="spin" size={15} /> : <button type="button" className={`toggle ${item.blockOrder === 1 ? "on" : "off"}`} aria-label="切换禁止下单" onClick={() => toggleBlock(item, "blockOrder", item.blockOrder === 1 ? 0 : 1)}><span /></button>}
          </div>
        </div>
        <div className="purchaser-block-row">
          <Ban size={15} />
          <div className="purchaser-block-info"><small>禁止查询订单</small><b>{item.blockQuery === 1 ? "已拦截查单" : "未拦截"}</b></div>
          <div className="purchaser-block-toggle">
            {blockBusyId === item.id ? <LoaderCircle className="spin" size={15} /> : <button type="button" className={`toggle ${item.blockQuery === 1 ? "on" : "off"}`} aria-label="切换禁止查询订单" onClick={() => toggleBlock(item, "blockQuery", item.blockQuery === 1 ? 0 : 1)}><span /></button>}
          </div>
        </div>
        <div className="purchaser-block-display-row">
          <Monitor size={15} />
          <div className="purchaser-block-display-info">
            <small>拦截展示形式</small>
            <b>{BLOCK_DISPLAY_OPTIONS.find((opt) => opt.value === (item.blockDisplayType || "banner"))?.label || "顶部 banner"}</b>
          </div>
          <select
            className="purchaser-block-display-select"
            value={item.blockDisplayType || "banner"}
            disabled={blockBusyId === item.id}
            onChange={(event) => { void setBlockDisplay(item, event.target.value as BlockDisplay); }}
          >
            {BLOCK_DISPLAY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>
      <div className="card-actions"><button type="button" onClick={() => openEdit(item)}><Pencil size={16} />修改</button><button type="button" className="danger-text" disabled={busyId === item.id} onClick={() => requestDelete(item)}><Trash2 size={16} />删除</button></div></article>)}</section>}
    {!loading && !visible.length ? <div className="tool-list-empty">没有符合条件的下单人</div> : null}
    {createOpen ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}><section className="purchaser-create-modal"><button type="button" onClick={() => setCreateOpen(false)}><X size={18} /></button><span><UserPlus size={22} /></span><small>NEW PURCHASER</small><h2>新建下单人</h2><p>创建时必须绑定店铺，生成链接时无需再携带店铺编码。</p><label><em>下单人姓名</em><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="请输入姓名" /></label><label><em>手机号</em><input inputMode="tel" maxLength={11} value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} placeholder="请输入11位手机号" /></label><label><em>绑定店铺</em><select value={createForm.storeCode} onChange={(event) => setCreateForm((current) => ({ ...current, storeCode: event.target.value }))}><option value="">请选择店铺</option>{stores.map((store) => <option value={store.code} key={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select></label><button className="purchaser-create-submit" type="button" disabled={busyId === -1} onClick={createPurchaser}>{busyId === -1 ? <LoaderCircle className="spin" size={17} /> : <UserPlus size={17} />}创建并绑定店铺</button></section></div> : null}
    {editTarget ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !editBusy && closeEdit()}><section className="purchaser-create-modal">
      <button type="button" disabled={editBusy} onClick={closeEdit}><X size={18} /></button>
      <span><Pencil size={22} /></span>
      <small>EDIT PURCHASER</small>
      <h2>编辑买家 · {editTarget.name}</h2>
      <p>修改姓名、手机号、绑定店铺或备注。下方"换绑"按钮同样可以改店铺。</p>
      <label><em>下单人姓名</em><input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} placeholder="请输入姓名" /></label>
      <label><em>手机号</em><input inputMode="tel" maxLength={11} value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} placeholder="请输入11位手机号" /></label>
      <label><em>绑定店铺（不选 = 解绑）</em>
        <select value={editForm.storeCode} onChange={(event) => setEditForm((current) => ({ ...current, storeCode: event.target.value }))}>
          <option value="">不绑定（解绑）</option>
          {stores.map((store) => <option value={store.code} key={store.code}>{store.name || store.text || store.value || store.code}</option>)}
        </select>
      </label>
      <label><em>备注（选填）</em><textarea rows={2} value={editForm.remark} onChange={(event) => setEditForm((current) => ({ ...current, remark: event.target.value }))} placeholder="如：VIP、老客户等" /></label>
      {error ? <p className="tool-error">{error}</p> : null}
      <button className="purchaser-create-submit" type="button" disabled={editBusy} onClick={saveEdit}>{editBusy ? <LoaderCircle className="spin" size={17} /> : <Pencil size={17} />}保存修改</button>
    </section></div> : null}
    {confirmingDelete ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && busyId !== confirmingDelete.id && setConfirmingDelete(null)}><section className="purchaser-create-modal purchaser-confirm-modal">
      <button type="button" disabled={busyId === confirmingDelete.id} onClick={() => setConfirmingDelete(null)}><X size={18} /></button>
      <span className="danger"><Trash2 size={22} /></span>
      <small>CONFIRM DELETE</small>
      <h2>确认删除买家？</h2>
      <p>买家「<b>{confirmingDelete.name || "未命名"}」</b>删除后将不再显示；有关联订单时会拒绝删除并提示原因。</p>
      {error ? <p className="tool-error">{error}</p> : null}
      <div className="purchaser-create-actions">
        <button type="button" className="purchaser-create-action secondary" disabled={busyId === confirmingDelete.id} onClick={() => setConfirmingDelete(null)}>再检查一下</button>
        <button type="button" className="purchaser-create-action danger" disabled={busyId === confirmingDelete.id} onClick={submitDelete}>{busyId === confirmingDelete.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}确认删除</button>
      </div>
    </section></div> : null}
    {confirmingUnbind ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && busyId !== confirmingUnbind.id && setConfirmingUnbind(null)}><section className="purchaser-create-modal purchaser-confirm-modal">
      <button type="button" disabled={busyId === confirmingUnbind.id} onClick={() => setConfirmingUnbind(null)}><X size={18} /></button>
      <span className="warn"><Unlink size={22} /></span>
      <small>CONFIRM UNBIND</small>
      <h2>确认解除绑定？</h2>
      <p>买家「<b>{confirmingUnbind.name || "未命名"}」</b>与店铺「<b>{confirmingUnbind.storeName || "当前店铺"}」</b>解除绑定后，原专属链接将暂时失效，无法继续下单。</p>
      {error ? <p className="tool-error">{error}</p> : null}
      <div className="purchaser-create-actions">
        <button type="button" className="purchaser-create-action secondary" disabled={busyId === confirmingUnbind.id} onClick={() => setConfirmingUnbind(null)}>再考虑一下</button>
        <button type="button" className="purchaser-create-action danger" disabled={busyId === confirmingUnbind.id} onClick={() => unbind(confirmingUnbind)}>{busyId === confirmingUnbind.id ? <LoaderCircle className="spin" size={15} /> : <Unlink size={15} />}确认解绑</button>
      </div>
    </section></div> : null}
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
