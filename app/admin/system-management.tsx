import {
  ArrowLeft,
  Bell,
  BookKey,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  KeyRound,
  ListTree,
  LoaderCircle,
  Menu as MenuIcon,
  Pencil,
  Plus,
  RefreshCw,
  Check,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiRequest, downloadFile, uploadFile } from "../lib/api";
import { useAccess } from "./access";
import { ConfirmDialog, EmptyState, Sheet } from "./ui";

type DataRow = Record<string, any>;
type ModuleKey =
  | "users"
  | "roles"
  | "depts"
  | "posts"
  | "menus"
  | "dictTypes"
  | "dictData"
  | "configs"
  | "notices";
type Notice = { message: string; type: "success" | "error" | "info" } | null;
type Notify = (message: string, type?: "success" | "error" | "info") => void;
type FieldType = "text" | "password" | "email" | "tel" | "number" | "textarea" | "select";

type FieldConfig = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  createOnly?: boolean;
  readonly?: boolean;
  options?: Array<{ label: string; value: string }>;
};

type ColumnConfig = {
  key: string;
  label: string;
  format?: (row: DataRow) => string;
};

type ModuleConfig = {
  key: ModuleKey;
  title: string;
  description: string;
  icon: LucideIcon;
  listPath: string;
  resourcePath: string;
  idKey: string;
  nameKey: string;
  defaults: DataRow;
  search: FieldConfig[];
  fields: FieldConfig[];
  columns: ColumnConfig[];
  cachePath?: string;
};

function capabilityResource(key: ModuleKey) {
  if (key === "dictTypes" || key === "dictData") return "dictionaries";
  return key;
}

const STATUS_OPTIONS = [
  { label: "正常", value: "0" },
  { label: "停用", value: "1" },
];
const YES_NO_OPTIONS = [
  { label: "是", value: "Y" },
  { label: "否", value: "N" },
];

