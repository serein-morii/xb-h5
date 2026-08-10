import {
  ArrowDown,
  ArrowUp,
  Braces,
  Download,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAccess } from "./access";
import {
  DEFAULT_MOBILE_MENU_CONFIG,
  MOBILE_MENU_ALL_KEY,
  MOBILE_PAGE_REGISTRY,
  mergeMobileMenuConfig,
  type MobileDockItemConfig,
  type MobileMenuConfig,
  type MobileMenuGroupConfig,
  type MobileMenuItemConfig,
} from "./mobileMenu.config";
import type { MenuKey } from "./core";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type HistoryRow = {
  id: number;
  schemaVersion?: number;
  changeType?: string;
  remark?: string;
  createBy?: string;
  createTime?: string;
  hasConfig?: boolean;
};

// 全部 MenuKey 都可以作为菜单项使用（包括 sys*/ops*/mobileMenu 子项）。
// 与后端白名单对齐：仅注册过的 key 才会出现在编辑器里；无权限的运行时自动隐藏。
const PAGE_OPTIONS = Object.values(MOBILE_PAGE_REGISTRY)
  .map((item) => ({ key: item.key, label: item.label }));

const ALLOWED_PAGE_KEYS = new Set(PAGE_OPTIONS.map((item) => item.key));

function cloneConfig(config: MobileMenuConfig): MobileMenuConfig {
  return JSON.parse(JSON.stringify(config)) as MobileMenuConfig;
}

function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  return next;
}

function changeTypeLabel(type?: string) {
  switch (type) {
    case "save": return "保存";
    case "reset": return "恢复默认";
    case "rollback": return "回滚";
    case "import": return "导入";
    default: return type || "变更";
  }
}

