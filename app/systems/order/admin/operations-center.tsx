import {
  Activity,
  BookOpen,
  Braces,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileClock,
  FileText,
  Gauge,
  HardDrive,
  History,
  LoaderCircle,
  LogIn,
  MessageSquareCode,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Server,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { API_PATHS } from "../../../lib/pathConventions";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_BASE, apiRequest, getStoredToken, toQuery } from "../../../lib/api";
import { useAccess } from "./access";
import { ConfirmDialog, EmptyState, MobileBackButton, Sheet } from "./ui";
import { fetchOpsHome, getOpsHome, resolveOpsHome, type OpsHomeConfig } from "./operationsCenterHome.config";

type DataRow = Record<string, unknown>;
type NoticeType = "success" | "error" | "info";
type Notify = (message: string, type?: NoticeType) => void;
type ViewKey =
  | "home"
  | "online"
  | "jobs"
  | "jobLogs"
  | "operLogs"
  | "loginLogs"
  | "server"
  | "cache"
  | "druid"
  | "generator"
  | "swagger"
  | "messages";

const VIEW_CAPABILITY: Record<ViewKey, string> = {
  home: "nav.operationsCenter",
  online: "operations.online.view",
  jobs: "operations.jobs.view",
  jobLogs: "operations.jobs.view",
  operLogs: "operations.operLogs.view",
  loginLogs: "operations.loginLogs.view",
  server: "operations.server.view",
  cache: "operations.cache.view",
  druid: "operations.server.view",
  generator: "operations.codegen.view",
  swagger: "operations.codegen.view",
  messages: "operations.messages.view",
};

type Column = {
  key: string;
  label: string;
  render?: (row: DataRow) => ReactNode;
};

type SearchField = {
  key: string;
  label: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

type ResourceListProps = {
  title: string;
  description: string;
  endpoint: string;
  rowKey: string;
  columns: Column[];
  searchFields: SearchField[];
  notify: Notify;
  onBack: () => void;
  backLabel?: string;
  cleanEndpoint?: string;
  cleanLabel?: string;
  renderActions?: (row: DataRow, reload: () => Promise<void>) => ReactNode;
  headerActions?: (reload: () => Promise<void>) => ReactNode;
};


type ConfirmState = { title: string; message: string; danger?: boolean; action: () => Promise<void> } | null;
let externalConfirmSetter: ((state: ConfirmState) => void) | null = null;
function requestConfirm(state: Exclude<ConfirmState, null>) {
  if (externalConfirmSetter) externalConfirmSetter(state);
  else if (window.confirm(state.message)) void state.action().catch(() => undefined);
}
function GlobalConfirmHost() {
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  useEffect(() => {
    externalConfirmSetter = setConfirm;
    return () => { if (externalConfirmSetter === setConfirm) externalConfirmSetter = null; };
  }, []);
  return <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />;
}

const PAGE_SIZE = 10;

function asRecord(value: unknown): DataRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DataRow : {};
}

