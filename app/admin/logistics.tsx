import {
  Gauge,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminUpdateLogisticsGlobalQuota,
  adminUpdateLogisticsQuota,
  getLogisticsGlobalQuota,
  listAllLogisticsQuota,
  listLogisticsUsage,
  listMyLogisticsQuota,
  type LogisticsGlobalQuotaStatus,
  type LogisticsQuotaStatus,
  type LogisticsSwitchType,
  type LogisticsUsageRow,
  updateMyLogisticsSwitch,
} from "../lib/api";
import type { DataRow } from "./core";
import { shortDate } from "./core";
import { EmptyState } from "./ui";

export function StatusBadge({ row }: { row: DataRow }) {
  const text = String(row.orderStatusDesc || row.expStatusDesc || row.statusDesc || row.orderStatus || "未知");
  const value = `${row.orderStatus || row.expStatus || ""} ${text}`;
  const tone = /YWC|完成|送达/.test(value) ? "success" : /YFH|YSJ|YSZ|发货|运输|收寄/.test(value) ? "info" : /DTF|DFH|待发/.test(value) ? "warning" : "neutral";
  return <span className={`status status-${tone}`}><span />{text}</span>;
}

/**
 * 物流用量页（per-store）：
 * - 非 admin：列出可见店铺的额度卡（额度 + 3 类分开关 + 今日用量 + 用量记录）
 * - admin：列出所有店铺，可编辑总额度 / 总开关 / 备注
 */