/** 前端预校验，与后端白名单规则对齐，尽量在点保存前就报错 */
export function validateMobileMenuConfig(config: MobileMenuConfig): string | null {
  if (!config.dock?.length) return "Dock 不能为空";
  if (config.dock.length > 6) return "Dock 最多 6 项";
  const dockKeys = new Set<string>();
  let hasAll = false;
  let emphasis = 0;
  for (const item of config.dock) {
    if (!item?.key) return "Dock 存在空 key";
    if (dockKeys.has(item.key)) return `Dock key 重复: ${item.key}`;
    dockKeys.add(item.key);
    if (item.key === MOBILE_MENU_ALL_KEY) hasAll = true;
    else if (!ALLOWED_PAGE_KEYS.has(item.key as MenuKey)) return `Dock 含未知页面: ${item.key}`;
    if (item.emphasis) emphasis += 1;
    if (!item.label?.trim()) return "Dock 显示名不能为空";
  }
  if (!hasAll) return "Dock 必须包含「全部」入口";
  if (emphasis > 1) return "Dock 最多一个强调按钮";
  if (!config.groups?.length) return "至少需要一个功能分组";
  const groupKeys = new Set<string>();
  for (const group of config.groups) {
    if (!group.title?.trim()) return "分组标题不能为空";
    const gk = (group.key || group.title).trim();
    if (groupKeys.has(gk)) return `分组 key 重复: ${gk}`;
    groupKeys.add(gk);
    const itemKeys = new Set<string>();
    for (const item of group.items || []) {
      if (!item?.key) return `分组「${group.title}」存在空功能 key`;
      if (String(item.key) === MOBILE_MENU_ALL_KEY) return "分组功能不能使用全部入口 key";
      if (!ALLOWED_PAGE_KEYS.has(item.key)) return `分组「${group.title}」含未知页面: ${item.key}`;
      if (itemKeys.has(item.key)) return `分组「${group.title}」功能重复: ${item.key}`;
      itemKeys.add(item.key);
    }
  }
  const href = config.extras?.toolboxHref || "";
  if (href && !(href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://"))) {
    return "工具箱链接必须以 / 或 http(s):// 开头";
  }
  return null;
}

export function MobileMenuSettingsPage({ notify }: { notify: Notify }) {
  const access = useAccess();
  const canEdit = access.has("system.mobileMenu.edit");
  const canQuery = access.has("system.mobileMenu.view") || canEdit;
  const [config, setConfig] = useState<MobileMenuConfig>(() => cloneConfig(DEFAULT_MOBILE_MENU_CONFIG));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{ updateBy?: string; updateTime?: string; remark?: string; revision?: number }>({});
  const [activeGroup, setActiveGroup] = useState(0);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [histories, setHistories] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewJson, setPreviewJson] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    if (!canQuery) return;
    setHistoryLoading(true);
    try {
      const result = await apiRequest<Record<string, unknown>>("/system/mobile-menu/history", { query: { limit: 20 } });
      const rows = (result.data ?? result) as unknown;
      setHistories(Array.isArray(rows) ? rows as HistoryRow[] : []);
    } catch {
      setHistories([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [canQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const result = await apiRequest<Record<string, unknown>>("/system/mobile-menu");
        const data = (result.data || result) as Record<string, unknown>;
        const merged = mergeMobileMenuConfig(data.config ?? data);
        setConfig(cloneConfig(merged));
        setJsonText(JSON.stringify(merged, null, 2));
        setMeta({
          updateBy: data.updateBy ? String(data.updateBy) : undefined,
          updateTime: data.updateTime ? String(data.updateTime) : undefined,
          remark: data.remark ? String(data.remark) : undefined,
          revision: data.revision !== undefined && data.revision !== null ? Number(data.revision) : undefined,
        });
      } catch {
        const result = await apiRequest<Record<string, unknown>>("/system/mobile-menu/config");
        const payload = (result.data ?? result) as unknown;
        const merged = mergeMobileMenuConfig(payload);
        setConfig(cloneConfig(merged));
        setJsonText(JSON.stringify(merged, null, 2));
        setMeta({});
      }
      await loadHistory();
    } catch (error) {
      notify(error instanceof Error ? error.message : "移动菜单加载失败", "error");
      const fallback = cloneConfig(DEFAULT_MOBILE_MENU_CONFIG);
      setConfig(fallback);
      setJsonText(JSON.stringify(fallback, null, 2));
    } finally {
      setLoading(false);
    }
  }, [loadHistory, notify]);

  useEffect(() => { void load(); }, [load]);

  const usedKeys = useMemo(() => {
    const set = new Set<string>();
    config.groups.forEach((group) => group.items.forEach((item) => set.add(item.key)));
    return set;
  }, [config.groups]);

  const localError = useMemo(() => validateMobileMenuConfig(config), [config]);

  function syncJson(next: MobileMenuConfig) {
    setJsonText(JSON.stringify(next, null, 2));
  }

  function patchDock(index: number, patch: Partial<MobileDockItemConfig>) {
    setConfig((current) => {
      const dock = current.dock.map((item, i) => {
        if (i !== index) {
          if (patch.emphasis && item.emphasis) return { ...item, emphasis: false };
          return item;
        }
        return { ...item, ...patch };
      });
      const next = { ...current, dock };
      syncJson(next);
      return next;
    });
  }

  function patchGroup(index: number, patch: Partial<MobileMenuGroupConfig>) {
    setConfig((current) => {
      const groups = current.groups.map((group, i) => (i === index ? { ...group, ...patch } : group));
      const next = { ...current, groups };
      syncJson(next);
      return next;
    });
  }

  function patchGroupItem(groupIndex: number, itemIndex: number, patch: Partial<MobileMenuItemConfig>) {
    setConfig((current) => {
      const groups = current.groups.map((group, gi) => {
        if (gi !== groupIndex) return group;
        const items = group.items.map((item, ii) => (ii === itemIndex ? { ...item, ...patch } : item));
        return { ...group, items };
      });
      const next = { ...current, groups };
      syncJson(next);
      return next;
    });
  }

  function applyConfig(next: MobileMenuConfig, revision?: number, extraMeta?: Partial<typeof meta>) {
    const merged = cloneConfig(mergeMobileMenuConfig(next));
    setConfig(merged);
    syncJson(merged);
    if (revision !== undefined || extraMeta) {
      setMeta((current) => ({
        ...current,
        ...extraMeta,
        revision: revision !== undefined ? revision : current.revision,
      }));
    }
  }

  async function save(remark?: string) {
    if (!canEdit) return notify("当前角色不能编辑移动菜单", "error");
    const error = validateMobileMenuConfig(config);
    if (error) return notify(error, "error");
    setSaving(true);
    try {
      const result = await apiRequest<Record<string, unknown>>("/system/mobile-menu", {
        method: "PUT",
        body: { config, remark: remark || "后台保存" },
      });
      const data = (result.data || result) as Record<string, unknown>;
      if (data.config) applyConfig(data.config as MobileMenuConfig, data.revision !== undefined ? Number(data.revision) : undefined, {
        updateBy: data.updateBy ? String(data.updateBy) : undefined,
        updateTime: data.updateTime ? String(data.updateTime) : undefined,
      });
      notify("移动菜单已保存", "success");
      window.dispatchEvent(new Event("xb-mobile-menu-changed"));
      await loadHistory();
    } catch (error) {
      notify(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefault() {
    if (!canEdit) return notify("当前角色不能编辑移动菜单", "error");
    if (!window.confirm("确认恢复内置默认移动菜单？当前配置将写入历史后被覆盖。")) return;
    setSaving(true);
    try {
      const result = await apiRequest<Record<string, unknown>>("/system/mobile-menu/reset", { method: "DELETE" });
      const payload = (result.data ?? result) as unknown;
      applyConfig(mergeMobileMenuConfig(payload));
      notify("已恢复默认配置", "success");
      window.dispatchEvent(new Event("xb-mobile-menu-changed"));
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "重置失败", "error");
    } finally {
      setSaving(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mobile-menu-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("已导出 JSON", "success");
  }

  async function importFile(file: File) {
    if (!canEdit) return notify("当前角色不能导入", "error");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const merged = mergeMobileMenuConfig((parsed as { config?: unknown })?.config ?? parsed);
      const error = validateMobileMenuConfig(merged);
      if (error) return notify(`导入校验失败：${error}`, "error");
      setSaving(true);
      const result = await apiRequest<Record<string, unknown>>("/system/mobile-menu/import", {
        method: "POST",
        body: { config: merged, remark: `导入文件 ${file.name}` },
      });
      const data = (result.data || result) as Record<string, unknown>;
      if (data.config) applyConfig(data.config as MobileMenuConfig, data.revision !== undefined ? Number(data.revision) : undefined);
      else applyConfig(merged);
      notify("导入成功", "success");
      window.dispatchEvent(new Event("xb-mobile-menu-changed"));
      await loadHistory();
    } catch (error) {
      notify(error instanceof Error ? error.message : "导入失败", "error");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applyJsonEditor() {
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      const merged = mergeMobileMenuConfig(parsed);
      const error = validateMobileMenuConfig(merged);
      if (error) return notify(error, "error");
      setConfig(cloneConfig(merged));
      notify("JSON 已应用到编辑器，记得保存", "info");
    } catch {
      notify("JSON 格式无效", "error");
    }
  }

  async function openHistory(id: number) {
    setPreviewId(id);
    setPreviewJson("加载中…");
    try {
      const result = await apiRequest<Record<string, unknown>>(`/system/mobile-menu/history/${id}`);
      const data = (result.data || result) as Record<string, unknown>;
      setPreviewJson(JSON.stringify(data.config ?? data, null, 2));
    } catch (error) {
      setPreviewJson(error instanceof Error ? error.message : "加载失败");
    }
  }

  async function rollback(id: number) {
    if (!canEdit) return notify("当前角色不能回滚", "error");
    if (!window.confirm(`确认回滚到历史 #${id}？当前配置会先进入历史。`)) return;
    setSaving(true);
    try {
      const result = await apiRequest<Record<string, unknown>>(`/system/mobile-menu/history/${id}/rollback`, { method: "POST" });
      const data = (result.data || result) as Record<string, unknown>;
      if (data.config) applyConfig(data.config as MobileMenuConfig, data.revision !== undefined ? Number(data.revision) : undefined);
      notify(`已回滚到 #${id}`, "success");
      window.dispatchEvent(new Event("xb-mobile-menu-changed"));
      setPreviewId(null);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "回滚失败", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><LoaderCircle className="spin" size={28} /><h3>正在加载移动菜单</h3><p>请稍候…</p></div>;
  }

  const group = config.groups[activeGroup];

  return (
    <div className="module-page">
      <div className="module-hero compact-hero">
        <div>
          <span className="eyebrow">系统运行</span>
          <h1>移动菜单</h1>
          <p>一步到位：可视化编辑 + JSON 导入导出 + 历史回滚。与 PC 菜单管理分离。</p>
        </div>
      </div>

      <div className="secondary-actions">
        <button type="button" onClick={() => void load()}><RefreshCw size={16} />刷新</button>
        <button type="button" onClick={exportJson}><Download size={16} />导出 JSON</button>
        {canEdit ? (
          <>
            <button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />导入 JSON</button>
            <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }} />
            <button type="button" onClick={() => void resetDefault()}><RotateCcw size={16} />恢复默认</button>
            <button type="button" className={showJson ? "active" : ""} onClick={() => setShowJson((v) => !v)}><Braces size={16} />JSON</button>
            <button type="button" className="button button-primary" disabled={saving || !!localError} onClick={() => void save()}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              保存
            </button>
          </>
        ) : null}
      </div>

      <div className="list-heading">
        <div>
          <h2>当前配置</h2>
          <span>
            {meta.revision !== undefined ? `修订 #${meta.revision}` : "本地/默认"}
            {meta.updateBy ? ` · ${meta.updateBy}` : ""}
            {meta.updateTime ? ` · ${meta.updateTime}` : ""}
          </span>
        </div>
      </div>

      {localError ? (
        <div className="tracking-guide" style={{ marginBottom: 12, borderColor: "#f0b4b4", background: "#fff5f5" }}>
          <div>
            <b>校验未通过</b>
            <p>{localError}</p>
          </div>
        </div>
      ) : null}

      {!canEdit ? (
        <div className="tracking-guide" style={{ marginBottom: 12 }}>
          <div>
            <b>只读模式</b>
            <p>当前账号没有 system:mobileMenu:edit 权限，只能查看/导出。</p>
          </div>
        </div>
      ) : null}

      {showJson ? (
        <section className="data-card" style={{ marginBottom: 12 }}>
          <div className="data-card-head">
            <div><b>JSON 编辑</b><small>可直接改 JSON，点「应用到编辑器」后再保存</small></div>
            {canEdit ? <button type="button" className="button button-soft" onClick={applyJsonEditor}>应用到编辑器</button> : null}
          </div>
          <textarea
            className="mobile-menu-json"
            value={jsonText}
            disabled={!canEdit}
            rows={18}
            spellCheck={false}
            onChange={(event) => setJsonText(event.target.value)}
          />
        </section>
      ) : null}

      <section className="data-card" style={{ marginBottom: 12 }}>
        <div className="data-card-head">
          <div><b>底部 Dock</b><small>建议 4~5 项，必须保留「全部」；最多 1 个强调按钮</small></div>
          {canEdit ? (
            <button
              type="button"
              className="button button-soft"
              onClick={() => setConfig((current) => {
                const next = {
                  ...current,
                  dock: [...current.dock, { key: "tracking" as MenuKey, label: "查询", icon: "search" }],
                };
                syncJson(next);
                return next;
              })}
            ><Plus size={15} />添加</button>
          ) : null}
        </div>
        <div className="mobile-menu-editor-list">
          {config.dock.map((item, index) => (
            <div className="mobile-menu-editor-row" key={`dock-${index}-${item.key}`}>
              <select
                value={item.key}
                disabled={!canEdit || item.key === MOBILE_MENU_ALL_KEY}
                onChange={(event) => patchDock(index, { key: event.target.value as MobileDockItemConfig["key"] })}
              >
                <option value={MOBILE_MENU_ALL_KEY}>全部功能入口</option>
                {PAGE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
              <input value={item.label} disabled={!canEdit} placeholder="显示名" onChange={(event) => patchDock(index, { label: event.target.value })} />
              <input value={item.icon || ""} disabled={!canEdit} placeholder="图标 house/plus" onChange={(event) => patchDock(index, { icon: event.target.value })} />
              <label className="mobile-menu-check">
                <input
                  type="checkbox"
                  disabled={!canEdit || item.key === MOBILE_MENU_ALL_KEY}
                  checked={!!item.emphasis}
                  onChange={(event) => patchDock(index, { emphasis: event.target.checked })}
                />
                强调
              </label>
              <div className="mobile-menu-row-actions">
                <button type="button" disabled={!canEdit} onClick={() => setConfig((c) => { const next = { ...c, dock: moveItem(c.dock, index, -1) }; syncJson(next); return next; })} aria-label="上移"><ArrowUp size={15} /></button>
                <button type="button" disabled={!canEdit} onClick={() => setConfig((c) => { const next = { ...c, dock: moveItem(c.dock, index, 1) }; syncJson(next); return next; })} aria-label="下移"><ArrowDown size={15} /></button>
                <button
                  type="button"
                  className="danger"
                  disabled={!canEdit || item.key === MOBILE_MENU_ALL_KEY || config.dock.length <= 2}
                  onClick={() => setConfig((c) => { const next = { ...c, dock: c.dock.filter((_, i) => i !== index) }; syncJson(next); return next; })}
                  aria-label="删除"
                ><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="data-card" style={{ marginBottom: 12 }}>
        <div className="data-card-head">
          <div><b>全部功能分组</b><small>未知 page key 会被后端拒绝；无权限项运行时自动隐藏</small></div>
          {canEdit ? (
            <button
              type="button"
              className="button button-soft"
              onClick={() => {
                setConfig((current) => {
                  const next = {
                    ...current,
                    groups: [...current.groups, { key: `group_${Date.now().toString(36)}`, title: "新分组", description: "", items: [] }],
                  };
                  syncJson(next);
                  return next;
                });
                setActiveGroup(config.groups.length);
              }}
            ><Plus size={15} />新分组</button>
          ) : null}
        </div>

        <div className="mobile-menu-group-tabs">
          {config.groups.map((entry, index) => (
            <button type="button" key={entry.key || index} className={index === activeGroup ? "active" : ""} onClick={() => setActiveGroup(index)}>
              {entry.title || `分组${index + 1}`}
            </button>
          ))}
        </div>

        {group ? (
          <div className="mobile-menu-group-editor">
            <div className="mobile-menu-editor-row">
              <input value={group.title} disabled={!canEdit} placeholder="分组标题" onChange={(event) => patchGroup(activeGroup, { title: event.target.value })} />
              <input value={group.description || ""} disabled={!canEdit} placeholder="分组描述" onChange={(event) => patchGroup(activeGroup, { description: event.target.value })} />
              <div className="mobile-menu-row-actions">
                <button type="button" disabled={!canEdit} onClick={() => { setConfig((c) => { const next = { ...c, groups: moveItem(c.groups, activeGroup, -1) }; syncJson(next); return next; }); setActiveGroup((v) => Math.max(0, v - 1)); }} aria-label="分组上移"><ArrowUp size={15} /></button>
                <button type="button" disabled={!canEdit} onClick={() => { setConfig((c) => { const next = { ...c, groups: moveItem(c.groups, activeGroup, 1) }; syncJson(next); return next; }); setActiveGroup((v) => Math.min(config.groups.length - 1, v + 1)); }} aria-label="分组下移"><ArrowDown size={15} /></button>
                <button
                  type="button"
                  className="danger"
                  disabled={!canEdit || config.groups.length <= 1}
                  onClick={() => {
                    setConfig((c) => { const next = { ...c, groups: c.groups.filter((_, i) => i !== activeGroup) }; syncJson(next); return next; });
                    setActiveGroup((v) => Math.max(0, v - 1));
                  }}
                  aria-label="删除分组"
                ><Trash2 size={15} /></button>
              </div>
            </div>

            <div className="list-heading" style={{ marginTop: 8 }}>
              <div><h2>功能项</h2><span>{group.items.length} 个</span></div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextPage = PAGE_OPTIONS.find((option) => !usedKeys.has(option.key)) || PAGE_OPTIONS[0];
                    if (!nextPage) return;
                    patchGroup(activeGroup, { items: [...group.items, { key: nextPage.key }] });
                  }}
                ><Plus size={15} />添加功能</button>
              ) : null}
            </div>

            <div className="mobile-menu-editor-list">
              {group.items.map((item, itemIndex) => (
                <div className="mobile-menu-editor-row" key={`${group.key}-${itemIndex}-${item.key}`}>
                  <select
                    value={item.key}
                    disabled={!canEdit}
                    onChange={(event) => patchGroupItem(activeGroup, itemIndex, { key: event.target.value as MobileMenuItemConfig["key"] })}
                  >
                    {PAGE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                  <input value={item.label || ""} disabled={!canEdit} placeholder="覆盖标题（可选）" onChange={(event) => patchGroupItem(activeGroup, itemIndex, { label: event.target.value })} />
                  <input value={item.description || ""} disabled={!canEdit} placeholder="覆盖描述（可选）" onChange={(event) => patchGroupItem(activeGroup, itemIndex, { description: event.target.value })} />
                  <div className="mobile-menu-row-actions">
                    <button type="button" disabled={!canEdit} onClick={() => patchGroup(activeGroup, { items: moveItem(group.items, itemIndex, -1) })} aria-label="上移"><ArrowUp size={15} /></button>
                    <button type="button" disabled={!canEdit} onClick={() => patchGroup(activeGroup, { items: moveItem(group.items, itemIndex, 1) })} aria-label="下移"><ArrowDown size={15} /></button>
                    <button type="button" className="danger" disabled={!canEdit} onClick={() => patchGroup(activeGroup, { items: group.items.filter((_, i) => i !== itemIndex) })} aria-label="删除"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              {!group.items.length ? <p className="sysm-empty-note">该分组还没有功能，点右上角添加</p> : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="data-card" style={{ marginBottom: 12 }}>
        <div className="data-card-head"><div><b>顶部附加入口</b><small>全部功能页顶部的工作台 / 工具箱</small></div></div>
        <div className="mobile-menu-editor-list">
          <label className="mobile-menu-check">
            <input type="checkbox" disabled={!canEdit} checked={config.extras.showHomeEntry} onChange={(event) => setConfig((c) => { const next = { ...c, extras: { ...c.extras, showHomeEntry: event.target.checked } }; syncJson(next); return next; })} />
            显示工作台入口
          </label>
          <label className="mobile-menu-check">
            <input type="checkbox" disabled={!canEdit} checked={config.extras.showToolboxEntry} onChange={(event) => setConfig((c) => { const next = { ...c, extras: { ...c.extras, showToolboxEntry: event.target.checked } }; syncJson(next); return next; })} />
            显示工具箱入口
          </label>
          <div className="mobile-menu-editor-row">
            <input disabled={!canEdit} value={config.extras.homeLabel} onChange={(event) => setConfig((c) => { const next = { ...c, extras: { ...c.extras, homeLabel: event.target.value } }; syncJson(next); return next; })} placeholder="工作台标题" />
            <input disabled={!canEdit} value={config.extras.homeDescription} onChange={(event) => setConfig((c) => { const next = { ...c, extras: { ...c.extras, homeDescription: event.target.value } }; syncJson(next); return next; })} placeholder="工作台描述" />
          </div>
          <div className="mobile-menu-editor-row">
            <input disabled={!canEdit} value={config.extras.toolboxLabel} onChange={(event) => setConfig((c) => { const next = { ...c, extras: { ...c.extras, toolboxLabel: event.target.value } }; syncJson(next); return next; })} placeholder="工具箱标题" />
            <input disabled={!canEdit} value={config.extras.toolboxDescription} onChange={(event) => setConfig((c) => { const next = { ...c, extras: { ...c.extras, toolboxDescription: event.target.value } }; syncJson(next); return next; })} placeholder="工具箱描述" />
            <input disabled={!canEdit} value={config.extras.toolboxHref} onChange={(event) => setConfig((c) => { const next = { ...c, extras: { ...c.extras, toolboxHref: event.target.value } }; syncJson(next); return next; })} placeholder="/tools" />
          </div>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-head">
          <div><b><History size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />历史版本</b><small>最近 20 条；回滚会生成新历史，不会丢当前版</small></div>
          <button type="button" className="button button-soft" onClick={() => void loadHistory()} disabled={historyLoading}>
            {historyLoading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
            刷新历史
          </button>
        </div>
        <div className="mobile-menu-history-list">
          {histories.map((row) => (
            <article key={row.id} className={`mobile-menu-history-row${previewId === row.id ? " active" : ""}`}>
              <div>
                <b>#{row.id} · {changeTypeLabel(row.changeType)}</b>
                <small>
                  {row.createBy || "unknown"}
                  {row.createTime ? ` · ${row.createTime}` : ""}
                  {row.remark ? ` · ${row.remark}` : ""}
                </small>
              </div>
              <div className="mobile-menu-row-actions">
                <button type="button" onClick={() => void openHistory(row.id)} aria-label="预览">预览</button>
                {canEdit ? <button type="button" onClick={() => void rollback(row.id)} aria-label="回滚">回滚</button> : null}
              </div>
            </article>
          ))}
          {!histories.length ? <p className="sysm-empty-note">暂无历史。保存/导入/重置后会出现。</p> : null}
        </div>
        {previewId !== null ? (
          <div className="mobile-menu-history-preview">
            <div className="data-card-head">
              <div><b>历史 #{previewId}</b><small>只读预览</small></div>
              <button type="button" className="button button-soft" onClick={() => setPreviewId(null)}>关闭</button>
            </div>
            <pre className="mobile-menu-json-pre">{previewJson}</pre>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default MobileMenuSettingsPage;