function textValue(value: unknown, fallback = "--") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function shortToken(value: unknown) {
  const token = textValue(value, "");
  return token.length > 20 ? `${token.slice(0, 12)}...${token.slice(-5)}` : token || "--";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function iconFor(view: ViewKey) {
  const icons: Record<ViewKey, typeof Activity> = {
    home: Activity,
    online: Wifi,
    jobs: Clock3,
    jobLogs: FileClock,
    operLogs: History,
    loginLogs: LogIn,
    server: Server,
    cache: Database,
    druid: HardDrive,
    generator: Code2,
    swagger: BookOpen,
    messages: MessageSquareCode,
  };
  return icons[view];
}

function PageHeader({ title, description, onBack, backLabel = "返回", actions, icon }: {
  title: string;
  description: string;
  onBack: () => void;
  backLabel?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <>
      <div className="module-hero compact-hero">
        <div>
          <MobileBackButton label={backLabel} onClick={onBack} />
          <span className="eyebrow">运行中心</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {icon ? <span className="hero-tool-icon">{icon}</span> : null}
      </div>
      {actions ? <div className="secondary-actions opsc-header-actions">{actions}</div> : null}
    </>
  );
}

function ResourceList({
  title,
  description,
  endpoint,
  rowKey,
  columns,
  searchFields,
  notify,
  onBack,
  backLabel = "返回",
  cleanEndpoint,
  cleanLabel = "清空记录",
  renderActions,
  headerActions,
}: ResourceListProps) {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await apiRequest<DataRow>(endpoint, {
        query: { pageNum: page, pageSize: PAGE_SIZE, ...filters },
      });
      setRows(Array.isArray(result.rows) ? result.rows.map(asRecord) : []);
      setTotal(Number(result.total || 0));
    } catch (error) {
      const message = errorMessage(error, `${title}加载失败`);
      setLoadError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }, [endpoint, filters, notify, page, title]);

  useEffect(() => { void load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function search(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draft });
  }

  function reset() {
    setDraft({});
    setFilters({});
    setPage(1);
  }

  function clean() {
    if (!cleanEndpoint) return;
    setConfirm({
      title: cleanLabel,
      message: `确认${cleanLabel}？此操作无法撤销。`,
      danger: true,
      action: async () => {
        await apiRequest(cleanEndpoint, { method: "DELETE" });
        notify(`${cleanLabel}成功`, "success");
        setPage(1);
        await load();
      },
    });
  }

  const primaryField = searchFields[0];
  return (
    <div className="module-page opsc-page">
      <PageHeader
        title={title}
        description={description}
        onBack={onBack}
        backLabel={backLabel}
        icon={<FileText size={27} />}
        actions={
          <>
            {headerActions?.(load)}
            <button type="button" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "spin" : ""} size={16} />刷新
            </button>
            {cleanEndpoint ? (
              <button type="button" className="danger-text" onClick={() => void clean()}>
                <Trash2 size={16} />{cleanLabel}
              </button>
            ) : null}
          </>
        }
      />

      {primaryField ? (
        <div className="toolbar-card search-toolbar">
          <label className="quick-search">
            <Search size={15} strokeWidth={2.2} />
            <input
              value={draft[primaryField.key] || ""}
              placeholder={primaryField.placeholder || `搜索${primaryField.label}`}
              onChange={(event) => setDraft((current) => ({ ...current, [primaryField.key]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setPage(1);
                  setFilters({ ...draft, [primaryField.key]: (event.target as HTMLInputElement).value });
                }
              }}
              enterKeyHint="search"
            />
            {draft[primaryField.key] ? (
              <button className="search-clear" type="button" aria-label="清空" onClick={() => {
                setDraft((current) => ({ ...current, [primaryField.key]: "" }));
                setFilters((current) => ({ ...current, [primaryField.key]: "" }));
                setPage(1);
              }}><X size={14} /></button>
            ) : null}
          </label>
          {searchFields.length > 1 ? (
            <button
              className={`filter-chip${searchFields.slice(1).some((field) => String(draft[field.key] || filters[field.key] || "").trim()) ? " active" : ""}`}
              type="button"
              onClick={() => setFilterOpen(true)}
            ><SlidersHorizontal size={14} strokeWidth={2.2} />筛选</button>
          ) : null}
          <button className="toolbar-icon" type="button" onClick={() => void load()} aria-label="刷新" disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} />
          </button>
        </div>
      ) : null}


      <div className="list-heading">
        <div><h2>{title}列表</h2><span>共 {total} 条</span></div>
      </div>

      <div className="mobile-card-list">
        {loadError ? <div className="empty-state"><CircleAlert size={28} /><h3>加载失败</h3><p>{loadError}</p><button type="button" className="button button-soft" onClick={() => void load()}>重试</button></div> : null}
        {!loadError && !rows.length ? <EmptyState loading={loading} label={title} /> : null}
        {!loading && !loadError && rows.map((row, index) => (
          <article className="data-card" key={textValue(row[rowKey], `${page}-${index}`)}>
            <div className="data-card-head">
              <span className="data-icon"><FileText size={20} /></span>
              <div>
                <b>{columns[0]?.render ? columns[0].render(row) : textValue(row[columns[0]?.key])}</b>
                <small>{columns[1] ? (columns[1].render ? columns[1].render(row) : textValue(row[columns[1].key])) : `#${textValue(row[rowKey])}`}</small>
              </div>
            </div>
            <div className="data-metrics">
              {columns.slice(2).map((column) => (
                <div key={column.key}>
                  <span>{column.label}</span>
                  <b>{column.render ? column.render(row) : textValue(row[column.key])}</b>
                </div>
              ))}
            </div>
            {renderActions ? <div className="card-actions">{renderActions(row, load)}</div> : null}
          </article>
        ))}
      </div>

      <div className="sysm-pager">
        <button className="button button-ghost" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={17} />上一页</button>
        <span>{page} / {pages}</span>
        <button className="button button-ghost" type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => Math.min(pages, value + 1))}>下一页<ChevronRight size={17} /></button>
      </div>

      <Sheet open={filterOpen} title={`筛选${title}`} onClose={() => setFilterOpen(false)}>
        <form className="filter-sheet" onSubmit={(event) => { search(event); setFilterOpen(false); }}>
          <div className="filter-sheet-body">
            <section className="filter-section">
              <header><h3>筛选条件</h3></header>
              <div className="filter-field-stack">
                {searchFields.map((field) => (
                  <label className="mobile-form-field" key={field.key}>
                    <span>{field.label}</span>
                    {field.options ? (
                      <select value={draft[field.key] || ""} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}>
                        <option value="">全部</option>
                        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input value={draft[field.key] || ""} placeholder={field.placeholder || `搜索${field.label}`} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} />
                    )}
                  </label>
                ))}
              </div>
            </section>
          </div>
          <div className="filter-sheet-footer">
            <button type="button" className="filter-reset" onClick={reset}>重置</button>
            <button className="filter-apply" type="submit">查看结果</button>
          </div>
        </form>
      </Sheet>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function OnlinePage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  const access = useAccess();
  return (
    <ResourceList
      title="在线用户"
      description="查看当前登录会话，并强制注销异常会话"
      endpoint={API_PATHS.operations.onlineUsers}
      rowKey="tokenId"
      notify={notify}
      onBack={onBack} backLabel={backLabel}
      searchFields={[{ key: "userName", label: "用户" }, { key: "ipaddr", label: "IP 地址" }]}
      columns={[
        { key: "tokenId", label: "会话编号", render: (row) => <code className="opsc-code">{shortToken(row.tokenId)}</code> },
        { key: "userName", label: "用户" },
        { key: "deptName", label: "部门" },
        { key: "ipaddr", label: "IP" },
        { key: "loginLocation", label: "地点" },
        { key: "browser", label: "浏览器" },
        { key: "os", label: "系统" },
        { key: "loginTime", label: "登录时间" },
      ]}
      renderActions={access.has("operations.online.forceLogout") ? (row, reload) => (
        <button className="danger-text" type="button" onClick={() => requestConfirm({
          title: "强制退出",
          message: `确认强退用户 ${textValue(row.userName)}？`,
          danger: true,
          action: async () => {
            await apiRequest(`${API_PATHS.operations.onlineUsers}/${encodeURIComponent(textValue(row.tokenId, ""))}`, { method: "DELETE" });
            notify("用户已强制退出", "success");
            await reload();
          },
        })}><Power size={15} />强退</button>
      ) : undefined}
    />
  );
}

