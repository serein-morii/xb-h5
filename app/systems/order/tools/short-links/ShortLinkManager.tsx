
import { AlertTriangle, Calendar, CheckCircle2, Clock, Copy, ExternalLink, Eye, History, Link2, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createShortLink,
  deleteShortLink,
  listShortLinkVisits,
  listShortLinks,
  LOCAL_ROUTES,
  SHORT_LINK_PATH_RULE,
  ShortLinkRow,
  ShortLinkType,
  ShortLinkVisitRow,
  updateShortLink,
} from "../../api";
import { copyToClipboard } from "../../../../lib/api";
import { APP_ROUTES } from "../../../../lib/pathConventions";
import { useAccess } from "../../admin/access";

type EditForm = { path: string; targetType: ShortLinkType; target: string; remark: string; expireTime: string };
const EMPTY_FORM: EditForm = { path: "", targetType: "internal", target: "", remark: "", expireTime: "" };

/** 把后端返回的 "yyyy-MM-dd HH:mm:ss" / ISO 串转成 datetime-local 用的 "yyyy-MM-ddTHH:mm"，空值返 "" */
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const s = String(value).replace(" ", "T").replace(/Z$/, "");
  return s.slice(0, 16);
}
/** datetime-local ("yyyy-MM-ddTHH:mm") 转成后端要的 "yyyy-MM-dd HH:mm:ss"；空值返 undefined */
function fromLocalInput(value: string) {
  if (!value) return undefined;
  return `${value.replace("T", " ")}:00`;
}

/** 计算到指定时间还有多少天/小时/已过期；用于卡片 badge */
function expireStatus(expireTime: string | null | undefined): { state: "none" | "expired" | "soon" | "active"; text: string } {
  if (!expireTime) return { state: "none", text: "永不过期" };
  const ts = new Date(expireTime.replace(/-/g, "/")).getTime();
  if (Number.isNaN(ts)) return { state: "none", text: "永不过期" };
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return { state: "expired", text: "已过期" };
  const days = Math.floor(diffMs / 86400000);
  if (days < 3) {
    const hours = Math.max(0, Math.floor(diffMs / 3600000));
    return { state: "soon", text: `还剩 ${hours} 小时` };
  }
  return { state: "active", text: `还剩 ${days} 天` };
}

// 内部目标下拉选项：与后端 LOCAL_ROUTES + 动态路由保持一致
const INTERNAL_TARGET_PRESETS: { value: string; label: string; hint?: string }[] = [
  { value: APP_ROUTES.orderQuery, label: APP_ROUTES.orderQuery, hint: "公开订单查询（短码 + 验证码）" },
  { value: APP_ROUTES.tools, label: APP_ROUTES.tools, hint: "免登录工具箱首页" },
  { value: APP_ROUTES.toolOrderSearch, label: APP_ROUTES.toolOrderSearch, hint: "订单查询（手机号 + 验证码）" },
  { value: APP_ROUTES.toolFreightCalculator, label: APP_ROUTES.toolFreightCalculator, hint: "运费计算" },
  { value: APP_ROUTES.toolFreightCompare, label: APP_ROUTES.toolFreightCompare, hint: "运费对比" },
];

function origin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function buildShortLinkUrl(path: string) {
  const trimmed = path.replace(/^\/+/, "");
  return `${origin()}/${trimmed}`;
}