export function LogisticsPage({ userInfo, notify }: { userInfo: DataRow | null; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const isAdmin = Number(userInfo?.userId) === 1;
  // 「全局额度」模块只对 admin / pengchenghui 这两个账户开放；
  // 其他个人维度账户直接隐藏整个模块（连数据都不拉）。
  const canViewGlobalQuota = useMemo(() => {
    const u = String(userInfo?.userName || "");
    return u === "admin" || u === "pengchenghui";
  }, [userInfo?.userName]);
  const [stores, setStores] = useState<LogisticsQuotaStatus[]>([]);
  const [global, setGlobal] = useState<LogisticsGlobalQuotaStatus | null>(null);
  const [usage, setUsage] = useState<{ rows: LogisticsUsageRow[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTotal, setEditTotal] = useState<string>("");
  const [editEnabled, setEditEnabled] = useState<number>(1);
  const [editRemark, setEditRemark] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [filterStore, setFilterStore] = useState<string>("");
  const [globalEditing, setGlobalEditing] = useState(false);
  const [globalTotal, setGlobalTotal] = useState<string>("");
  const [globalEnabled, setGlobalEnabled] = useState<number>(1);
  const [globalRemark, setGlobalRemark] = useState<string>("");
  const [globalSaving, setGlobalSaving] = useState(false);
  const pageSize = 20;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Array<Promise<unknown>> = [
        (isAdmin ? listAllLogisticsQuota() : listMyLogisticsQuota()).then((d: any) => setStores((d.data ?? d) as LogisticsQuotaStatus[])),
        ...(canViewGlobalQuota
          ? [getLogisticsGlobalQuota().then((d: any) => setGlobal((d.data ?? d) as LogisticsGlobalQuotaStatus))]
          : [Promise.resolve().then(() => setGlobal(null))]),
        listLogisticsUsage({ pageNum, pageSize, storeCode: filterStore || undefined }).then((d: any) => setUsage({ rows: d.rows || [], total: d.total || 0 })),
      ];
      await Promise.all(tasks);
    } catch (err) {
      notify(err instanceof Error ? err.message : "物流用量加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, canViewGlobalQuota, pageNum, filterStore, notify]);

  useEffect(() => { reload(); }, [reload]);

  async function toggleSwitch(storeCode: string, type: LogisticsSwitchType, currentEnabled: number) {
    const next = currentEnabled === 1 ? 0 : 1;
    try {
      await updateMyLogisticsSwitch(storeCode, type, next === 1);
      notify(next === 1 ? "已开启" : "已关闭", "success");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "更新失败", "error");
    }
  }

  function openEdit(row: LogisticsQuotaStatus) {
    setEditing(row.storeCode);
    setEditTotal(String(row.totalQuota ?? 0));
    setEditEnabled(row.enabled ?? 0);
    setEditRemark(row.remark ?? "");
  }
  async function saveEdit() {
    if (!editing) return;
    const total = Number(editTotal);
    if (!Number.isFinite(total) || total < 0) {
      notify("总额度必须为非负整数", "error");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateLogisticsQuota({
        storeCode: editing,
        totalQuota: total,
        enabled: (editEnabled === 1 ? 1 : 0) as 0 | 1,
        remark: editRemark.trim() || undefined,
      });
      notify("已保存", "success");
      setEditing(null);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  function openGlobalEdit() {
    if (!global) return;
    setGlobalTotal(String(global.totalQuota ?? 0));
    setGlobalEnabled(global.enabled ?? 0);
    setGlobalRemark(global.remark ?? "");
    setGlobalEditing(true);
  }
  async function saveGlobalEdit() {
    const total = Number(globalTotal);
    if (!Number.isFinite(total) || total < 0) {
      notify("全局总额度必须为非负整数", "error");
      return;
    }
    setGlobalSaving(true);
    try {
      await adminUpdateLogisticsGlobalQuota({
        totalQuota: total,
        enabled: (globalEnabled === 1 ? 1 : 0) as 0 | 1,
        remark: globalRemark.trim() || undefined,
      });
      notify("全局额度已保存", "success");
      setGlobalEditing(false);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setGlobalSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(usage.total / pageSize));
  const globalTotal2 = global?.totalQuota ?? 0;
  const globalUsed2 = global?.usedQuota ?? 0;
  const globalRemaining2 = Math.max(0, globalTotal2 - globalUsed2);
  const globalPercent = globalTotal2 > 0 ? Math.min(100, Math.round((globalUsed2 / globalTotal2) * 100)) : 0;
  const globalIsOn = global?.enabled === 1;

  return (
    <div className="module-page logistics-page">
      <div className="module-hero compact-hero">
        <div><small>LOGISTICS USAGE</small><h1>物流用量</h1><p>按店铺维度管理 alicloud 物流接口调用额度和分类型开关</p></div>
        <span className="hero-tool-icon"><Gauge size={27} /></span>
      </div>

      {canViewGlobalQuota && global ? (
        <section className="card logistics-store-card logistics-global-card">
          <header className="quota-header">
            <div>
              <h3>全局额度</h3>
              <p className="card-sub">
                所有店铺共享{isAdmin ? " · 单店额度不得超过此值" : ""}
                {global.remark ? ` · ${global.remark}` : ""}
              </p>
            </div>
            <span className="quota-badge">
              <b>{globalRemaining2}</b>
              <small>/ {globalTotal2} 剩余</small>
            </span>
          </header>
          <div className="quota-bar">
            <span style={{ width: `${globalPercent}%` }} />
          </div>
          <p className="quota-stats">
            已用 {globalUsed2}
            {isAdmin ? ` · 可分配余额 ${global.distributable ?? globalRemaining2}` : ""}
          </p>
          <div className="quota-switches">
            <label className="quota-switch">
              <div>
                <b>全局总开关</b>
                <small>关闭后所有店铺都不能调用物流刷新</small>
              </div>
              {isAdmin ? (
                <div className="quota-switch-control">
                  <span className={`toggle-status ${globalIsOn ? "on" : "off"}`}>{globalIsOn ? "已开启" : "已关闭"}</span>
                  <button
                    type="button"
                    className={`toggle ${globalIsOn ? "on" : "off"}`}
                    onClick={async () => {
                      setGlobalSaving(true);
                      try {
                        await adminUpdateLogisticsGlobalQuota({ enabled: globalIsOn ? 0 : 1 });
                        notify(globalIsOn ? "已关闭" : "已开启", "success");
                        reload();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : "更新失败", "error");
                      } finally {
                        setGlobalSaving(false);
                      }
                    }}
                    aria-pressed={globalIsOn}
                    disabled={globalSaving}
                  >
                    <span />
                  </button>
                </div>
              ) : (
                <span className={`toggle-status ${globalIsOn ? "on" : "off"}`}>{globalIsOn ? "已开启" : "已关闭"}</span>
              )}
            </label>
          </div>
          {isAdmin ? (
            <div className="logistics-store-actions">
              <button className="button button-soft button-small" type="button" onClick={openGlobalEdit}>
                <Pencil size={14} />编辑全局
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {loading && stores.length === 0 ? (
        <div className="page-loading"><LoaderCircle className="spin" size={22} /> 加载中…</div>
      ) : null}

      <div className="list-heading">
        <div>
          <h2>店铺额度</h2>
          <span>共 {stores.length} 个{isAdmin ? "店铺" : "可见店铺"}</span>
        </div>
      </div>

      <div className="logistics-store-list">
        {stores.map((row) => (
          <StoreQuotaCard
            key={row.storeCode}
            row={row}
            isAdmin={isAdmin}
            onToggle={(type, current) => toggleSwitch(row.storeCode, type, current)}
            onEdit={() => openEdit(row)}
          />
        ))}
        {stores.length === 0 && !loading ? (
          <EmptyState loading={false} label="店铺额度" />
        ) : null}
      </div>

      <section className="card logistics-usage-card">
        <div className="list-heading">
          <div>
            <h2>用量记录</h2>
            <span>共 {usage.total} 条 · 每次 alicloud HTTP 200 成功调用记一条</span>
          </div>
          <div className="logistics-usage-filter">
            <select value={filterStore} onChange={(e) => { setFilterStore(e.target.value); setPageNum(1); }}>
              <option value="">全部店铺</option>
              {stores.map((s) => (
                <option key={s.storeCode} value={s.storeCode}>{s.storeName || s.storeCode}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>店铺</th>
                <th>用户</th>
                <th>类型</th>
                <th>来源</th>
                <th>订单号</th>
                <th>扣费</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {usage.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.createTime ? shortDate(row.createTime, true) : "--"}</td>
                  <td>{row.storeName || row.storeCode || "--"}</td>
                  <td>{row.userId === -1 ? "系统" : row.nickName || row.userName || `#${row.userId}`}</td>
                  <td>{switchLabel(row.switchType)}</td>
                  <td>{sourceLabel(row.source)}</td>
                  <td className="td-code">{row.orderCode || "--"}</td>
                  <td>{row.cost}</td>
                  <td>
                    <span className={`status status-${row.success === 1 ? "success" : "warning"}`}><span />{row.success === 1 ? "成功" : "未成功"}</span>
                  </td>
                </tr>
              ))}
              {usage.rows.length === 0 ? (
                <tr><td colSpan={8} className="td-empty">暂无用量记录</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="pager">
            <button className="button button-ghost button-small" type="button" disabled={pageNum <= 1} onClick={() => setPageNum((n) => n - 1)}>上一页</button>
            <span>{pageNum} / {totalPages}</span>
            <button className="button button-ghost button-small" type="button" disabled={pageNum >= totalPages} onClick={() => setPageNum((n) => n + 1)}>下一页</button>
          </div>
        ) : null}
      </section>

      {/* admin 编辑弹窗 */}
      {editing != null ? (
        <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setEditing(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="编辑店铺额度">
            <header className="sheet-header">
              <h2>编辑店铺额度</h2>
              <button className="sheet-close" type="button" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button>
            </header>
            <form
              className="mobile-form"
              onSubmit={(event) => { event.preventDefault(); saveEdit(); }}
            >
              <label>
                <span>店铺</span>
                <div className="input-shell">
                  <input value={stores.find((s) => s.storeCode === editing)?.storeName || editing} readOnly />
                </div>
              </label>
              <label>
                <span>总额度</span>
                <div className="input-shell">
                  <input type="number" min={0} value={editTotal} onChange={(e) => setEditTotal(e.target.value)} />
                </div>
              </label>
              <label>
                <span>总开关</span>
                <select value={editEnabled} onChange={(e) => setEditEnabled(Number(e.target.value))}>
                  <option value={1}>开启</option>
                  <option value={0}>关闭</option>
                </select>
              </label>
              <label>
                <span>备注</span>
                <div className="input-shell">
                  <input value={editRemark} onChange={(e) => setEditRemark(e.target.value)} maxLength={120} placeholder="可选" />
                </div>
              </label>
              <div className="form-actions">
                <button className="button button-ghost" type="button" onClick={() => setEditing(null)} disabled={saving}>取消</button>
                <button className="button button-primary" type="submit" disabled={saving}>
                  {saving ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}保存
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* admin 编辑全局弹窗 */}
      {globalEditing ? (
        <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !globalSaving && setGlobalEditing(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="编辑全局额度">
            <header className="sheet-header">
              <h2>编辑全局额度</h2>
              <button className="sheet-close" type="button" onClick={() => setGlobalEditing(false)} aria-label="关闭"><X size={18} /></button>
            </header>
            <form
              className="mobile-form"
              onSubmit={(event) => { event.preventDefault(); saveGlobalEdit(); }}
            >
              <p className="card-sub" style={{ margin: "0 0 4px" }}>
                所有店铺的用量汇总后不能超过全局总额度；
                单店总额度调高时不能超过「全局总额度 - 其他店铺已用」。
                当前全局已用 <b>{global?.usedQuota ?? 0}</b>。
              </p>
              <label>
                <span>全局总额度</span>
                <div className="input-shell">
                  <input type="number" min={0} value={globalTotal} onChange={(e) => setGlobalTotal(e.target.value)} />
                </div>
              </label>
              <label>
                <span>全局总开关</span>
                <select value={globalEnabled} onChange={(e) => setGlobalEnabled(Number(e.target.value))}>
                  <option value={1}>开启</option>
                  <option value={0}>关闭</option>
                </select>
              </label>
              <label>
                <span>备注</span>
                <div className="input-shell">
                  <input value={globalRemark} onChange={(e) => setGlobalRemark(e.target.value)} maxLength={120} placeholder="可选" />
                </div>
              </label>
              <div className="form-actions">
                <button className="button button-ghost" type="button" onClick={() => setGlobalEditing(false)} disabled={globalSaving}>取消</button>
                <button className="button button-primary" type="submit" disabled={globalSaving}>
                  {globalSaving ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}保存
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function switchLabel(type: string) {
  if (type === "manual") return "手动";
  if (type === "scheduled") return "定时";
  if (type === "query") return "查询";
  return type || "--";
}
export function sourceLabel(source?: string) {
  if (!source) return "--";
  if (source === "user_button") return "按钮";
  if (source === "user_batch") return "批量";
  if (source === "scheduled_task") return "定时任务";
  if (source === "search_query") return "查询";
  if (source === "import") return "导入";
  return source;
}

export function StoreQuotaCard({
  row,
  isAdmin,
  onToggle,
  onEdit,
}: {
  row: LogisticsQuotaStatus;
  isAdmin: boolean;
  onToggle: (type: LogisticsSwitchType, currentEnabled: number) => void;
  onEdit: () => void;
}) {
  const remaining = row.remainingQuota ?? 0;
  const total = row.totalQuota ?? 0;
  const used = row.usedQuota ?? 0;
  const usagePercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <section className="card logistics-store-card">
      <header className="quota-header">
        <div>
          <h3>{row.storeName || row.storeCode}</h3>
          <p className="card-sub">
            {row.storeCode}
            {" · "}
            总开关：{row.enabled === 1 ? "已开启" : "已关闭"}
            {row.remark ? ` · ${row.remark}` : ""}
          </p>
        </div>
        <span className="quota-badge">
          <b>{remaining}</b>
          <small>/ {total} 剩余</small>
        </span>
      </header>
      <div className="quota-bar">
        <span style={{ width: `${usagePercent}%` }} />
      </div>
      <p className="quota-stats">已用 {used} · 今日成功 {row.todayUsage ?? 0} 次</p>
      <div className="quota-switches">
        {row.switches.map((sw) => {
          const isOn = sw.enabled === 1;
          return (
            <label className="quota-switch" key={sw.type}>
              <div>
                <b>{sw.label}</b>
                <small>{sw.type === "manual" ? "前端手动刷新按钮" : sw.type === "scheduled" ? "定时任务自动跑" : "查询订单时隐式刷"}</small>
              </div>
              <div className="quota-switch-control">
                <span className={`toggle-status ${isOn ? "on" : "off"}`}>{isOn ? "已开启" : "已关闭"}</span>
                <button
                  type="button"
                  className={`toggle ${isOn ? "on" : "off"}`}
                  onClick={() => onToggle(sw.type, sw.enabled)}
                  aria-pressed={isOn}
                >
                  <span />
                </button>
              </div>
            </label>
          );
        })}
      </div>
      {isAdmin ? (
        <div className="logistics-store-actions">
          <button className="button button-soft button-small" type="button" onClick={onEdit}>
            <Pencil size={14} />编辑额度
          </button>
        </div>
      ) : null}
    </section>
  );
}