function JobsPage({ notify, onBack, backLabel, openLogs }: { notify: Notify; onBack: () => void; backLabel?: string; openLogs: () => void }) {
  const access = useAccess();
  const [editing, setEditing] = useState<DataRow | "new" | null>(null);
  const [form, setForm] = useState<DataRow>({});
  const [saving, setSaving] = useState(false);
  let listReload: (() => Promise<void>) | null = null;

  function openNew() {
    setForm({ status: "0", concurrent: "1", misfirePolicy: "1", jobGroup: "DEFAULT" });
    setEditing("new");
  }

  function openEdit(row: DataRow) {
    setForm({ ...row });
    setEditing(row);
  }

  async function save() {
    if (!String(form.jobName || "").trim()) return notify("请输入任务名称", "info");
    if (!String(form.invokeTarget || "").trim()) return notify("请输入调用目标", "info");
    if (!String(form.cronExpression || "").trim()) return notify("请输入 Cron 表达式", "info");
    setSaving(true);
    try {
      await apiRequest(API_PATHS.operations.jobs, { method: editing === "new" ? "POST" : "PUT", body: form });
      notify("任务配置已保存", "success");
      setEditing(null);
      if (listReload) await listReload();
    } catch (error) { notify(errorMessage(error, "任务保存失败"), "error"); }
    finally { setSaving(false); }
  }

  return <>
    <ResourceList
      title="定时任务"
      description="管理调度任务状态并触发即时执行"
      endpoint={API_PATHS.operations.jobs}
      rowKey="jobId"
      notify={notify}
      onBack={onBack} backLabel={backLabel}
      searchFields={[
        { key: "jobName", label: "任务名称" },
        { key: "jobGroup", label: "任务分组" },
        { key: "status", label: "状态", options: [{ value: "0", label: "正常" }, { value: "1", label: "暂停" }] },
      ]}
      columns={[
        { key: "jobId", label: "ID" },
        { key: "jobName", label: "任务名称" },
        { key: "jobGroup", label: "分组" },
        { key: "invokeTarget", label: "调用目标", render: (row) => <code className="opsc-code">{textValue(row.invokeTarget)}</code> },
        { key: "cronExpression", label: "Cron", render: (row) => <code className="opsc-code">{textValue(row.cronExpression)}</code> },
        { key: "status", label: "状态", render: (row) => <span className={`opsc-status opsc-status-${String(row.status) === "0" ? "success" : "warning"}`}>{String(row.status) === "0" ? "正常" : "暂停"}</span> },
      ]}
      headerActions={(reload) => { listReload = reload; return <><button type="button" onClick={openLogs}><History size={16} />调度日志</button>{access.has("operations.jobs.create") ? <button type="button" onClick={openNew}><Plus size={16} />新建任务</button> : null}</>; }}
      renderActions={(row, reload) => (
        <>
          {access.has("operations.jobs.changeStatus") ? <button type="button" onClick={async () => {
            try {
              await apiRequest(`${API_PATHS.operations.jobs}/run`, { method: "PUT", body: { jobId: row.jobId, jobGroup: row.jobGroup } });
              notify("任务已触发执行", "success");
            } catch (error) { notify(errorMessage(error, "任务执行失败"), "error"); }
          }}><Play size={15} />执行</button> : null}
          {access.has("operations.jobs.changeStatus") ? <button type="button" onClick={async () => {
            const next = String(row.status) === "0" ? "1" : "0";
            try {
              await apiRequest(`${API_PATHS.operations.jobs}/status`, { method: "PUT", body: { jobId: row.jobId, status: next } });
              notify(next === "0" ? "任务已恢复" : "任务已暂停", "success");
              await reload();
            } catch (error) { notify(errorMessage(error, "状态更新失败"), "error"); }
          }}><Power size={15} />{String(row.status) === "0" ? "暂停" : "恢复"}</button> : null}
          {access.has("operations.jobs.edit") ? <button type="button" onClick={() => openEdit(row)}><Pencil size={15} />编辑</button> : null}
          {access.has("operations.jobs.delete") ? <button className="danger-text" type="button" onClick={() => requestConfirm({
            title: "删除任务",
            message: `确认删除任务 ${textValue(row.jobName)}？`,
            danger: true,
            action: async () => {
              await apiRequest(`${API_PATHS.operations.jobs}/${row.jobId}`, { method: "DELETE" });
              notify("任务已删除", "success");
              await reload();
            },
          })}><Trash2 size={15} />删除</button> : null}
        </>
      )}
    />
    {editing && access.has(editing === "new" ? "operations.jobs.create" : "operations.jobs.edit") ? <Sheet open={true} onClose={() => setEditing(null)} title={editing === "new" ? "新建定时任务" : `编辑任务 · ${textValue(form.jobName)}`} wide><div className="opsc-job-form">
      <label className="opsc-field"><span>任务名称 *</span><input className="opsc-input" value={textValue(form.jobName, "")} onChange={(event) => setForm((current) => ({ ...current, jobName: event.target.value }))} /></label>
      <label className="opsc-field"><span>任务分组</span><input className="opsc-input" value={textValue(form.jobGroup, "")} onChange={(event) => setForm((current) => ({ ...current, jobGroup: event.target.value }))} /></label>
      <label className="opsc-field opsc-field-wide"><span>调用目标 *</span><input className="opsc-input" value={textValue(form.invokeTarget, "")} onChange={(event) => setForm((current) => ({ ...current, invokeTarget: event.target.value }))} /></label>
      <label className="opsc-field"><span>Cron 表达式 *</span><input className="opsc-input" value={textValue(form.cronExpression, "")} onChange={(event) => setForm((current) => ({ ...current, cronExpression: event.target.value }))} /></label>
      <label className="opsc-field"><span>状态</span><select className="opsc-select" value={textValue(form.status, "0")} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="0">正常</option><option value="1">暂停</option></select></label>
      <label className="opsc-field"><span>执行策略</span><select className="opsc-select" value={textValue(form.misfirePolicy, "1")} onChange={(event) => setForm((current) => ({ ...current, misfirePolicy: event.target.value }))}><option value="1">立即执行</option><option value="2">执行一次</option><option value="3">放弃执行</option></select></label>
      <label className="opsc-field"><span>并发执行</span><select className="opsc-select" value={textValue(form.concurrent, "1")} onChange={(event) => setForm((current) => ({ ...current, concurrent: event.target.value }))}><option value="0">允许</option><option value="1">禁止</option></select></label>
      <label className="opsc-field opsc-field-wide"><span>备注</span><textarea className="opsc-input opsc-textarea" value={textValue(form.remark, "")} onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))} /></label>
    </div><div className="form-footer"><button type="button" className="button button-ghost" onClick={() => setEditing(null)}>取消</button><button className="button button-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={15} /> : null}保存</button></div></Sheet> : null}
  </>;
}

function JobLogsPage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  const access = useAccess();
  return (
    <ResourceList
      title="调度日志"
      description="查看每次任务执行结果与异常信息"
      endpoint={API_PATHS.operations.jobLogs}
      rowKey="jobLogId"
      notify={notify}
      onBack={onBack} backLabel={backLabel}
      cleanEndpoint={access.has("operations.jobs.delete") ? `${API_PATHS.operations.jobLogs}/clean` : undefined}
      cleanLabel="清空调度日志"
      searchFields={[
        { key: "jobName", label: "任务名称" },
        { key: "jobGroup", label: "任务分组" },
        { key: "status", label: "状态", options: [{ value: "0", label: "成功" }, { value: "1", label: "失败" }] },
      ]}
      columns={[
        { key: "jobLogId", label: "ID" },
        { key: "jobName", label: "任务" },
        { key: "jobGroup", label: "分组" },
        { key: "invokeTarget", label: "调用目标" },
        { key: "jobMessage", label: "日志信息" },
        { key: "status", label: "状态", render: (row) => <span className={`opsc-status opsc-status-${String(row.status) === "0" ? "success" : "danger"}`}>{String(row.status) === "0" ? "成功" : "失败"}</span> },
        { key: "createTime", label: "执行时间" },
      ]}
      renderActions={access.has("operations.jobs.delete") ? (row, reload) => <DeleteAction endpoint={`${API_PATHS.operations.jobLogs}/${row.jobLogId}`} label="调度日志" notify={notify} reload={reload} /> : undefined}
    />
  );
}