function validateForm(form: EditForm, isEdit: boolean): string {
  if (!isEdit) {
    const p = form.path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (!p) return "请填写短链 path";
    if (p.length < 2 || p.length > 64) return "path 长度需在 2-64 字符之间";
    if (!SHORT_LINK_PATH_RULE.test(p)) return "path 仅支持字母、数字、-、_，且必须以字母或数字开头";
    // 与本地路由冲突：完整匹配 + 子路径前缀匹配
    const target = "/" + p;
    if (LOCAL_ROUTES.some((route) => route === target || target.startsWith(route + "/") || (route !== "/" && target === route))) {
      return `path「${p}」与本地路由 ${target} 冲突，请换一个`;
    }
    if (p === "prod-api" || p.startsWith("prod-api/") || p === "assets" || p.startsWith("assets/")) {
      return `path「${p}」是保留路径，不能作为短链`;
    }
  }
  if (form.targetType === "internal") {
    if (!form.target.trim()) return "请选择或填写内部目标路径";
    if (!form.target.trim().startsWith("/")) return "内部目标必须以 / 开头";
  } else {
    if (!form.target.trim()) return "请填写外部目标 URL";
    if (!/^https?:\/\//i.test(form.target.trim())) return "外部目标必须以 http:// 或 https:// 开头";
  }
  if (form.remark && form.remark.length > 255) return "备注最多 255 字符";
  if (form.expireTime) {
    const ts = new Date(form.expireTime.replace(/-/g, "/")).getTime();
    if (Number.isNaN(ts)) return "过期时间格式不合法";
    if (ts <= Date.now()) return "过期时间必须晚于当前时间";
  }
  return "";
}

export default function ShortLinkManager({ embedded = false }: { embedded?: boolean }) {
  const access = useAccess();
  const [rows, setRows] = useState<ShortLinkRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<{ id: number; form: EditForm } | null>(null);
  const [creating, setCreating] = useState<EditForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<ShortLinkRow | null>(null);
  const [visitingLink, setVisitingLink] = useState<ShortLinkRow | null>(null);

  function openVisits(row: ShortLinkRow) {
    setVisitingLink(row);
  }

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await listShortLinks();
      const data = (r as { data?: ShortLinkRow[] }).data ?? (r as ShortLinkRow[]);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "短链列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) => [r.path, r.target, r.remark, r.createBy].some((v) => String(v || "").toLowerCase().includes(k)));
  }, [keyword, rows]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  }

  function startCreate() {
    setCreating(EMPTY_FORM);
    setError("");
  }
  function startEdit(row: ShortLinkRow) {
    setEditing({ id: row.id, form: { path: row.path, targetType: row.targetType, target: row.target, remark: row.remark || "", expireTime: toLocalInput(row.expireTime) } });
    setError("");
  }
  function closeForm() {
    setCreating(null);
    setEditing(null);
    setError("");
  }

  async function submitForm() {
    const isEdit = editing !== null;
    const form = isEdit ? editing!.form : creating!;
    const err = validateForm(form, isEdit);
    if (err) return setError(err);
    setBusy(true); setError("");
    try {
      // 过期时间：空串 → 不传（永不过期）；有值 → "yyyy-MM-dd HH:mm:ss"
      const expirePayload = form.expireTime ? fromLocalInput(form.expireTime) : null;
      if (isEdit) {
        await updateShortLink(editing!.id, { targetType: form.targetType, target: form.target.trim(), remark: form.remark.trim() || undefined, expireTime: expirePayload });
        flash("短链已更新");
      } else {
        await createShortLink({ path: form.path.trim().replace(/^\/+/, ""), targetType: form.targetType, target: form.target.trim(), remark: form.remark.trim() || undefined, expireTime: expirePayload });
        flash("短链已创建");
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete() {
    if (!confirmingDelete) return;
    setBusy(true); setError("");
    try {
      await deleteShortLink(confirmingDelete.id);
      setConfirmingDelete(null);
      flash("短链已删除");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(row: ShortLinkRow) {
    const ok = await copyToClipboard(buildShortLinkUrl(row.path));
    flash(ok ? `已复制 /${row.path} 的短链` : "复制失败，请手动选择");
  }

  return (
    <div className={`${embedded ? "admin-tool-module" : "tool-page"} short-link-manager-page`}>
      <section className="tool-hero">
        <span><Link2 size={25} /></span>
        <div>
          <small>SHORT LINKS</small>
          <h1>短链管理</h1>
          <p>自定义 <code>domain.com/&#123;path&#125;</code> 跳转到免登录工具页（特别是订单查询），或转发到任意外部网址。</p>
        </div>
      </section>

      <section className="purchaser-manager-toolbar">
        <div><Search size={16} /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="按 path / 目标 / 备注 / 创建人筛选" /></div>
        {access.has("shortLinks.create") ? <button type="button" title="新建短链" onClick={startCreate}><Plus size={18} /></button> : null}
        <button type="button" title="刷新" onClick={load}><RefreshCw className={loading ? "spin" : ""} size={17} /></button>
      </section>

      {error ? <p className="tool-error purchaser-manager-message">{error}</p> : null}
      {notice ? <p className="tool-success purchaser-manager-message"><CheckCircle2 size={14} />{notice}</p> : null}

      {loading ? (
        <div className="purchaser-manager-loading"><LoaderCircle className="spin" size={24} />正在加载短链</div>
      ) : visible.length === 0 ? (
        <section className="short-link-empty"><Link2 size={32} /><h2>还没有短链</h2><p>点右上角「+」创建第一条短链。path 一旦保存不能改，请谨慎命名。</p></section>
      ) : (
        <section className="purchaser-manager-list">
          {visible.map((row) => {
            const ex = expireStatus(row.expireTime);
            return (
            <article key={row.id} className="short-link-card">
              <header>
                <span className="short-link-card-path">
                  <Link2 size={15} />
                  <b>/{row.path}</b>
                </span>
                <i className={`short-link-card-type is-${row.targetType}`}>{row.targetType === "internal" ? "站内" : "外部"}</i>
              </header>
              <div className="short-link-card-target">
                {row.targetType === "external" ? <ExternalLink size={13} /> : <Link2 size={13} />}
                <span className="short-link-card-target-value">{row.target}</span>
              </div>
              {row.remark ? <p className="short-link-card-remark">{row.remark}</p> : null}
              <div className="short-link-card-meta">
                <span className="short-link-card-meta-item" title="累计访问次数"><Eye size={13} />访问 <b>{row.visitCount ?? 0}</b></span>
                <span className="short-link-card-meta-item" title="最近访问时间">
                  <Clock size={13} />{row.lastVisitTime ? String(row.lastVisitTime).slice(0, 16).replace("T", " ") : "尚无访问"}
                </span>
                <span className={`short-link-card-meta-item is-expire-${ex.state}`} title="过期时间">
                  {ex.state === "expired" ? <AlertTriangle size={13} /> : <Calendar size={13} />}
                  {ex.state === "none" ? "永不过期" : `${row.expireTime!.slice(0, 16).replace("T", " ")} · ${ex.text}`}
                </span>
              </div>
              <footer>
                <small>创建人 {row.createBy}{row.createTime ? ` · ${String(row.createTime).slice(0, 16).replace("T", " ")}` : ""}</small>
                <div className="short-link-card-actions">
                  <button type="button" onClick={() => copyLink(row)}><Copy size={13} />复制短链</button>
                  <button type="button" onClick={() => openVisits(row)}><History size={13} />访问记录</button>
                  {access.has("shortLinks.edit") ? <button type="button" onClick={() => startEdit(row)}><Pencil size={13} />编辑</button> : null}
                  {access.has("shortLinks.delete") ? <button type="button" className="danger-text" onClick={() => { setConfirmingDelete(row); setError(""); }}><Trash2 size={13} />删除</button> : null}
                </div>
              </footer>
            </article>
            );
          })}
        </section>
      )}

      {((creating && access.has("shortLinks.create")) || (editing && access.has("shortLinks.edit"))) ? <ShortLinkForm
        title={editing ? "编辑短链" : "新建短链"}
        form={editing ? editing.form : creating!}
        isEdit={!!editing}
        busy={busy}
        error={error}
        onChange={(patch) => {
          if (editing) setEditing({ ...editing, form: { ...editing.form, ...patch } });
          else setCreating((cur) => cur ? { ...cur, ...patch } : cur);
        }}
        onSubmit={submitForm}
        onClose={closeForm}
      /> : null}

      {confirmingDelete && access.has("shortLinks.delete") ? <div className="batch-order-confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setConfirmingDelete(null)}>
        <section className="batch-order-confirm-modal" role="alertdialog" aria-modal="true">
          <div className="batch-order-confirm-icon" style={{ color: "#c44a1f" }}><Trash2 size={26} /></div>
          <h2>确认删除短链</h2>
          <p>即将删除 <b>/{confirmingDelete.path}</b>，之后通过该链接访问的人会看到 404。</p>
          <div className="batch-order-confirm-actions">
            <button type="button" className="batch-order-confirm-cancel" onClick={() => setConfirmingDelete(null)}>取消</button>
            <button type="button" className="batch-order-confirm-ok" onClick={submitDelete} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14} /> : null}确认删除</button>
          </div>
        </section>
      </div> : null}

      {visitingLink ? <VisitsModal link={visitingLink} onClose={() => setVisitingLink(null)} /> : null}
    </div>
  );
}

function ShortLinkForm(props: {
  title: string;
  form: EditForm;
  isEdit: boolean;
  busy: boolean;
  error: string;
  onChange: (patch: Partial<EditForm>) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { form, isEdit, busy } = props;
  const internalError = useMemo(() => {
    if (!form.targetType) return "";
    if (form.targetType === "internal") {
      if (!form.target.trim()) return "";
      if (!form.target.trim().startsWith("/")) return "内部目标必须以 / 开头";
    } else {
      if (!form.target.trim()) return "";
      if (!/^https?:\/\//i.test(form.target.trim())) return "外部目标必须以 http:// 或 https:// 开头";
    }
    return "";
  }, [form.targetType, form.target]);

  const pathPreview = useMemo(() => {
    if (isEdit) return null;
    const p = form.path.trim().replace(/^\/+/, "");
    if (!p) return null;
    return buildShortLinkUrl(p);
  }, [form.path, isEdit]);

  return (
    <div className="batch-order-detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section className="batch-order-detail-modal short-link-form-modal" role="dialog" aria-modal="true">
        <button className="batch-order-detail-close" type="button" onClick={props.onClose} aria-label="关闭"><X size={18} /></button>
        <header>
          <small>{isEdit ? "EDIT SHORT LINK" : "NEW SHORT LINK"}</small>
          <h2>{props.title}</h2>
          <p>短链格式：<code>domain.com/&#123;path&#125;</code></p>
        </header>

        <div className="mobile-form">
          <label>
            <span>短链 path{isEdit ? "（不可改）" : " *"}</span>
            <div className="input-shell">
              <Link2 size={16} />
              <input
                value={form.path}
                disabled={isEdit}
                onChange={(e) => props.onChange({ path: e.target.value })}
                placeholder={isEdit ? "" : "例如：cxdd / promo-summer / 818-event"}
              />
            </div>
            {!isEdit && pathPreview ? <small className="short-link-form-preview">预览：<code>{pathPreview}</code></small> : null}
            {!isEdit ? <small className="short-link-form-hint">2-64 字符；字母 / 数字 / - / _；不能与本地路由冲突</small> : null}
          </label>

          <label>
            <span>目标类型 *</span>
            <div className="short-link-type-toggle">
              <button type="button" className={form.targetType === "internal" ? "active" : ""} onClick={() => props.onChange({ targetType: "internal", target: "" })}>站内</button>
              <button type="button" className={form.targetType === "external" ? "active" : ""} onClick={() => props.onChange({ targetType: "external", target: "" })}>外部 URL</button>
            </div>
          </label>

          <label>
            <span>{form.targetType === "internal" ? "内部目标路径" : "外部 URL"} *</span>
            {form.targetType === "internal" ? (
              <>
                <div className="input-shell">
                  <Link2 size={16} />
                  <input
                    value={form.target}
                    onChange={(e) => props.onChange({ target: e.target.value })}
                    placeholder="/tools/order-search"
                  />
                </div>
                <div className="short-link-presets">
                  {INTERNAL_TARGET_PRESETS.map((p) => (
                    <button type="button" key={p.value} className={form.target === p.value ? "active" : ""} onClick={() => props.onChange({ target: p.value })} title={p.hint}>{p.label}</button>
                  ))}
                </div>
              </>
            ) : (
              <div className="input-shell">
                <ExternalLink size={16} />
                <input
                  value={form.target}
                  onChange={(e) => props.onChange({ target: e.target.value })}
                  placeholder="https://example.com/promo"
                />
              </div>
            )}
            {internalError ? <small className="short-link-form-error">{internalError}</small> : null}
          </label>

          <label>
            <span>过期时间（选填，留空 = 永不过期）</span>
            <div className="input-shell">
              <Calendar size={16} />
              <input
                type="datetime-local"
                value={form.expireTime}
                onChange={(e) => props.onChange({ expireTime: e.target.value })}
              />
              {form.expireTime ? <button type="button" className="short-link-form-clear" onClick={() => props.onChange({ expireTime: "" })} aria-label="清除过期时间">×</button> : null}
            </div>
            <small className="short-link-form-hint">到点之后通过该短链访问的人会看到 404；清除会恢复为「永不过期」</small>
          </label>

          <label>
            <span>备注（选填）</span>
            <div className="input-shell">
              <input
                value={form.remark}
                onChange={(e) => props.onChange({ remark: e.target.value })}
                placeholder="例如：双11 活动落地页 / 临时公告链接"
                maxLength={255}
              />
            </div>
          </label>

          {props.error ? <p className="tool-error">{props.error}</p> : null}

          <div className="form-actions">
            <button type="button" className="button button-ghost" onClick={props.onClose}>取消</button>
            <button type="button" className="button button-primary" onClick={props.onSubmit} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
              {isEdit ? "保存" : "创建"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function VisitsModal({ link, onClose }: { link: ShortLinkRow; onClose: () => void }) {
  const [visits, setVisits] = useState<ShortLinkVisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    listShortLinkVisits(link.id, 50)
      .then((r) => {
        if (cancelled) return;
        const data = (r as { data?: ShortLinkVisitRow[] }).data ?? (r as ShortLinkVisitRow[]);
        setVisits(Array.isArray(data) ? data : []);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "访问记录加载失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [link.id]);

  return (
    <div className="batch-order-detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="batch-order-detail-modal short-link-visits-modal" role="dialog" aria-modal="true">
        <button className="batch-order-detail-close" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        <header>
          <small>VISIT LOG</small>
          <h2>访问记录 · /{link.path}</h2>
          <p>累计访问 <b>{link.visitCount ?? 0}</b> 次 · 最近访问 {link.lastVisitTime ? String(link.lastVisitTime).slice(0, 16).replace("T", " ") : "—"}</p>
        </header>
        {error ? <p className="tool-error">{error}</p> : null}
        {loading ? (
          <div className="purchaser-manager-loading"><LoaderCircle className="spin" size={20} />加载访问记录…</div>
        ) : visits.length === 0 ? (
          <section className="short-link-empty"><History size={28} /><h2>还没有访问记录</h2><p>把短链发出去，对方打开后这里会按时间倒序列出最近 50 次访问。</p></section>
        ) : (
          <ul className="short-link-visits-list">
            {visits.map((v) => (
              <li key={v.id}>
                <span className="short-link-visits-time">{v.visitTime ? String(v.visitTime).slice(0, 19).replace("T", " ") : "—"}</span>
                <span className="short-link-visits-ip">{v.visitIp || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
