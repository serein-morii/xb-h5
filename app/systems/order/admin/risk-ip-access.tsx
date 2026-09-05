import {
  ChevronLeft,
  ChevronRight,
  Network,
  RefreshCw,
  Search,
  ShieldBan,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { API_PATHS } from "../../../lib/pathConventions";
import { useAccess } from "./access";
import { ConfirmDialog, EmptyState, MobileBackButton } from "./ui";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type RiskIpAccess = {
  id: number;
  ipAddress: string;
  allowed: boolean;
  firstSeenTime: string;
  lastSeenTime: string;
  requestCount: number;
  lastPath?: string;
};

type RiskIpFilters = { ipAddress: string; allowed: string };
type PageResult = { rows: RiskIpAccess[]; total: number };

const EMPTY_FILTERS: RiskIpFilters = { ipAddress: "", allowed: "" };
const PAGE_SIZE = 20;

export function RiskIpAccessPage({
  notify,
  onBack,
  backLabel = "系统中心",
}: {
  notify: Notify;
  onBack?: () => void;
  backLabel?: string;
}) {
  const access = useAccess();
  const [rows, setRows] = useState<RiskIpAccess[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [ipAddress, setIpAddress] = useState("");
  const [allowed, setAllowed] = useState("");
  const [activeFilters, setActiveFilters] = useState<RiskIpFilters>(EMPTY_FILTERS);
  const [currentIp, setCurrentIp] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const canEdit = access.has("system.configs.edit");
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (nextPage: number, filters: RiskIpFilters) => {
    setLoading(true);
    setError("");
    try {
      const [result, current] = await Promise.all([
        apiRequest<PageResult>(API_PATHS.administration.riskIps, {
          query: { pageNum: nextPage, pageSize: PAGE_SIZE, ...filters },
        }),
        apiRequest<{ data: { ipAddress: string } }>(`${API_PATHS.administration.riskIps}/current`),
      ]);
      setRows(result.rows || []);
      setTotal(result.total || 0);
      setCurrentIp(current.data.ipAddress);
      setPage(nextPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "风险 IP 记录加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, EMPTY_FILTERS);
  }, [load]);

  const updateAccess = async (row: RiskIpAccess, nextAllowed: boolean) => {
    setBusyId(row.id);
    try {
      await apiRequest(`${API_PATHS.administration.riskIps}/${row.id}/access`, {
        method: "PUT",
        body: { allowed: nextAllowed },
      });
      setRows((current) => current.map((item) => item.id === row.id
        ? { ...item, allowed: nextAllowed }
        : item));
      notify(nextAllowed ? `已允许 ${row.ipAddress} 访问` : `已禁止 ${row.ipAddress} 访问`, "success");
    } catch (updateError) {
      notify(updateError instanceof Error ? updateError.message : "访问状态更新失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleAccess = (row: RiskIpAccess) => {
    const nextAllowed = !row.allowed;
    if (!nextAllowed && row.ipAddress === currentIp) {
      setConfirm({
        title: "禁止当前来源 IP",
        message: "禁止后，当前网络将无法继续访问。需要更换网络或直接修改数据库才能恢复。",
        danger: true,
        action: () => updateAccess(row, nextAllowed),
      });
      return;
    }
    void updateAccess(row, nextAllowed);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const filters = { ipAddress: ipAddress.trim(), allowed };
    setActiveFilters(filters);
    void load(1, filters);
  };

  return (
    <div className="module-page risk-ip-mobile-page">
      <div className="module-hero compact-hero risk-ip-mobile-hero">
        <div>
          {onBack ? <MobileBackButton label={backLabel} onClick={onBack} /> : null}
          <h1>风险 IP 控制</h1>
          <p>记录每个来源 IP，并控制它是否可以访问系统</p>
        </div>
        <span className="hero-tool-icon"><ShieldBan size={25} /></span>
      </div>

      <section className="risk-ip-current-panel" aria-label="当前访问来源">
        <span><Network size={18} /></span>
        <div><small>当前来源 IP</small><strong>{currentIp || "读取中"}</strong></div>
        <button type="button" onClick={() => void load(page, activeFilters)} aria-label="刷新风险 IP 列表">
          <RefreshCw className={loading ? "spin" : ""} size={17} />
        </button>
      </section>

      <form className="risk-ip-mobile-filter" onSubmit={submit}>
        <label>
          <span>来源 IP</span>
          <input
            value={ipAddress}
            onChange={(event) => setIpAddress(event.target.value)}
            placeholder="输入 IPv4 或 IPv6"
            enterKeyHint="search"
          />
        </label>
        <label>
          <span>访问状态</span>
          <select value={allowed} onChange={(event) => setAllowed(event.target.value)}>
            <option value="">全部状态</option>
            <option value="true">允许访问</option>
            <option value="false">禁止访问</option>
          </select>
        </label>
        <button className="button button-primary" type="submit"><Search size={16} />查询</button>
      </form>

      {error ? (
        <section className="risk-ip-mobile-error" role="alert">
          <b>无法读取风险 IP 记录</b>
          <p>{error}</p>
          <button className="button button-ghost" type="button" onClick={() => void load(page, activeFilters)}>重新加载</button>
        </section>
      ) : (
        <>
          <div className="list-heading">
            <div><h2>来源记录</h2><span>共 {total} 条</span></div>
          </div>
          <div className="mobile-card-list risk-ip-mobile-list" aria-busy={loading}>
            {!rows.length ? <EmptyState loading={loading} label="来源 IP" /> : null}
            {rows.map((row) => (
              <article className="data-card risk-ip-mobile-card" key={row.id}>
                <div className="data-card-head">
                  <span className="data-icon"><Network size={19} /></span>
                  <div>
                    <b className="risk-ip-mono">{row.ipAddress}</b>
                    <small>{row.ipAddress === currentIp ? "当前访问来源" : `首次发现 ${row.firstSeenTime || "未知"}`}</small>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.allowed}
                    aria-label={`${row.ipAddress} ${row.allowed ? "允许访问" : "禁止访问"}`}
                    className={`risk-ip-mobile-switch ${row.allowed ? "is-allowed" : "is-blocked"}`}
                    disabled={!canEdit || loading || busyId === row.id}
                    title={!canEdit ? "当前角色没有修改权限" : undefined}
                    onClick={() => toggleAccess(row)}
                  >
                    <span aria-hidden="true" />
                    <b>{busyId === row.id ? "更新中" : row.allowed ? "允许" : "禁止"}</b>
                  </button>
                </div>
                <div className="risk-ip-mobile-details">
                  <div><span>最近访问</span><b>{row.lastSeenTime || "未知"}</b></div>
                  <div><span>采样请求</span><b>{row.requestCount || 0}</b></div>
                  <div className="is-wide"><span>最近路径</span><b title={row.lastPath || ""}>{row.lastPath || "未记录"}</b></div>
                </div>
              </article>
            ))}
          </div>
          <div className="sysm-pager">
            <button className="button button-ghost" type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1, activeFilters)}><ChevronLeft size={17} />上一页</button>
            <span>{page} / {pageCount}</span>
            <button className="button button-ghost" type="button" disabled={page >= pageCount || loading} onClick={() => void load(page + 1, activeFilters)}>下一页<ChevronRight size={17} /></button>
          </div>
        </>
      )}

      <p className="risk-ip-mobile-note">最近访问和请求次数每 5 分钟采样更新，访问开关立即生效。</p>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export default RiskIpAccessPage;