function OperLogsPage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  const access = useAccess();
  return (
    <ResourceList
      title="操作日志"
      description="追踪后台关键操作与请求结果"
      endpoint={API_PATHS.operations.auditLogs}
      rowKey="operId"
      notify={notify}
      onBack={onBack} backLabel={backLabel}
      cleanEndpoint={access.has("operations.operLogs.delete") ? `${API_PATHS.operations.auditLogs}/clean` : undefined}
      cleanLabel="清空操作日志"
      searchFields={[
        { key: "title", label: "系统模块" },
        { key: "operName", label: "操作人员" },
        { key: "status", label: "状态", options: [{ value: "0", label: "正常" }, { value: "1", label: "异常" }] },
      ]}
      columns={[
        { key: "operId", label: "ID" },
        { key: "title", label: "模块" },
        { key: "businessType", label: "业务类型" },
        { key: "requestMethod", label: "请求方式" },
        { key: "operName", label: "操作人" },
        { key: "operIp", label: "IP" },
        { key: "status", label: "状态", render: (row) => <span className={`opsc-status opsc-status-${String(row.status) === "0" ? "success" : "danger"}`}>{String(row.status) === "0" ? "正常" : "异常"}</span> },
        { key: "operTime", label: "操作时间" },
      ]}
      renderActions={access.has("operations.operLogs.delete") ? (row, reload) => <DeleteAction endpoint={`${API_PATHS.operations.auditLogs}/${row.operId}`} label="操作日志" notify={notify} reload={reload} /> : undefined}
    />
  );
}

function LoginLogsPage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  const access = useAccess();
  return (
    <ResourceList
      title="登录日志"
      description="检查登录成功、失败与访问来源"
      endpoint={API_PATHS.operations.loginAudits}
      rowKey="infoId"
      notify={notify}
      onBack={onBack} backLabel={backLabel}
      cleanEndpoint={access.has("operations.loginLogs.delete") ? `${API_PATHS.operations.loginAudits}/clean` : undefined}
      cleanLabel="清空登录日志"
      searchFields={[
        { key: "userName", label: "用户" },
        { key: "ipaddr", label: "IP 地址" },
        { key: "status", label: "状态", options: [{ value: "0", label: "成功" }, { value: "1", label: "失败" }] },
      ]}
      columns={[
        { key: "infoId", label: "ID" },
        { key: "userName", label: "用户" },
        { key: "ipaddr", label: "IP" },
        { key: "loginLocation", label: "地点" },
        { key: "browser", label: "浏览器" },
        { key: "os", label: "系统" },
        { key: "status", label: "状态", render: (row) => <span className={`opsc-status opsc-status-${String(row.status) === "0" ? "success" : "danger"}`}>{String(row.status) === "0" ? "成功" : "失败"}</span> },
        { key: "loginTime", label: "登录时间" },
      ]}
      renderActions={access.has("operations.loginLogs.delete") ? (row, reload) => <DeleteAction endpoint={`${API_PATHS.operations.loginAudits}/${row.infoId}`} label="登录日志" notify={notify} reload={reload} /> : undefined}
    />
  );
}

function DeleteAction({ endpoint, label, notify, reload }: { endpoint: string; label: string; notify: Notify; reload: () => Promise<void> }) {
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  return <>
    <button className="danger-text" type="button" onClick={() => setConfirm({
      title: `删除${label}`,
      message: `确认删除这条${label}？删除后无法恢复。`,
      danger: true,
      action: async () => {
        await apiRequest(endpoint, { method: "DELETE" });
        notify("记录已删除", "success");
        await reload();
      },
    })}><Trash2 size={15} />删除</button>
    <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
  </>;
}

function Metric({ label, value, suffix = "" }: { label: string; value: unknown; suffix?: string }) {
  return <article className="opsc-metric"><span>{label}</span><strong>{textValue(value)}{value !== undefined && value !== null && value !== "" ? suffix : ""}</strong></article>;
}