const MODULES: Record<Exclude<ModuleKey, "dictData">, ModuleConfig> = {
  users: {
    key: "users",
    title: "成员",
    description: "登录账号、使用状态与所属角色",
    icon: Users,
    listPath: "/system/user/list",
    resourcePath: "/system/user",
    idKey: "userId",
    nameKey: "userName",
    defaults: { status: "0", sex: "2", roleIds: [], postIds: [] },
    search: [
      { key: "userName", label: "用户名" },
      { key: "phonenumber", label: "手机号", type: "tel" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    fields: [
      { key: "userName", label: "用户名", required: true, createOnly: true },
      { key: "password", label: "初始密码", type: "password", required: true, createOnly: true },
      { key: "nickName", label: "成员姓名", required: true },
      { key: "phonenumber", label: "手机号", type: "tel" },
      { key: "email", label: "邮箱", type: "email" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
      { key: "remark", label: "备注", type: "textarea" },
    ],
    columns: [
      { key: "userName", label: "用户名" },
      { key: "nickName", label: "姓名" },
      { key: "phonenumber", label: "手机号" },
      { key: "status", label: "状态", format: statusLabel },
      { key: "createTime", label: "创建时间" },
    ],
  },
  roles: {
    key: "roles",
    title: "角色",
    description: "一组可复用的功能权限",
    icon: ShieldCheck,
    listPath: "/system/role/list",
    resourcePath: "/system/role",
    idKey: "roleId",
    nameKey: "roleName",
    defaults: { roleSort: 0, status: "0" },
    search: [
      { key: "roleName", label: "角色名称" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    fields: [
      { key: "roleName", label: "角色名称", required: true },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
      { key: "remark", label: "备注", type: "textarea" },
    ],
    columns: [
      { key: "roleName", label: "角色名称" },
      { key: "status", label: "状态", format: statusLabel },
      { key: "createTime", label: "创建时间" },
    ],
  },
  depts: {
    key: "depts",
    title: "部门管理",
    description: "维护组织架构与负责人",
    icon: Building2,
    listPath: "/system/dept/list",
    resourcePath: "/system/dept",
    idKey: "deptId",
    nameKey: "deptName",
    defaults: { parentId: 0, orderNum: 0, status: "0" },
    search: [
      { key: "deptName", label: "部门名称" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    fields: [
      { key: "parentId", label: "上级部门 ID", type: "number", required: true },
      { key: "deptName", label: "部门名称", required: true },
      { key: "orderNum", label: "显示顺序", type: "number", required: true },
      { key: "leader", label: "负责人" },
      { key: "phone", label: "联系电话", type: "tel" },
      { key: "email", label: "邮箱", type: "email" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    columns: [
      { key: "deptName", label: "部门名称" },
      { key: "orderNum", label: "排序" },
      { key: "leader", label: "负责人" },
      { key: "phone", label: "电话" },
      { key: "status", label: "状态", format: statusLabel },
    ],
  },
  posts: {
    key: "posts",
    title: "岗位管理",
    description: "岗位编码、顺序与状态",
    icon: BriefcaseBusiness,
    listPath: "/system/post/list",
    resourcePath: "/system/post",
    idKey: "postId",
    nameKey: "postName",
    defaults: { postSort: 0, status: "0" },
    search: [
      { key: "postCode", label: "岗位编码" },
      { key: "postName", label: "岗位名称" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    fields: [
      { key: "postName", label: "岗位名称", required: true },
      { key: "postCode", label: "岗位编码", required: true },
      { key: "postSort", label: "岗位顺序", type: "number", required: true },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
      { key: "remark", label: "备注", type: "textarea" },
    ],
    columns: [
      { key: "postCode", label: "岗位编码" },
      { key: "postName", label: "岗位名称" },
      { key: "postSort", label: "排序" },
      { key: "status", label: "状态", format: statusLabel },
      { key: "createTime", label: "创建时间" },
    ],
  },
  menus: {
    key: "menus",
    title: "菜单管理",
    description: "目录、页面与按钮权限",
    icon: MenuIcon,
    listPath: "/system/menu/list",
    resourcePath: "/system/menu",
    idKey: "menuId",
    nameKey: "menuName",
    defaults: { parentId: 0, orderNum: 0, menuType: "C", visible: "0", status: "0", isFrame: "1", isCache: "0" },
    search: [
      { key: "menuName", label: "菜单名称" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    fields: [
      { key: "parentId", label: "上级菜单 ID", type: "number", required: true },
      {
        key: "menuType",
        label: "菜单类型",
        type: "select",
        options: [
          { label: "目录", value: "M" },
          { label: "菜单", value: "C" },
          { label: "按钮", value: "F" },
        ],
      },
      { key: "menuName", label: "菜单名称", required: true },
      { key: "orderNum", label: "显示顺序", type: "number", required: true },
      { key: "icon", label: "图标" },
      { key: "path", label: "路由地址" },
      { key: "component", label: "组件路径" },
      { key: "perms", label: "权限标识" },
      {
        key: "isFrame",
        label: "是否外链",
        type: "select",
        options: [
          { label: "否", value: "1" },
          { label: "是", value: "0" },
        ],
      },
      {
        key: "isCache",
        label: "是否缓存",
        type: "select",
        options: [
          { label: "缓存", value: "0" },
          { label: "不缓存", value: "1" },
        ],
      },
      {
        key: "visible",
        label: "显示状态",
        type: "select",
        options: [
          { label: "显示", value: "0" },
          { label: "隐藏", value: "1" },
        ],
      },
      { key: "status", label: "菜单状态", type: "select", options: STATUS_OPTIONS },
      { key: "remark", label: "备注", type: "textarea" },
    ],
    columns: [
      { key: "menuName", label: "菜单名称" },
      { key: "menuType", label: "类型", format: menuTypeLabel },
      { key: "path", label: "路由" },
      { key: "perms", label: "权限标识" },
      { key: "status", label: "状态", format: statusLabel },
    ],
  },
  dictTypes: {
    key: "dictTypes",
    title: "字典管理",
    description: "字典类型与数据项维护",
    icon: BookKey,
    listPath: "/system/dict/type/list",
    resourcePath: "/system/dict/type",
    idKey: "dictId",
    nameKey: "dictName",
    defaults: { status: "0" },
    search: [
      { key: "dictName", label: "字典名称" },
      { key: "dictType", label: "字典类型" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    fields: [
      { key: "dictName", label: "字典名称", required: true },
      { key: "dictType", label: "字典类型", required: true },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
      { key: "remark", label: "备注", type: "textarea" },
    ],
    columns: [
      { key: "dictName", label: "字典名称" },
      { key: "dictType", label: "字典类型" },
      { key: "status", label: "状态", format: statusLabel },
      { key: "createTime", label: "创建时间" },
    ],
    cachePath: "/system/dict/type/refreshCache",
  },
  configs: {
    key: "configs",
    title: "参数设置",
    description: "系统参数与运行时缓存",
    icon: Settings2,
    listPath: "/system/config/list",
    resourcePath: "/system/config",
    idKey: "configId",
    nameKey: "configName",
    defaults: { configType: "N" },
    search: [
      { key: "configName", label: "参数名称" },
      { key: "configKey", label: "参数键名" },
      { key: "configType", label: "系统内置", type: "select", options: YES_NO_OPTIONS },
    ],
    fields: [
      { key: "configName", label: "参数名称", required: true },
      { key: "configKey", label: "参数键名", required: true },
      { key: "configValue", label: "参数键值", required: true },
      { key: "configType", label: "系统内置", type: "select", options: YES_NO_OPTIONS },
      { key: "remark", label: "备注", type: "textarea" },
    ],
    columns: [
      { key: "configName", label: "参数名称" },
      { key: "configKey", label: "参数键名" },
      { key: "configValue", label: "参数键值" },
      { key: "configType", label: "系统内置", format: (row) => String(row.configType) === "Y" ? "是" : "否" },
      { key: "createTime", label: "创建时间" },
    ],
    cachePath: "/system/config/refreshCache",
  },
  notices: {
    key: "notices",
    title: "通知公告",
    description: "发布系统通知与公告",
    icon: Bell,
    listPath: "/system/notice/list",
    resourcePath: "/system/notice",
    idKey: "noticeId",
    nameKey: "noticeTitle",
    defaults: { noticeType: "1", status: "0" },
    search: [
      { key: "noticeTitle", label: "公告标题" },
      { key: "createBy", label: "操作人员" },
      {
        key: "noticeType",
        label: "类型",
        type: "select",
        options: [
          { label: "通知", value: "1" },
          { label: "公告", value: "2" },
        ],
      },
    ],
    fields: [
      { key: "noticeTitle", label: "公告标题", required: true },
      {
        key: "noticeType",
        label: "公告类型",
        type: "select",
        options: [
          { label: "通知", value: "1" },
          { label: "公告", value: "2" },
        ],
      },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: [
          { label: "正常", value: "0" },
          { label: "关闭", value: "1" },
        ],
      },
      { key: "noticeContent", label: "内容", type: "textarea", required: true },
    ],
    columns: [
      { key: "noticeTitle", label: "标题" },
      { key: "noticeType", label: "类型", format: (row) => String(row.noticeType) === "2" ? "公告" : "通知" },
      { key: "status", label: "状态", format: (row) => String(row.status) === "0" ? "正常" : "关闭" },
      { key: "createBy", label: "创建者" },
      { key: "createTime", label: "创建时间" },
    ],
  },
};

function dictDataConfig(dictType: string): ModuleConfig {
  return {
    key: "dictData",
    title: "字典数据",
    description: dictType || "维护字典数据项",
    icon: ListTree,
    listPath: "/system/dict/data/list",
    resourcePath: "/system/dict/data",
    idKey: "dictCode",
    nameKey: "dictLabel",
    defaults: { dictType, dictSort: 0, status: "0", listClass: "default" },
    search: [
      { key: "dictLabel", label: "字典标签" },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
    ],
    fields: [
      { key: "dictType", label: "字典类型", required: true, readonly: true },
      { key: "dictLabel", label: "数据标签", required: true },
      { key: "dictValue", label: "数据键值", required: true },
      { key: "dictSort", label: "显示排序", type: "number", required: true },
      { key: "cssClass", label: "样式属性" },
      {
        key: "listClass",
        label: "回显样式",
        type: "select",
        options: ["default", "primary", "success", "info", "warning", "danger"].map((value) => ({ label: value, value })),
      },
      { key: "status", label: "状态", type: "select", options: STATUS_OPTIONS },
      { key: "remark", label: "备注", type: "textarea" },
    ],
    columns: [
      { key: "dictLabel", label: "字典标签" },
      { key: "dictValue", label: "字典键值" },
      { key: "dictSort", label: "排序" },
      { key: "status", label: "状态", format: statusLabel },
      { key: "createTime", label: "创建时间" },
    ],
  };
}

function statusLabel(row: DataRow) {
  return String(row.status) === "0" ? "正常" : "停用";
}

function menuTypeLabel(row: DataRow) {
  return ({ M: "目录", C: "菜单", F: "按钮" } as Record<string, string>)[String(row.menuType)] || "--";
}

function textValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

function extractRows(result: DataRow) {
  if (Array.isArray(result.rows)) return result.rows as DataRow[];
  if (Array.isArray(result.data)) return result.data as DataRow[];
  if (Array.isArray(result)) return result as DataRow[];
  return [];
}

function isTreeModule(key: ModuleKey) {
  return key === "menus" || key === "depts";
}

type ResourceTreeNode = DataRow & { children: ResourceTreeNode[] };

function buildResourceTree(list: DataRow[], idKey: string, parentKey = "parentId", rootParent: unknown = 0): ResourceTreeNode[] {
  const map = new Map<string, ResourceTreeNode>();
  list.forEach((item) => map.set(String(item[idKey]), { ...item, children: [] }));
  const roots: ResourceTreeNode[] = [];
  map.forEach((node) => {
    const pid = String(node[parentKey] ?? rootParent);
    if (pid === String(rootParent) || pid === "0" || pid === "" || !map.has(pid)) roots.push(node);
    else map.get(pid)!.children.push(node);
  });
  const sortNodes = (nodes: ResourceTreeNode[]) => {
    nodes.sort((a, b) => Number(a.orderNum ?? a.order_num ?? 0) - Number(b.orderNum ?? b.order_num ?? 0));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}

function filterResourceTree(nodes: ResourceTreeNode[], keyword: string, nameKey: string): ResourceTreeNode[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return nodes;
  const walk = (list: ResourceTreeNode[]): ResourceTreeNode[] => list.flatMap((node) => {
    const children = walk(node.children || []);
    const hit = `${node[nameKey] || ""} ${node.path || ""} ${node.perms || ""} ${node.leader || ""} ${node.phone || ""}`.toLowerCase().includes(q);
    if (hit || children.length) return [{ ...node, children }];
    return [];
  });
  return walk(nodes);
}

type TreeNode = { id: number; label: string; children?: TreeNode[] };

function normalizeTreeNodes(nodes: unknown): TreeNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node: DataRow) => ({
    id: Number(node.id ?? node.menuId ?? node.deptId ?? 0),
    label: String(node.label ?? node.menuName ?? node.deptName ?? node.name ?? "未命名"),
    children: normalizeTreeNodes(node.children),
  }));
}

function flattenTree(nodes: TreeNode[], depth = 0, result: Array<TreeNode & { depth: number }> = []) {
  nodes.forEach((node) => {
    result.push({ ...node, depth });
    flattenTree(node.children || [], depth + 1, result);
  });
  return result;
}

function checkedKeys(result: DataRow) {
  const values = result.checkedKeys ?? result.data?.checkedKeys ?? [];
  return new Set<number>(Array.isArray(values) ? values.map(Number) : []);
}

function TreePicker({ nodes, checked, onChange }: { nodes: TreeNode[]; checked: Set<number>; onChange: (next: Set<number>) => void }) {
  return (
    <div className="sysm-tree-picker">
      {flattenTree(nodes).map((node) => (
        <label className="sysm-tree-option" key={node.id} style={{ paddingInlineStart: `${node.depth * 18 + 8}px` }}>
          <input
            type="checkbox"
            checked={checked.has(node.id)}
            onChange={() => {
              const next = new Set(checked);
              if (next.has(node.id)) next.delete(node.id);
              else next.add(node.id);
              onChange(next);
            }}
          />
          <span>{node.label}</span>
        </label>
      ))}
      {!nodes.length ? <p className="sysm-empty-note">暂无可选数据</p> : null}
    </div>
  );
}

function nodeIds(node: TreeNode): number[] {
  return [node.id, ...(node.children || []).flatMap(nodeIds)];
}

function FeaturePicker({ nodes, checked, onChange }: { nodes: TreeNode[]; checked: Set<number>; onChange: (next: Set<number>) => void }) {
  const allIds = nodes.flatMap(nodeIds);
  const toggleIds = (ids: number[], enabled: boolean) => {
    const next = new Set(checked);
    ids.forEach((id) => enabled ? next.add(id) : next.delete(id));
    onChange(next);
  };
  return (
    <div className="sysm-feature-picker">
      <header><div><b>功能范围</b><small>整组选择，展开后可精细到具体操作</small></div><span><button type="button" onClick={() => toggleIds(allIds, true)}>全选</button><button type="button" onClick={() => onChange(new Set())}>清空</button></span></header>
      {nodes.map((node) => {
        const ids = nodeIds(node);
        const selected = ids.filter((id) => checked.has(id)).length;
        const allSelected = selected === ids.length;
        return <details className="sysm-feature-group" key={node.id}>
          <summary>
            <input type="checkbox" checked={allSelected} onClick={(event) => event.stopPropagation()} onChange={(event) => toggleIds(ids, event.target.checked)} aria-label={`选择${node.label}`} />
            <span><b>{node.label}</b><small>{selected ? `已选 ${selected} / ${ids.length}` : "未开放"}</small></span>
            <ChevronRight size={17} />
          </summary>
          <div>{flattenTree(node.children || []).map((child) => <label className="sysm-feature-option" key={child.id} style={{ paddingInlineStart: `${child.depth * 16 + 10}px` }}><input type="checkbox" checked={checked.has(child.id)} onChange={(event) => toggleIds([child.id], event.target.checked)} /><span>{child.label}</span></label>)}</div>
        </details>;
      })}
      {!nodes.length ? <p className="sysm-empty-note">暂无可选功能</p> : null}
    </div>
  );
}

function Field({ config, value, onChange, options }: { config: FieldConfig; value: unknown; onChange: (value: unknown) => void; options?: FieldConfig["options"] }) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return (
    <label className={`mobile-form-field ${config.type === "textarea" ? "sysm-field-wide" : ""}`}>
      <span>{config.label}{config.required ? " *" : ""}</span>
      {config.type === "textarea" ? (
        <textarea rows={5} value={normalized} disabled={config.readonly} onChange={(event) => onChange(event.target.value)} />
      ) : config.type === "select" ? (
        <select value={normalized} disabled={config.readonly} onChange={(event) => onChange(event.target.value)}>
          <option value="">请选择</option>
          {(options || config.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input
          type={config.type || "text"}
          value={normalized}
          disabled={config.readonly}
          onChange={(event) => onChange(config.type === "number" ? Number(event.target.value) : event.target.value)}
        />
      )}
    </label>
  );
}


function ResourceTreeList({
  nodes,
  config,
  onEdit,
  onRemove,
  // onOpenDictData 由 dictTypes 模块单独用，这里不消费；保留形参以免破坏其它调用方
  onOpenDictData: _onOpenDictData,
}: {
  nodes: ResourceTreeNode[];
  config: ModuleConfig;
  onEdit: (row: DataRow) => void;
  onRemove: (row: DataRow) => void;
  onOpenDictData?: (type: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.map((n) => String(n[config.idKey]))));
  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      nodes.forEach((n) => next.add(String(n[config.idKey])));
      return next;
    });
  }, [nodes, config.idKey]);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: ResourceTreeNode, depth: number): ReactNode => {
    const id = String(node[config.idKey]);
    const hasChildren = (node.children || []).length > 0;
    const open = expanded.has(id);
    const subtitle = config.key === "menus"
      ? [menuTypeLabel(node), node.path, node.perms].filter(Boolean).map(String).filter((v) => v && v !== "--").join(" · ")
      : [node.leader, node.phone, node.email].filter(Boolean).map(String).filter((v) => v && v !== "--").join(" · ");
    return (
      <div className="sysm-tree-node" key={id} style={{ marginLeft: depth ? Math.min(depth, 4) * 10 : 0 }}>
        <div className="sysm-tree-row">
          <button
            className={`sysm-tree-toggle${hasChildren ? (open ? " is-open" : "") : " is-leaf"}`}
            type="button"
            aria-label={open ? "收起" : "展开"}
            onClick={() => hasChildren && toggle(id)}
          >
            <ChevronRight size={15} />
          </button>
          <div className="sysm-tree-main">
            <b>{textValue(node[config.nameKey])}</b>
            {subtitle ? <small>{subtitle}</small> : <small>#{id}</small>}
            <div className="sysm-tree-meta">
              {node.status !== undefined && node.status !== null && node.status !== "" ? (
                <span>{String(node.status) === "0" ? "正常" : "停用"}</span>
              ) : null}
              {node.orderNum !== undefined && node.orderNum !== null && node.orderNum !== "" ? <span>排序 {String(node.orderNum)}</span> : null}
              {hasChildren ? <span>{node.children.length} 子级</span> : null}
            </div>
          </div>
          <div className="sysm-tree-actions">
            <button type="button" aria-label="编辑" onClick={() => onEdit(node)}><Pencil size={15} /></button>
            {Number(node[config.idKey]) !== 1 ? (
              <button type="button" className="danger" aria-label="删除" onClick={() => onRemove(node)}><Trash2 size={15} /></button>
            ) : null}
          </div>
        </div>
        {hasChildren && open ? (
          <div className="sysm-tree-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return <div className="sysm-tree-list">{nodes.map((node) => renderNode(node, 0))}</div>;
}

function ResourceModule({
  config,
  dictType,
  onBack,
  onOpenDictData,
  notify,
}: {
  config: ModuleConfig;
  dictType: string;
  onBack: () => void;
  onOpenDictData: (type: string) => void;
  notify: Notify;
}) {
  const access = useAccess();
  const capability = (action: "view" | "create" | "edit" | "delete") => access.has(`system.${capabilityResource(config.key)}.${action}`);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageNum, setPageNum] = useState(1);
  const pageSize = 10;
  const [draftFilters, setDraftFilters] = useState<DataRow>({});
  const [filters, setFilters] = useState<DataRow>({});
  const [reloadToken, setReloadToken] = useState(0);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [form, setForm] = useState<DataRow>({});
  const [saving, setSaving] = useState(false);
  const [userRoles, setUserRoles] = useState<DataRow[]>([]);
  const [resetUser, setResetUser] = useState<DataRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [authUser, setAuthUser] = useState<DataRow | null>(null);
  const [authRoles, setAuthRoles] = useState<DataRow[]>([]);
  const [authRoleIds, setAuthRoleIds] = useState<Set<number>>(new Set());
  const [menuRole, setMenuRole] = useState<DataRow | null>(null);
  const [menuNodes, setMenuNodes] = useState<TreeNode[]>([]);
  const [menuIds, setMenuIds] = useState<Set<number>>(new Set());
  const [dataRole, setDataRole] = useState<DataRow | null>(null);
  const [deptNodes, setDeptNodes] = useState<TreeNode[]>([]);
  const [deptIds, setDeptIds] = useState<Set<number>>(new Set());
  const [dataScope, setDataScope] = useState("1");
  const [roleUsersRole, setRoleUsersRole] = useState<DataRow | null>(null);
  const [roleUsers, setRoleUsers] = useState<DataRow[]>([]);
  const [availableRoleUsers, setAvailableRoleUsers] = useState<DataRow[]>([]);
  const [roleUserPicker, setRoleUserPicker] = useState(false);
  const [roleUserIds, setRoleUserIds] = useState<Set<number>>(new Set());
  const [roleUsersLoading, setRoleUsersLoading] = useState(false);
  const userImportRef = useRef<HTMLInputElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);

  const filterKey = JSON.stringify(filters);
  const treeMode = isTreeModule(config.key);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = treeMode
        ? { ...filters, ...(config.key === "dictData" ? { dictType } : {}) }
        : { ...filters, pageNum, pageSize, ...(config.key === "dictData" ? { dictType } : {}) };
      const result = await apiRequest<DataRow>(config.listPath, { query });
      const nextRows = extractRows(result);
      setRows(nextRows);
      setTotal(Number(result.total ?? nextRows.length));
    } catch (error) {
      notify(error instanceof Error ? error.message : `${config.title}加载失败`, "error");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [config, dictType, filterKey, pageNum, reloadToken, treeMode]);

  useEffect(() => { void load(); }, [load]);

  async function loadUserMeta(userId?: unknown) {
    const suffix = userId === undefined ? "/" : `/${userId}`;
    try {
      const result = await apiRequest<DataRow>(`/system/user${suffix}`);
      setUserRoles(Array.isArray(result.roles) ? result.roles : []);
      return result;
    } catch {
      setUserRoles([]);
      return null;
    }
  }

  async function openCreate() {
    let defaults = { ...config.defaults };
    if (config.key === "users") {
      const meta = await loadUserMeta();
      defaults = { ...defaults, roleIds: meta?.roleIds || [], postIds: meta?.postIds || [] };
    } else if (config.key === "roles") {
      defaults = {
        ...defaults,
        roleKey: `role_${Date.now().toString(36)}`,
        roleSort: "100",
        menuCheckStrictly: true,
        deptCheckStrictly: true,
      };
    }
    setForm(defaults);
    setEditor("new");
  }

  async function openEdit(row: DataRow) {
    try {
      const result = await apiRequest<DataRow>(`${config.resourcePath}/${row[config.idKey]}`);
      const detail = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : result;
      if (config.key === "users") {
        const meta = await loadUserMeta(row.userId);
        setForm({ ...row, ...detail, roleIds: meta?.roleIds || detail.roleIds || [], postIds: meta?.postIds || detail.postIds || [] });
      } else {
        setForm({ ...row, ...detail });
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "详情加载失败", "error");
      setForm({ ...row });
    }
    setEditor(row);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const visibleFields = config.fields.filter((field) => !(field.createOnly && editor !== "new"));
    const missing = visibleFields.find((field) => field.required && (form[field.key] === "" || form[field.key] === undefined));
    if (missing) return notify(`请填写${missing.label}`, "info");
    setSaving(true);
    try {
      await apiRequest(config.resourcePath, { method: editor === "new" ? "POST" : "PUT", body: form });
      notify("保存成功", "success");
      setEditor(null);
      setReloadToken((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  function remove(row: DataRow) {
    setConfirm({
      title: `删除${config.title}`,
      message: `确认删除“${textValue(row[config.nameKey])}”？删除后无法恢复。`,
      danger: true,
      action: async () => {
        await apiRequest(`${config.resourcePath}/${row[config.idKey]}`, { method: "DELETE" });
        notify("已删除", "success");
        if (rows.length === 1 && pageNum > 1) setPageNum((value) => value - 1);
        else setReloadToken((value) => value + 1);
      },
    });
  }

  async function changeStatus(row: DataRow) {
    const path = config.key === "users" ? "/system/user/changeStatus" : "/system/role/changeStatus";
    const idKey = config.key === "users" ? "userId" : "roleId";
    const next = String(row.status) === "0" ? "1" : "0";
    try {
      await apiRequest(path, { method: "PUT", body: { [idKey]: row[idKey], status: next } });
      notify(next === "0" ? "已启用" : "已停用", "success");
      setReloadToken((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : "状态更新失败", "error");
    }
  }

  async function openAuthRoles(row: DataRow) {
    setAuthUser(row);
    try {
      const result = await apiRequest<DataRow>(`/system/user/authRole/${row.userId}`);
      const roles = Array.isArray(result.roles) ? result.roles : [];
      const selected = new Set<number>((Array.isArray(result.roleIds) ? result.roleIds : []).map(Number));
      roles.forEach((role: DataRow) => {
        if (role.flag === true || role.flag === "true" || Number(role.flag) === 1) selected.add(Number(role.roleId));
      });
      setAuthRoles(roles);
      setAuthRoleIds(selected);
    } catch (error) {
      notify(error instanceof Error ? error.message : "角色加载失败", "error");
      setAuthRoles([]);
      setAuthRoleIds(new Set());
    }
  }

  async function saveAuthRoles() {
    if (!authUser) return;
    try {
      await apiRequest("/system/user/authRole", {
        method: "PUT",
        query: { userId: authUser.userId, roleIds: [...authRoleIds].join(",") },
      });
      notify("成员角色已更新", "success");
      window.dispatchEvent(new Event("xb-access-changed"));
      setAuthUser(null);
      setReloadToken((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : "角色分配失败", "error");
    }
  }

  async function openMenuPermissions(row: DataRow) {
    setMenuRole(row);
    try {
      const result = await apiRequest<DataRow>(`/system/menu/roleMenuTreeselect/${row.roleId}`);
      setMenuNodes(normalizeTreeNodes(result.menus ?? result.data?.menus ?? result.data));
      setMenuIds(checkedKeys(result));
    } catch (error) {
      notify(error instanceof Error ? error.message : "菜单权限加载失败", "error");
      setMenuNodes([]);
      setMenuIds(new Set());
    }
  }

  async function saveMenuPermissions() {
    if (!menuRole) return;
    try {
      await apiRequest("/system/role", { method: "PUT", body: { ...menuRole, menuIds: [...menuIds] } });
      notify("可用功能已更新", "success");
      window.dispatchEvent(new Event("xb-access-changed"));
      setMenuRole(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "菜单权限保存失败", "error");
    }
  }

  async function openDataPermissions(row: DataRow) {
    setDataRole(row);
    setDataScope(String(row.dataScope || "1"));
    try {
      const result = await apiRequest<DataRow>(`/system/dept/roleDeptTreeselect/${row.roleId}`);
      setDeptNodes(normalizeTreeNodes(result.depts ?? result.data?.depts ?? result.data));
      setDeptIds(checkedKeys(result));
      if (result.dataScope !== undefined) setDataScope(String(result.dataScope));
    } catch (error) {
      notify(error instanceof Error ? error.message : "数据范围加载失败", "error");
      setDeptNodes([]);
      setDeptIds(new Set());
    }
  }

  async function saveDataPermissions() {
    if (!dataRole) return;
    try {
      await apiRequest("/system/role/dataScope", {
        method: "PUT",
        body: {
          roleId: dataRole.roleId,
          roleName: dataRole.roleName,
          roleKey: dataRole.roleKey,
          roleSort: dataRole.roleSort,
          status: dataRole.status,
          dataScope,
          deptIds: dataScope === "2" ? [...deptIds] : [],
          deptCheckStrictly: true,
        },
      });
      notify("数据权限已更新", "success");
      window.dispatchEvent(new Event("xb-access-changed"));
      setDataRole(null);
      setReloadToken((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : "数据权限保存失败", "error");
    }
  }

  async function openRoleUsers(row: DataRow) {
    setRoleUsersRole(row);
    setRoleUserPicker(false);
    setRoleUserIds(new Set());
    setRoleUsersLoading(true);
    try {
      const result = await apiRequest<DataRow>("/system/role/authUser/allocatedList", {
        query: { roleId: row.roleId, pageNum: 1, pageSize: 100 },
      });
      setRoleUsers(extractRows(result));
    } catch (error) {
      notify(error instanceof Error ? error.message : "已授权用户加载失败", "error");
      setRoleUsers([]);
    } finally {
      setRoleUsersLoading(false);
    }
  }

  async function loadAvailableRoleUsers() {
    if (!roleUsersRole) return;
    setRoleUsersLoading(true);
    try {
      const result = await apiRequest<DataRow>("/system/role/authUser/unallocatedList", {
        query: { roleId: roleUsersRole.roleId, pageNum: 1, pageSize: 100 },
      });
      setAvailableRoleUsers(extractRows(result));
      setRoleUserIds(new Set());
      setRoleUserPicker(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "可授权用户加载失败", "error");
    } finally {
      setRoleUsersLoading(false);
    }
  }

  async function cancelRoleUser(row: DataRow) {
    if (!roleUsersRole) return;
    try {
      await apiRequest("/system/role/authUser/cancel", {
        method: "PUT",
        body: { roleId: roleUsersRole.roleId, userId: row.userId },
      });
      setRoleUsers((current) => current.filter((user) => Number(user.userId) !== Number(row.userId)));
      notify("已取消用户授权", "success");
      window.dispatchEvent(new Event("xb-access-changed"));
    } catch (error) {
      notify(error instanceof Error ? error.message : "取消授权失败", "error");
    }
  }

  async function saveRoleUsers() {
    if (!roleUsersRole || !roleUserIds.size) return notify("请选择要授权的用户", "info");
    try {
      await apiRequest("/system/role/authUser/selectAll", {
        method: "PUT",
        query: { roleId: roleUsersRole.roleId, userIds: [...roleUserIds].join(",") },
      });
      notify("用户授权成功", "success");
      window.dispatchEvent(new Event("xb-access-changed"));
      setRoleUserPicker(false);
      await openRoleUsers(roleUsersRole);
    } catch (error) {
      notify(error instanceof Error ? error.message : "用户授权失败", "error");
    }
  }

  async function exportUsers() {
    try {
      await downloadFile("/system/user/export", filters, `users_${Date.now()}.xlsx`);
      notify("用户导出已开始", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "导出失败", "error"); }
  }

  async function downloadUserTemplate() {
    try {
      await downloadFile("/system/user/importTemplate", {}, `user_template_${Date.now()}.xlsx`);
      notify("模板下载已开始", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "模板下载失败", "error"); }
  }

  async function importUsers(file: File) {
    try {
      const result = await uploadFile("/system/user/importData", file, { updateSupport: false }) as DataRow;
      notify(String(result.msg || "用户导入完成"), "success");
      setReloadToken((value) => value + 1);
    } catch (error) { notify(error instanceof Error ? error.message : "用户导入失败", "error"); }
    finally { if (userImportRef.current) userImportRef.current.value = ""; }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const selectedRoleIds = new Set<number>((Array.isArray(form.roleIds) ? form.roleIds : []).map(Number));

  function toggleFormIds(key: "roleIds", id: number) {
    const current = new Set<number>((Array.isArray(form[key]) ? form[key] : []).map(Number));
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setForm((value) => ({ ...value, [key]: [...current] }));
  }

  const Icon = config.icon;
  const keyword = String(filters[config.search[0]?.key] || draftFilters[config.search[0]?.key] || "");
  const treeRows = useMemo(() => {
    if (!treeMode) return [] as ResourceTreeNode[];
    const tree = buildResourceTree(rows, config.idKey, "parentId", 0);
    return filterResourceTree(tree, keyword, config.nameKey);
  }, [treeMode, rows, config.idKey, config.nameKey, keyword]);
  const statusText = (row: DataRow) => {
    if (row.status === undefined || row.status === null || row.status === "") return "";
    if (config.key === "notices") return String(row.status) === "0" ? "正常" : "关闭";
    return String(row.status) === "0" ? "正常" : "停用";
  };
  const statusTone = (row: DataRow) => String(row.status) === "0" ? "status-success" : "status-neutral";

  return (
    <div className="module-page sysm-center">
      <div className="module-hero compact-hero">
        <div>
          <button className="module-back-link" type="button" onClick={onBack}><ArrowLeft size={15} />返回</button>
          <span className="eyebrow">系统管理</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        {capability("create") ? (
          <button className="round-add" type="button" onClick={() => void openCreate()}><Plus size={22} /><span>新建</span></button>
        ) : (
          <span className="hero-tool-icon"><Icon size={27} /></span>
        )}
      </div>

      <div className="toolbar-card search-toolbar">
        <label className="quick-search">
          <Search size={15} strokeWidth={2.2} />
          <input
            value={String(draftFilters[config.search[0]?.key] || "")}
            onChange={(event) => setDraftFilters((current) => ({ ...current, [config.search[0].key]: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setPageNum(1);
                setFilters({ ...draftFilters, [config.search[0].key]: (event.target as HTMLInputElement).value });
              }
            }}
            placeholder={`搜索${config.search[0]?.label || config.title}`}
            aria-label={`搜索${config.title}`}
            enterKeyHint="search"
          />
          {draftFilters[config.search[0]?.key] ? (
            <button className="search-clear" type="button" aria-label="清空" onClick={() => {
              setDraftFilters((current) => ({ ...current, [config.search[0].key]: "" }));
              setFilters((current) => ({ ...current, [config.search[0].key]: "" }));
              setPageNum(1);
            }}><X size={14} /></button>
          ) : null}
        </label>
        <button
          className={`filter-chip${config.search.some((field) => String(filters[field.key] || "").trim()) ? " active" : ""}`}
          type="button"
          onClick={() => setFilterOpen(true)}
        ><SlidersHorizontal size={14} strokeWidth={2.2} />筛选</button>
        <button className="toolbar-icon" type="button" onClick={() => setReloadToken((value) => value + 1)} aria-label="刷新">
          <RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} />
        </button>
      </div>

      <div className="secondary-actions">
        {config.key === "users" ? <>
          {access.has("system.users.export") ? <button type="button" onClick={() => void exportUsers()}><Download size={16} />导出</button> : null}
          {access.has("system.users.import") ? <button type="button" onClick={() => userImportRef.current?.click()}><Upload size={16} />导入</button> : null}
          {access.has("system.users.import") ? <button type="button" onClick={() => void downloadUserTemplate()}><Download size={16} />模板</button> : null}
          <input ref={userImportRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importUsers(file); }} />
        </> : null}
        {config.cachePath && capability("delete") ? (
          <button
            type="button"
            onClick={async () => {
              try {
                await apiRequest(config.cachePath!, { method: "DELETE" });
                notify("缓存已刷新", "success");
              } catch (error) {
                notify(error instanceof Error ? error.message : "缓存刷新失败", "error");
              }
            }}
          ><Database size={16} />刷新缓存</button>
        ) : null}
      </div>


      <div className="list-heading">
        <div>
          <h2>{config.title}{treeMode ? "树" : "列表"}</h2>
          <span>{treeMode ? `共 ${total} 项` : `共 ${total} 条 · 第 ${pageNum}/${pageCount} 页`}</span>
        </div>
      </div>
      {treeMode ? (
        <div aria-busy={loading}>
          {!rows.length ? <EmptyState loading={loading} label={config.title} /> : null}
          {!loading && treeRows.length ? (
            <ResourceTreeList
              nodes={treeRows}
              config={config}
              onEdit={(row) => void openEdit(row)}
              onRemove={(row) => remove(row)}
            />
          ) : null}
          {!loading && rows.length && !treeRows.length ? <EmptyState loading={false} label="匹配结果" /> : null}
        </div>
      ) : (
      <div className="mobile-card-list" aria-busy={loading}>
        {!rows.length ? <EmptyState loading={loading} label={config.title} /> : null}
        {!loading && rows.map((row) => (
          <article className="data-card" key={String(row[config.idKey])}>
            <div className="data-card-head">
              <span className="data-icon"><Icon size={20} /></span>
              <div>
                <b>{textValue(row[config.nameKey])}</b>
                <small>#{textValue(row[config.idKey])}</small>
              </div>
              {row.status !== undefined && row.status !== null && row.status !== "" ? (
                <span className={`status ${statusTone(row)}`}><span />{statusText(row)}</span>
              ) : null}
            </div>
            <div className="data-metrics">
              {config.columns.filter((column) => column.key !== config.nameKey && column.key !== "status").map((column) => (
                <div key={column.key}>
                  <span>{column.label}</span>
                  <b>{column.format ? column.format(row) : textValue(row[column.key])}</b>
                </div>
              ))}
            </div>
            <div className="card-actions">
              {config.key === "dictTypes" ? (
                <button type="button" onClick={() => onOpenDictData(String(row.dictType || ""))}><ListTree size={16} />数据</button>
              ) : null}
              {config.key === "users" && capability("edit") ? (
                <>
                  <button type="button" onClick={() => void changeStatus(row)}><UserCog size={16} />{String(row.status) === "0" ? "停用" : "启用"}</button>
                  {access.has("system.users.resetPassword") ? <button type="button" onClick={() => { setResetUser(row); setNewPassword(""); }}><KeyRound size={16} />重置密码</button> : null}
                  <button type="button" className="primary-action" onClick={() => void openAuthRoles(row)}><ShieldCheck size={16} />分配角色</button>
                </>
              ) : null}
              {config.key === "roles" && capability("edit") ? (
                <>
                  <button type="button" onClick={() => void changeStatus(row)}><UserCog size={16} />{String(row.status) === "0" ? "停用" : "启用"}</button>
                  <button type="button" className="primary-action" onClick={() => void openMenuPermissions(row)}><MenuIcon size={16} />可用功能</button>
                  <button type="button" onClick={() => void openRoleUsers(row)}><Users size={16} />成员</button>
                  <button type="button" onClick={() => void openDataPermissions(row)}><Database size={16} />数据范围</button>
                </>
              ) : null}
              {capability("edit") ? <button type="button" onClick={() => void openEdit(row)}><Pencil size={16} />修改</button> : null}
              {capability("delete") && Number(row[config.idKey]) !== 1 ? (
                <button type="button" className="danger-text" onClick={() => void remove(row)}><Trash2 size={16} />删除</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      )}

      {!treeMode ? (
      <div className="sysm-pager">
        <button className="button button-ghost" type="button" disabled={pageNum <= 1 || loading} onClick={() => setPageNum((value) => Math.max(1, value - 1))}><ChevronLeft size={17} />上一页</button>
        <span>{pageNum} / {pageCount}</span>
        <button className="button button-ghost" type="button" disabled={pageNum >= pageCount || loading} onClick={() => setPageNum((value) => Math.min(pageCount, value + 1))}>下一页<ChevronRight size={17} /></button>
      </div>
      ) : null}

      {editor && capability(editor === "new" ? "create" : "edit") ? (
        <Sheet
          open={true}
          onClose={() => setEditor(null)}
          title={`${editor === "new" ? "新建" : "编辑"}${config.title.replace("管理", "").replace("设置", "")}`}
          wide
          headerAction={
            <button className="sheet-header-save" type="submit" form="sysm-editor-form" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
              {saving ? "保存中" : "保存"}
            </button>
          }
        >
          <form className="mobile-form form-grid sysm-editor-form" id="sysm-editor-form" onSubmit={(event) => void save(event)}>
            {config.fields.filter((field) => !(field.createOnly && editor !== "new")).map((field) => (
              <Field
                key={field.key}
                config={field}
                value={form[field.key]}
                onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
              />
            ))}
            {config.key === "users" ? (
              <fieldset className="sysm-check-group"><legend>所属角色</legend><div className="sysm-chip-options">
                {userRoles.map((role) => <label className="sysm-check-chip" key={role.roleId}><input type="checkbox" checked={selectedRoleIds.has(Number(role.roleId))} onChange={() => toggleFormIds("roleIds", Number(role.roleId))} /><span>{textValue(role.roleName)}</span></label>)}
                {!userRoles.length ? <span className="sysm-empty-note">暂无可选角色</span> : null}
              </div></fieldset>
            ) : null}
          </form>
        </Sheet>
      ) : null}

      {resetUser && access.has("system.users.resetPassword") ? (
        <Sheet open={true} onClose={() => setResetUser(null)} title={`重置密码 · ${textValue(resetUser.userName)}`} wide>
          <Field config={{ key: "password", label: "新密码", type: "password", required: true }} value={newPassword} onChange={(value) => setNewPassword(String(value))} />
        <div className="form-footer"><button className="button button-ghost" type="button" onClick={() => setResetUser(null)}>取消</button><button className="button button-primary" type="button" onClick={async () => { if (!newPassword) return notify("请输入新密码", "info"); try { await apiRequest("/system/user/resetPwd", { method: "PUT", body: { userId: resetUser.userId, password: newPassword } }); notify("密码已重置", "success"); setResetUser(null); } catch (error) { notify(error instanceof Error ? error.message : "重置失败", "error"); } }}>确认重置</button></div></Sheet>
      ) : null}

      {authUser && capability("edit") ? (
        <Sheet open={true} onClose={() => setAuthUser(null)} title={`成员角色 · ${textValue(authUser.userName)}`} wide>
          <div className="sysm-chip-options">{authRoles.map((role) => <label className="sysm-check-chip" key={role.roleId}><input type="checkbox" checked={authRoleIds.has(Number(role.roleId))} onChange={() => { const next = new Set(authRoleIds); const id = Number(role.roleId); if (next.has(id)) next.delete(id); else next.add(id); setAuthRoleIds(next); }} /><span>{textValue(role.roleName)}</span></label>)}</div>
        <div className="form-footer"><button className="button button-ghost" type="button" onClick={() => setAuthUser(null)}>取消</button><button className="button button-primary" type="button" onClick={() => void saveAuthRoles()}>保存</button></div></Sheet>
      ) : null}

      {menuRole && capability("edit") ? (
        <Sheet open={true} onClose={() => setMenuRole(null)} title={`可用功能 · ${textValue(menuRole.roleName)}`} wide>
          <FeaturePicker nodes={menuNodes} checked={menuIds} onChange={setMenuIds} />
        <div className="form-footer"><button className="button button-ghost" type="button" onClick={() => setMenuRole(null)}>取消</button><button className="button button-primary" type="button" onClick={() => void saveMenuPermissions()}>保存</button></div></Sheet>
      ) : null}

      {dataRole ? (
        <Sheet open={true} onClose={() => setDataRole(null)} title={`数据权限 · ${textValue(dataRole.roleName)}`} wide>
          <div className="sysm-data-scope">
            <Field config={{ key: "dataScope", label: "权限范围", type: "select", options: [{ label: "全部数据权限", value: "1" }, { label: "自定数据权限", value: "2" }, { label: "本部门数据权限", value: "3" }, { label: "本部门及以下数据权限", value: "4" }, { label: "仅本人数据权限", value: "5" }] }} value={dataScope} onChange={(value) => setDataScope(String(value))} />
            {dataScope === "2" ? <TreePicker nodes={deptNodes} checked={deptIds} onChange={setDeptIds} /> : <p className="sysm-empty-note">当前范围无需选择部门</p>}
          </div>
        <div className="form-footer"><button className="button button-ghost" type="button" onClick={() => setDataRole(null)}>取消</button><button className="button button-primary" type="button" onClick={() => void saveDataPermissions()}>保存权限</button></div></Sheet>
      ) : null}

      {roleUsersRole ? (
        <Sheet open={true} onClose={() => setRoleUsersRole(null)} title={`角色成员 · ${textValue(roleUsersRole.roleName)}`} wide>
          {roleUsersLoading ? <div className="sysm-empty"><LoaderCircle className="spin" size={24} /><p>正在加载用户</p></div> : roleUserPicker ? (
            <div className="sysm-role-users">
              {availableRoleUsers.map((user) => <label className="sysm-role-user" key={user.userId}><input type="checkbox" checked={roleUserIds.has(Number(user.userId))} onChange={() => { const next = new Set(roleUserIds); const id = Number(user.userId); if (next.has(id)) next.delete(id); else next.add(id); setRoleUserIds(next); }} /><span><b>{textValue(user.nickName || user.userName)}</b><small>{textValue(user.userName)} · {textValue(user.phonenumber)}</small></span></label>)}
              {!availableRoleUsers.length ? <p className="sysm-empty-note">暂无可添加成员</p> : null}
            </div>
          ) : (
            <div className="sysm-role-users">
              {roleUsers.map((user) => <div className="sysm-role-user" key={user.userId}><span><b>{textValue(user.nickName || user.userName)}</b><small>{textValue(user.userName)} · {textValue(user.phonenumber)}</small></span><button className="danger-text" type="button" onClick={() => void cancelRoleUser(user)}>取消授权</button></div>)}
              {!roleUsers.length ? <p className="sysm-empty-note">该角色暂无成员</p> : null}
            </div>
          )}
        <div className="form-footer">
            {roleUserPicker
              ? <>
                  <button className="button button-ghost" type="button" onClick={() => setRoleUserPicker(false)}>返回已授权</button>
                  <button className="button button-primary" type="button" onClick={() => void saveRoleUsers()}>确认授权</button>
                </>
              : <>
                  <button className="button button-ghost" type="button" onClick={() => setRoleUsersRole(null)}>关闭</button>
                  <button className="button button-primary" type="button" onClick={() => void loadAvailableRoleUsers()}><Plus size={16} />添加成员</button>
                </>}
          </div>
        </Sheet>
      ) : null}

      <Sheet open={filterOpen} title={`筛选${config.title}`} onClose={() => setFilterOpen(false)}>
        <form
          className="filter-sheet"
          onSubmit={(event) => {
            event.preventDefault();
            setPageNum(1);
            setFilters({ ...draftFilters });
            setFilterOpen(false);
          }}
        >
          <div className="filter-sheet-body">
            <section className="filter-section">
              <header><h3>筛选条件</h3></header>
              <div className="filter-field-stack">
                {config.search.map((field) => (
                  <Field key={field.key} config={field} value={draftFilters[field.key]} onChange={(value) => setDraftFilters((current) => ({ ...current, [field.key]: value }))} />
                ))}
              </div>
            </section>
          </div>
          <div className="filter-sheet-footer">
            <button type="button" className="filter-reset" onClick={() => { setDraftFilters({}); setFilters({}); setPageNum(1); }}>重置</button>
            <button className="filter-apply" type="submit">查看结果</button>
          </div>
        </form>
      </Sheet>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

/** 系统中心首页分组映射：每个子项属于哪个语义分组。改这里就能调整首页布局。 */
const HUB_GROUP: Partial<Record<ModuleKey, "account" | "config">> = {
  users: "account",
  roles: "account",
  depts: "account",
  posts: "account",
  menus: "config",
  dictTypes: "config",
  configs: "config",
  notices: "config",
};

const HUB_GROUPS: Array<{ key: "account" | "config"; title: string; description: string }> = [
  { key: "account", title: "账号与权限", description: "成员、角色与组织" },
  { key: "config", title: "系统配置", description: "菜单、字典、参数与公告" },
];

export function SystemManagementCenter({ notify: externalNotify, initialModule = null, onExit }: { notify?: Notify; initialModule?: ModuleKey | null; onExit?: () => void } = {}) {
  const access = useAccess();
  const [active, setActive] = useState<ModuleKey | null>(initialModule);
  const [activeDictType, setActiveDictType] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const notify = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    if (externalNotify) externalNotify(message, type);
    else setNotice({ message, type });
  }, [externalNotify]);
  const config = useMemo(() => active === "dictData" ? dictDataConfig(activeDictType) : active ? MODULES[active as Exclude<ModuleKey, "dictData">] : null, [active, activeDictType]);
  useEffect(() => {
    if (config && !access.has(`system.${capabilityResource(config.key)}.view`)) setActive(null);
  }, [access, config]);
  const renderModules = (modules: ModuleConfig[]) => modules
    .filter((module) => access.has(`system.${capabilityResource(module.key)}.view`))
    .map((module) => {
      const Icon = module.icon;
      return (
        <button type="button" key={module.key} onClick={() => setActive(module.key)}>
          <span><Icon size={19} /></span>
          <b>{module.title}</b>
          <small>{module.description}</small>
        </button>
      );
    });
  // 把模块按 HUB_GROUP 划分到语义分组；未分组的会被跳过
  const groupedHubs = HUB_GROUPS.map((group) => ({
    ...group,
    modules: (Object.values(MODULES) as ModuleConfig[]).filter(
      (module) => HUB_GROUP[module.key] === group.key,
    ),
  })).filter((group) => group.modules.some((module) => access.has(`system.${capabilityResource(module.key)}.view`)));

  if (config) {
    return (
      <div className="sysm-center">
        {notice ? <div className={`sysm-toast sysm-toast-${notice.type}`} role="status">{notice.message}</div> : null}
        <ResourceModule
          config={config}
          dictType={activeDictType}
          notify={notify}
          onBack={() => {
            if (active === "dictData") setActive("dictTypes");
            else if (onExit && initialModule) onExit();
            else setActive(null);
          }}
          onOpenDictData={(type) => { setActiveDictType(type); setActive("dictData"); }}
        />
      </div>
    );
  }

  return (
    <div className="module-page sysm-center">
      {notice ? <div className={`sysm-toast sysm-toast-${notice.type}`} role="status">{notice.message}</div> : null}
      <div className="module-hero compact-hero">
        <div>
          <span className="eyebrow">系统运行</span>
          <h1>系统管理</h1>
          <p>给成员分配角色，再为角色选择可用功能</p>
        </div>
        <span className="hero-tool-icon"><Settings2 size={27} /></span>
      </div>
      <div className="menu-groups">
        {groupedHubs.map((group) => (
          <section className="menu-group" key={group.key}>
            <div className="menu-group-title"><b>{group.title}</b><small>{group.description}</small></div>
            <div className="menu-grid">{renderModules(group.modules)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default SystemManagementCenter;