function ServerPage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  const [data, setData] = useState<DataRow>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<DataRow>(API_PATHS.operations.server);
      setData(asRecord(result.data || result));
    } catch (error) { notify(errorMessage(error, "服务信息加载失败"), "error"); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const cpu = asRecord(data.cpu);
  const mem = asRecord(data.mem);
  const jvm = asRecord(data.jvm);
  const sys = asRecord(data.sys);
  const sysFiles = Array.isArray(data.sysFiles) ? data.sysFiles.map(asRecord) : [];

  return (
    <div className="module-page opsc-page">
      <PageHeader title="服务监控" description="服务器、JVM 与磁盘实时运行状态" onBack={onBack} backLabel={backLabel} icon={<Server size={27} />} actions={<button type="button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16} />刷新</button>} />
      <div className="opsc-metrics">
        <Metric label="CPU 使用率" value={cpu.used} suffix="%" />
        <Metric label="系统内存" value={mem.usage} suffix="%" />
        <Metric label="JVM 内存" value={jvm.usage} suffix="%" />
        <Metric label="CPU 核心" value={cpu.cpuNum} />
      </div>
      <div className="opsc-detail-grid">
        <article className="opsc-detail-card"><h2><Server size={18} />主机信息</h2><dl><dt>主机名</dt><dd>{textValue(sys.computerName)}</dd><dt>IP</dt><dd>{textValue(sys.computerIp)}</dd><dt>操作系统</dt><dd>{textValue(sys.osName)}</dd><dt>系统架构</dt><dd>{textValue(sys.osArch)}</dd></dl></article>
        <article className="opsc-detail-card"><h2><Braces size={18} />JVM 信息</h2><dl><dt>Java</dt><dd>{textValue(jvm.name)}</dd><dt>版本</dt><dd>{textValue(jvm.version)}</dd><dt>启动时间</dt><dd>{textValue(jvm.startTime)}</dd><dt>运行时长</dt><dd>{textValue(jvm.runTime)}</dd></dl></article>
      </div>
      <article className="opsc-detail-card">
        <h2><HardDrive size={18} />磁盘状态</h2>
        <div className="opsc-table-wrap"><table className="opsc-table"><thead><tr><th>盘符</th><th>文件系统</th><th>总容量</th><th>可用</th><th>已用</th><th>使用率</th></tr></thead><tbody>{sysFiles.map((disk, index) => <tr key={`${textValue(disk.dirName)}-${index}`}><td>{textValue(disk.dirName)}</td><td>{textValue(disk.sysTypeName)}</td><td>{textValue(disk.total)}</td><td>{textValue(disk.free)}</td><td>{textValue(disk.used)}</td><td>{textValue(disk.usage)}%</td></tr>)}</tbody></table></div>
      </article>
    </div>
  );
}

function CachePage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  const [overview, setOverview] = useState<DataRow>({});
  const [names, setNames] = useState<DataRow[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [activeName, setActiveName] = useState("");
  const [activeKey, setActiveKey] = useState("");
  const [value, setValue] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cacheResult, namesResult] = await Promise.all([
        apiRequest<DataRow>(API_PATHS.operations.cache),
        apiRequest<DataRow>(`${API_PATHS.operations.cache}/names`),
      ]);
      setOverview(asRecord(cacheResult.data || cacheResult));
      const list = namesResult.data || namesResult.rows;
      setNames(Array.isArray(list) ? list.map(asRecord) : []);
    } catch (error) { notify(errorMessage(error, "缓存信息加载失败"), "error"); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { void load(); }, [load]);

  async function selectName(name: string) {
    setActiveName(name);
    setActiveKey("");
    setValue(null);
    try {
      const result = await apiRequest<DataRow>(`${API_PATHS.operations.cache}/names/${encodeURIComponent(name)}/keys`);
      const list = result.data || result.rows;
      setKeys(Array.isArray(list) ? list.map(String) : []);
    } catch (error) { notify(errorMessage(error, "缓存键加载失败"), "error"); }
  }

  async function selectKey(key: string) {
    setActiveKey(key);
    try {
      const result = await apiRequest<DataRow>(`${API_PATHS.operations.cache}/names/${encodeURIComponent(activeName)}/keys/${encodeURIComponent(key)}`);
      setValue(result.data ?? result);
    } catch (error) { notify(errorMessage(error, "缓存内容加载失败"), "error"); }
  }

  function clear(endpoint: string, message: string, after?: () => void) {
    requestConfirm({
      title: message,
      message: `确认${message}？`,
      danger: true,
      action: async () => {
        await apiRequest(endpoint, { method: "DELETE" });
        notify(`${message}成功`, "success");
        after?.();
        await load();
      },
    });
  }

  const info = asRecord(overview.info);
  const commandStats = Array.isArray(overview.commandStats) ? overview.commandStats.map(asRecord) : [];

  return (
    <div className="module-page opsc-page">
      <PageHeader title="缓存监控" description="Redis 状态、缓存空间和键值检查" onBack={onBack} backLabel={backLabel} icon={<Database size={27} />} actions={<><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16} />刷新</button><button className="button button-ghost danger-text" type="button" onClick={() => void clear(API_PATHS.operations.cache, "清空全部缓存", () => { setKeys([]); setValue(null); })}><Trash2 size={16} />清空全部</button></>} />
      <div className="opsc-metrics">
        <Metric label="Redis 版本" value={info.redis_version} />
        <Metric label="运行模式" value={info.redis_mode} />
        <Metric label="客户端连接" value={info.connected_clients} />
        <Metric label="已用内存" value={info.used_memory_human} />
        <Metric label="键总数" value={overview.dbSize} />
        <Metric label="命令处理" value={info.total_commands_processed} />
      </div>
      <div className="opsc-cache-browser">
        <article className="opsc-cache-column"><h2>缓存空间</h2>{names.map((item, index) => { const name = textValue(item.cacheName || item.name, ""); return <button className={`opsc-cache-item ${activeName === name ? "opsc-cache-item-active" : ""}`} key={`${name}-${index}`} type="button" onClick={() => void selectName(name)}><span>{textValue(item.remark || item.cacheName || item.name)}</span><code>{name}</code></button>; })}</article>
        <article className="opsc-cache-column"><div className="opsc-cache-title"><h2>缓存键</h2>{activeName ? <button type="button" onClick={() => void clear(`${API_PATHS.operations.cache}/names/${encodeURIComponent(activeName)}`, "清理该缓存空间", () => { setKeys([]); setValue(null); })}><Trash2 size={14} /></button> : null}</div>{keys.map((key) => <button className={`opsc-cache-item ${activeKey === key ? "opsc-cache-item-active" : ""}`} key={key} type="button" onClick={() => void selectKey(key)}><code>{key}</code></button>)}</article>
        <article className="opsc-cache-column"><div className="opsc-cache-title"><h2>缓存内容</h2>{activeKey ? <button type="button" onClick={() => void clear(`${API_PATHS.operations.cache}/keys/${encodeURIComponent(activeKey)}`, "删除该缓存键", () => { setKeys((current) => current.filter((key) => key !== activeKey)); setActiveKey(""); setValue(null); })}><Trash2 size={14} /></button> : null}</div><pre className="opsc-json">{value === null ? "选择缓存键查看内容" : JSON.stringify(value, null, 2)}</pre></article>
      </div>
      {commandStats.length ? <article className="opsc-detail-card"><h2><Gauge size={18} />命令统计</h2><div className="opsc-command-list">{commandStats.slice(0, 12).map((item, index) => <span key={index}>{textValue(item.name)} <b>{textValue(item.value)}</b></span>)}</div></article> : null}
    </div>
  );
}

async function downloadGeneratedCode(tableNames: string) {
  const response = await fetch(`${API_BASE}${API_PATHS.development.codegen}/code/batch${toQuery({ tables: tableNames })}`, {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`生成下载失败（${response.status}）`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = tableNames.includes(",") ? `generated_${Date.now()}.zip` : `${tableNames || "generated"}.zip`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function GeneratorPage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  const access = useAccess();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewFiles, setPreviewFiles] = useState<Record<string, string> | null>(null);
  const [activePreview, setActivePreview] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [dbTables, setDbTables] = useState<DataRow[]>([]);
  const [dbSelected, setDbSelected] = useState<Set<string>>(new Set());
  const [dbKeyword, setDbKeyword] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [editing, setEditing] = useState<{ info: DataRow; columns: DataRow[] } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function preview(row: DataRow) {
    try {
      const result = await apiRequest<DataRow>(`${API_PATHS.development.codegen}/${row.tableId}/preview`);
      const files = asRecord(result.data || result) as Record<string, string>;
      setPreviewFiles(files);
      setActivePreview(Object.keys(files)[0] || "");
    } catch (error) { notify(errorMessage(error, "代码预览失败"), "error"); }
  }

  async function loadDbTables() {
    setDbLoading(true);
    try {
      const result = await apiRequest<DataRow>(`${API_PATHS.development.codegen}/database/tables`, { query: { pageNum: 1, pageSize: 100, tableName: dbKeyword || undefined } });
      setDbTables(Array.isArray(result.rows) ? result.rows.map(asRecord) : []);
    } catch (error) { notify(errorMessage(error, "数据库表加载失败"), "error"); }
    finally { setDbLoading(false); }
  }

  async function importTables(reload: () => Promise<void>) {
    if (!dbSelected.size) return notify("请选择要导入的表", "info");
    try {
      await apiRequest(`${API_PATHS.development.codegen}/tables/import`, { method: "POST", query: { tables: [...dbSelected].join(",") } });
      notify(`已导入 ${dbSelected.size} 张表`, "success");
      setImportOpen(false);
      setDbSelected(new Set());
      await reload();
    } catch (error) { notify(errorMessage(error, "导入失败"), "error"); }
  }

  async function openEdit(row: DataRow) {
    setEditLoading(true);
    try {
      const result = await apiRequest<DataRow>(`${API_PATHS.development.codegen}/${row.tableId}`);
      const root = asRecord(result.data || result);
      const rawColumns = root.rows || result.rows || root.columns || result.columns;
      setEditing({
        info: asRecord(root.info || result.info || root),
        columns: Array.isArray(rawColumns) ? rawColumns.map(asRecord) : [],
      });
    } catch (error) { notify(errorMessage(error, "生成配置加载失败"), "error"); }
    finally { setEditLoading(false); }
  }

  function patchColumn(index: number, key: string, value: unknown) {
    setEditing((current) => current ? { ...current, columns: current.columns.map((column, columnIndex) => columnIndex === index ? { ...column, [key]: value } : column) } : current);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await apiRequest(API_PATHS.development.codegen, { method: "PUT", body: { ...editing.info, columns: editing.columns, params: editing.info.params } });
      notify("生成配置已保存", "success");
      setEditing(null);
    } catch (error) { notify(errorMessage(error, "配置保存失败"), "error"); }
    finally { setSaving(false); }
  }

  let listReload: (() => Promise<void>) | null = null;
  return <>
    <ResourceList
      title="代码生成"
      description="同步数据库表结构并生成项目代码包"
      endpoint={API_PATHS.development.codegen}
      rowKey="tableId"
      notify={notify}
      onBack={onBack} backLabel={backLabel}
      searchFields={[{ key: "tableName", label: "表名称" }, { key: "tableComment", label: "表描述" }]}
      columns={[
        { key: "_select", label: "选择", render: (row) => { const name = textValue(row.tableName, ""); return <input className="opsc-checkbox" type="checkbox" checked={selected.has(name)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); return next; })} aria-label={`选择 ${name}`} />; } },
        { key: "tableId", label: "ID" },
        { key: "tableName", label: "表名", render: (row) => <code className="opsc-code">{textValue(row.tableName)}</code> },
        { key: "tableComment", label: "说明" },
        { key: "className", label: "实体类" },
        { key: "createTime", label: "创建时间" },
        { key: "updateTime", label: "更新时间" },
      ]}
      headerActions={(reload) => { listReload = reload; return <>{access.has("operations.codegen.import") ? <button type="button" disabled={dbLoading} onClick={() => { setImportOpen(true); setDbSelected(new Set()); void loadDbTables(); }}><Plus size={16} />导入表</button> : null}{selected.size && access.has("operations.codegen.generate") ? <button type="button" onClick={async () => { try { await downloadGeneratedCode([...selected].join(",")); notify("批量生成下载已开始", "success"); } catch (error) { notify(errorMessage(error, "批量生成失败"), "error"); } }}><Download size={16} />生成所选（{selected.size}）</button> : null}</>; }}
      renderActions={(row, reload) => (
        <>
          {access.has("operations.codegen.preview") ? <button type="button" onClick={() => void preview(row)}><Eye size={15} />预览</button> : null}
          {access.has("operations.codegen.edit") ? <button type="button" onClick={() => void openEdit(row)} disabled={editLoading}><Pencil size={15} />编辑</button> : null}
          {access.has("operations.codegen.edit") ? <button type="button" onClick={() => {
            const tableName = textValue(row.tableName, "");
            requestConfirm({
              title: "同步表结构",
              message: `确认强制同步表 ${tableName} 的结构？`,
              danger: true,
              action: async () => {
                await apiRequest(`${API_PATHS.development.codegen}/database/${encodeURIComponent(tableName)}/sync`, { method: "POST" });
                notify("表结构已同步", "success");
                await reload();
              },
            });
          }}><RefreshCw size={15} />同步</button> : null}
          {access.has("operations.codegen.generate") ? <button type="button" onClick={async () => { try { await downloadGeneratedCode(textValue(row.tableName, "")); notify("代码包下载已开始", "success"); } catch (error) { notify(errorMessage(error, "生成失败"), "error"); } }}><Download size={15} />生成</button> : null}
          {access.has("operations.codegen.delete") ? <button className="danger-text" type="button" onClick={() => requestConfirm({
            title: "删除生成配置",
            message: `确认删除 ${textValue(row.tableName)} 的生成配置？`,
            danger: true,
            action: async () => {
              await apiRequest(`${API_PATHS.development.codegen}/${row.tableId}`, { method: "DELETE" });
              notify("生成配置已删除", "success");
              await reload();
            },
          })}><Trash2 size={15} />删除</button> : null}
        </>
      )}
    />
    {previewFiles && access.has("operations.codegen.preview") ? <Sheet open={true} onClose={() => setPreviewFiles(null)} title="代码预览" wide><div className="opsc-preview"><nav>{Object.keys(previewFiles).map((name) => <button className={activePreview === name ? "active" : ""} type="button" key={name} onClick={() => setActivePreview(name)}>{name.split("/").pop()}</button>)}</nav><pre>{previewFiles[activePreview] || "暂无预览内容"}</pre></div></Sheet> : null}
    {importOpen && access.has("operations.codegen.import") ? <Sheet open={true} onClose={() => setImportOpen(false)} title="导入数据库表" wide><form className="opsc-inline-search" onSubmit={(event) => { event.preventDefault(); void loadDbTables(); }}><input className="opsc-input" value={dbKeyword} onChange={(event) => setDbKeyword(event.target.value)} placeholder="搜索数据库表" /><button type="submit"><Search size={15} />查询</button></form>{dbLoading ? <div className="opsc-state"><LoaderCircle className="spin" size={24} />正在加载</div> : <div className="opsc-db-tables">{dbTables.map((row) => { const name = textValue(row.tableName, ""); return <label key={name}><input type="checkbox" checked={dbSelected.has(name)} onChange={() => setDbSelected((current) => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); return next; })} /><span><b>{name}</b><small>{textValue(row.tableComment)}</small></span></label>; })}{!dbTables.length ? <p>暂无可导入表</p> : null}</div>}<div className="form-footer"><button type="button" className="button button-ghost" onClick={() => setImportOpen(false)}>取消</button><button className="button button-primary" type="button" onClick={() => listReload && void importTables(listReload)}>导入所选（{dbSelected.size}）</button></div></Sheet> : null}
    {editing && access.has("operations.codegen.edit") ? <Sheet open={true} onClose={() => setEditing(null)} title={`生成配置 · ${textValue(editing.info.tableName)}`} wide><div className="opsc-gen-form">{[["tableComment", "表描述"], ["className", "实体类名"], ["functionAuthor", "作者"], ["packageName", "生成包路径"], ["moduleName", "模块名"], ["businessName", "业务名"], ["functionName", "功能名"]].map(([key, label]) => <label className="opsc-field" key={key}><span>{label}</span><input className="opsc-input" value={textValue(editing.info[key], "")} onChange={(event) => setEditing((current) => current ? { ...current, info: { ...current.info, [key]: event.target.value } } : current)} /></label>)}</div><div className="opsc-table-wrap opsc-gen-columns"><table className="opsc-table"><thead><tr><th>列名</th><th>描述</th><th>Java 类型</th><th>属性</th><th>插入</th><th>编辑</th><th>列表</th><th>查询</th><th>必填</th></tr></thead><tbody>{editing.columns.map((column, index) => <tr key={textValue(column.columnId || column.columnName, String(index))}><td data-label="列名"><code>{textValue(column.columnName)}</code></td><td data-label="描述"><input className="opsc-input" value={textValue(column.columnComment, "")} onChange={(event) => patchColumn(index, "columnComment", event.target.value)} /></td><td data-label="Java 类型"><select className="opsc-select" value={textValue(column.javaType, "String")} onChange={(event) => patchColumn(index, "javaType", event.target.value)}>{["Long", "String", "Integer", "Double", "BigDecimal", "Date", "Boolean"].map((type) => <option key={type}>{type}</option>)}</select></td><td data-label="属性"><input className="opsc-input" value={textValue(column.javaField, "")} onChange={(event) => patchColumn(index, "javaField", event.target.value)} /></td>{["isInsert", "isEdit", "isList", "isQuery", "isRequired"].map((key) => <td data-label={key} key={key}><input className="opsc-checkbox" type="checkbox" checked={String(column[key]) === "1"} onChange={(event) => patchColumn(index, key, event.target.checked ? "1" : "0")} /></td>)}</tr>)}</tbody></table></div><div className="form-footer"><button type="button" className="button button-ghost" onClick={() => setEditing(null)}>取消</button><button className="button button-primary" type="button" disabled={saving} onClick={() => void saveEdit()}>{saving ? <LoaderCircle className="spin" size={15} /> : null}保存配置</button></div></Sheet> : null}
  </>;
}

function MessagesPage({ notify, onBack, backLabel }: { notify: Notify; onBack: () => void; backLabel?: string }) {
  return (
    <ResourceList
      title="开发消息"
      description="查看研发调试消息通道中的最新记录"
      endpoint={API_PATHS.development.messages}
      rowKey="id"
      notify={notify}
      onBack={onBack} backLabel={backLabel}
      searchFields={[{ key: "title", label: "标题" }, { key: "content", label: "内容" }]}
      columns={[
        { key: "id", label: "ID" },
        { key: "title", label: "标题", render: (row) => textValue(row.title || row.msgTitle) },
        { key: "content", label: "内容", render: (row) => <span className="opsc-message-content">{textValue(row.content || row.msgContent)}</span> },
        { key: "createBy", label: "发送人" },
        { key: "createTime", label: "时间" },
      ]}
    />
  );
}

function ExternalEntry({ kind, onBack, backLabel }: { kind: "druid" | "swagger"; onBack: () => void; backLabel?: string }) {
  const isDruid = kind === "druid";
  const title = isDruid ? "数据源监控" : "接口文档";
  const description = isDruid ? "进入 Druid 查看连接池、SQL 与数据源状态" : "打开 Swagger UI 调试和查阅后端接口";
  const href = isDruid ? `${API_BASE}/druid/login.html` : `${API_BASE}/swagger-ui/index.html`;
  const Icon = isDruid ? HardDrive : BookOpen;
  return (
    <div className="module-page opsc-page">
      <PageHeader title={title} description={description} onBack={onBack} backLabel={backLabel} icon={<Icon size={27} />} />
      <article className="tracking-card tracking-green">
        <span className="tracking-logo"><Icon size={28} /></span>
        <div><h2>{title}</h2><p>{isDruid ? "该页面由后端 Druid 控制台提供，需要当前账号具备监控权限。" : "文档与当前后端版本同步，可直接查看模型、参数和响应结构。"}</p></div>
        <a className="primary-action" href={href} target="_blank" rel="noreferrer">打开新页面<ExternalLink size={16} /></a>
      </article>
    </div>
  );
}

/** 每个 ViewKey 的默认 title/description/icon。分组在 opsHome config 里定义，这里只存兜底。 */
const VIEW_DEFAULTS: Record<ViewKey, { title: string; description: string }> = {
  online: { title: "在线用户", description: "会话查看与强制退出" },
  server: { title: "服务监控", description: "CPU、内存、JVM 与磁盘" },
  cache: { title: "缓存监控", description: "Redis 状态与缓存键管理" },
  druid: { title: "数据源", description: "Druid 连接池与 SQL 监控" },
  jobs: { title: "定时任务", description: "任务启停与立即执行" },
  jobLogs: { title: "调度日志", description: "任务执行结果与异常" },
  operLogs: { title: "操作日志", description: "后台操作审计轨迹" },
  loginLogs: { title: "登录日志", description: "登录成功与失败记录" },
  generator: { title: "代码生成", description: "表结构同步与代码下载" },
  swagger: { title: "接口文档", description: "Swagger API 文档" },
  messages: { title: "开发消息", description: "调试消息通道" },
  home: { title: "运行中心", description: "服务状态、调度审计和开发工具集中入口" },
};

function HomePage({ open, onExit, exitLabel = "工作台", opsHomeConfig }: { open: (view: ViewKey) => void; onExit?: () => void; exitLabel?: string; opsHomeConfig: OpsHomeConfig }) {
  const access = useAccess();
  // 每个 ViewKey 的兜底元数据，注入到 resolver
  const defaultsByKey = useMemo(() => {
    const map = new Map<string, { title: string; description: string; icon: LucideIcon }>();
    (Object.keys(VIEW_DEFAULTS) as ViewKey[]).forEach((key) => {
      map.set(key, { ...VIEW_DEFAULTS[key], icon: iconFor(key) });
    });
    return map;
  }, []);
  const groups = useMemo(() => {
    return resolveOpsHome(opsHomeConfig, defaultsByKey)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => access.has(VIEW_CAPABILITY[item.key as ViewKey])),
      }))
      .filter((group) => group.items.length);
  }, [opsHomeConfig, defaultsByKey, access]);
  return (
    <div className="module-page opsc-home">
      <div className="module-hero compact-hero">
        <div>
          {onExit ? <MobileBackButton label={exitLabel} onClick={onExit} /> : null}
          <span className="eyebrow">系统运行</span>
          <h1>运行监控</h1>
          <p>服务状态、调度审计和开发工具集中入口</p>
        </div>
        <span className="hero-tool-icon"><Activity size={27} /></span>
      </div>
      <div className="menu-groups">
        {groups.map((group) => (
          <section className="menu-group" key={group.key}>
            <div className="menu-group-title"><b>{group.title}</b>{group.description ? <small>{group.description}</small> : null}</div>
            <div className="menu-grid">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button type="button" key={item.key} onClick={() => open(item.key as ViewKey)}>
                    <span><Icon size={19} /></span>
                    <b>{item.title}</b>
                    <small>{item.description}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export type OperationsCenterPageProps = {
  notify?: Notify;
  initialView?: ViewKey;
  onClose?: () => void;
  exitLabel?: string;
};

export function OperationsCenterPage({ notify: externalNotify, initialView = "home", onClose, exitLabel = "工作台" }: OperationsCenterPageProps) {
  const access = useAccess();
  const [view, setView] = useState<ViewKey>(initialView);
  const [notice, setNotice] = useState<{ message: string; type: NoticeType } | null>(null);
  const [opsHomeConfig, setOpsHomeConfig] = useState<OpsHomeConfig>(getOpsHome);
  useEffect(() => {
    let mounted = true;
    fetchOpsHome(apiRequest).then((config) => { if (mounted) setOpsHomeConfig(config); }).catch(() => { /* 本地默认兜底 */ });
    const reload = () => { fetchOpsHome(apiRequest).then((config) => { if (mounted) setOpsHomeConfig(config); }).catch(() => { /* */ }); };
    window.addEventListener("xb-ops-home-changed", reload);
    return () => { mounted = false; window.removeEventListener("xb-ops-home-changed", reload); };
  }, []);

  const notify = useCallback<Notify>((message, type = "info") => {
    if (externalNotify) externalNotify(message, type);
    else {
      setNotice({ message, type });
      window.setTimeout(() => setNotice((current) => current?.message === message ? null : current), 3200);
    }
  }, [externalNotify]);

  const goHome = useCallback(() => {
    // 从统一入口直达子页时，返回直接回到系统运行首页，避免多一层割裂
    if (onClose && initialView !== "home") onClose();
    else setView("home");
  }, [onClose, initialView]);
  const openView = useCallback((next: ViewKey) => {
    if (access.has(VIEW_CAPABILITY[next])) setView(next);
    else notify("当前角色没有此功能权限", "error");
  }, [access, notify]);
  useEffect(() => {
    if (view !== "home" && !access.has(VIEW_CAPABILITY[view])) setView("home");
  }, [access, view]);
  // 从二级目录直达子页时，返回文案跟随父目录；中心内部互跳仍显示“运行中心”。
  const backLabel = initialView !== "home" && onClose ? exitLabel : "运行中心";
  const page = useMemo(() => {
    if (view === "online") return <OnlinePage notify={notify} onBack={goHome} backLabel={backLabel} />;
    if (view === "jobs") return <JobsPage notify={notify} onBack={goHome} backLabel={backLabel} openLogs={() => setView("jobLogs")} />;
    if (view === "jobLogs") return <JobLogsPage notify={notify} onBack={goHome} backLabel={backLabel} />;
    if (view === "operLogs") return <OperLogsPage notify={notify} onBack={goHome} backLabel={backLabel} />;
    if (view === "loginLogs") return <LoginLogsPage notify={notify} onBack={goHome} backLabel={backLabel} />;
    if (view === "server") return <ServerPage notify={notify} onBack={goHome} backLabel={backLabel} />;
    if (view === "cache") return <CachePage notify={notify} onBack={goHome} backLabel={backLabel} />;
    if (view === "druid") return <ExternalEntry kind="druid" onBack={goHome} backLabel={backLabel} />;
    if (view === "generator") return <GeneratorPage notify={notify} onBack={goHome} backLabel={backLabel} />;
    if (view === "swagger") return <ExternalEntry kind="swagger" onBack={goHome} backLabel={backLabel} />;
    if (view === "messages") return <MessagesPage notify={notify} onBack={goHome} backLabel={backLabel} />;
    return <HomePage open={openView} onExit={onClose} exitLabel={exitLabel} opsHomeConfig={opsHomeConfig} />;
  }, [backLabel, exitLabel, goHome, notify, onClose, openView, opsHomeConfig, view]);

  return (
    <div className="opsc-root">
      {onClose ? <button className="toolbar-icon opsc-close" type="button" onClick={onClose} aria-label="关闭运行中心"><X size={19} /></button> : null}
      <GlobalConfirmHost />
      {page}
      {notice ? <div className={`opsc-toast opsc-toast-${notice.type}`} role="status">{notice.type === "success" ? <ShieldCheck size={17} /> : notice.type === "error" ? <CircleAlert size={17} /> : <Activity size={17} />}{notice.message}</div> : null}
    </div>
  );
}

export const OperationsCenter = OperationsCenterPage;

export default OperationsCenterPage;
