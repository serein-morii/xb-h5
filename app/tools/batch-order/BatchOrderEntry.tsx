
import { AlertCircle, CheckCircle2, ChevronRight, ClipboardPaste, Download, FileSpreadsheet, ListChecks, LoaderCircle, Pencil, Plus, Settings2, Store, Trash2, Upload, UserCheck, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import {
  downloadTemplateXlsx,
  FIELD_OPTIONS,
  FormatTemplate,
  loadActiveTemplateId,
  loadTemplates,
  newTemplateId,
  parseGridWithTemplate,
  ParseResult,
  parseTextWithTemplate,
  saveActiveTemplateId,
  saveUserTemplates,
  SeparatorType,
  TemplateField,
} from "./formatTemplates";

type DictOption = { value: string; label: string };
type Row = Record<string, any>;
type ItemResult = { rowIndex: number; status: "success" | "duplicate" | "failed"; message: string; shortId?: string; orderCodes?: string; createdCount?: number };
type BatchResponse = { totalCount: number; successCount: number; duplicateCount: number; failedCount: number; results: ItemResult[] };
type PreviewSummary = { total: number; exists: number; newCount: number; invalid: number; duplicate: number };
type PreviewPurchaser = { id: number; shortId: string; name: string; phone: string; storeName: string };
type PreviewItem = { rowIndex: number; customerName: string; phone: string; orderItem: string; orderTime: string; quantity: number; payerNickname?: string; buyerStatus: "exists" | "new" | "invalid" | "duplicate"; existingPurchaser?: PreviewPurchaser; message: string };
type PreviewResponse = { summary: PreviewSummary; items: PreviewItem[] };
type Decision = "create" | "use" | "skip";
type PurchaserOption = { id: number; name: string; phone: string; shortId: string; storeName?: string };

const PRODUCT_EMOJI: Record<string, string> = {
  "苹果": "🍎", "梨": "🍐", "橘子": "🍊", "橙子": "🍊", "葡萄": "🍇",
  "草莓": "🍓", "樱桃": "🍒", "车厘子": "🍒", "桃": "🍑", "水蜜桃": "🍑",
  "芒果": "🥭", "香蕉": "🍌", "西瓜": "🍉", "哈密瓜": "🍈", "柠檬": "🍋",
  "蓝莓": "🫐", "黑莓": "🫐", "石榴": "🫐", "枣": "🫐", "李子": "🫐",
  "黄桃": "🍑", "炎陵黄桃": "🍑", "青李子": "🍏", "青李": "🍏", "奈李": "🫐",
  "炎陵奈李": "🍈", "青奈李": "🍏",
  "猕猴桃": "🥝", "火龙果": "🐉", "山竹": "🟣", "榴莲": "🟡", "椰子": "🥥",
  "菠萝": "🍍", "木瓜": "🥭", "杨梅": "🫐", "枇杷": "🍑", "荔枝": "🟥",
  "李": "🫐", "红心李": "🫐",
};
const emojiFor = (label: string) => PRODUCT_EMOJI[label] || "📦";

const SEPARATOR_LABELS: Record<SeparatorType, string> = {
  auto: "自动（Tab / 多空格）",
  tab: "Tab 键",
  "multi-space": "多个空格",
  comma: "英文逗号",
};

export default function BatchOrderEntry() {
  const [storeCode, setStoreCode] = useState("");
  const [stores, setStores] = useState<Row[]>([]);
  const [rawText, setRawText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<{ type: "preview" | "result"; data: any; rowIndex?: number } | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [selectedPurchaser, setSelectedPurchaser] = useState<Record<number, number | undefined>>({});
  const [pickOpen, setPickOpen] = useState<Record<number, boolean>>({});
  const [purchasers, setPurchasers] = useState<PurchaserOption[] | null>(null);
  const [purchaserLoading, setPurchaserLoading] = useState(false);
  const [pickQuery, setPickQuery] = useState<Record<number, string>>({});
  const [purchaserNameEdit, setPurchaserNameEdit] = useState<Record<number, string>>({});
  const [results, setResults] = useState<BatchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [productOptions, setProductOptions] = useState<DictOption[]>([]);
  const [sizeOptions, setSizeOptions] = useState<DictOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // 格式模板状态
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateIdState] = useState<string>("");
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormatTemplate | null>(null);
  const [lastParse, setLastParse] = useState<ParseResult | null>(null);

  useEffect(() => {
    apiRequest<{ data?: Row[] }>("/biz/store/options", { query: { createBy: "", name: "" } })
      .then((r) => {
        const rows = Array.isArray(r.data) ? r.data.filter((s) => Number(s.isDelete ?? 1) === 1) : [];
        setStores(rows);
        if (rows[0]?.code) setStoreCode(String(rows[0].code));
      })
      .catch(() => setError("店铺列表加载失败"));
    apiRequest<{ data?: { products?: DictOption[]; sizes?: DictOption[] } }>("/search/order-options", { auth: false })
      .then((r) => {
        setProductOptions(Array.isArray(r.data?.products) ? r.data!.products! : []);
        setSizeOptions(Array.isArray(r.data?.sizes) ? r.data!.sizes! : []);
      })
      .catch(() => { /* 字典拉取失败不影响主流程 */ });
    const loaded = loadTemplates();
    setTemplates(loaded);
    const activeId = loadActiveTemplateId();
    setActiveTemplateIdState(loaded.some((t) => t.id === activeId) ? activeId : loaded[0]?.id || "");
  }, []);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) || templates[0] || null,
    [templates, activeTemplateId],
  );

  function setActiveTemplate(id: string) {
    setActiveTemplateIdState(id);
    saveActiveTemplateId(id);
  }

  // 下载当前模板的样例 xlsx
  async function handleDownloadTemplate() {
    if (!activeTemplate) return;
    try {
      await downloadTemplateXlsx(activeTemplate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "模板下载失败");
    }
  }

  // 解析：使用当前激活的模板
  function parseAndPreview(text: string) {
    if (!activeTemplate) { setError("无可用格式模板"); return; }
    setError(""); setResults(null); setPreview(null); setDecisions({}); setSelectedPurchaser({}); setPickOpen({}); setPickQuery({}); setPurchaserNameEdit({});
    const result = parseTextWithTemplate(text, activeTemplate);
    setLastParse(result);
    if (result.items.length === 0) {
      if (result.headerFound === false && activeTemplate.headerRow === 1) {
        setError("找不到表头行。请检查首行是否包含模板配置的「表头识别词」");
      } else if (result.totalLines === 0) {
        setError("内容为空");
      } else {
        setError("解析后没有有效行（缺姓名/电话/数量 等必填字段）");
      }
      return;
    }
    setItems(result.items);
    const initNames: Record<number, string> = {};
    result.items.forEach((it, i) => { initNames[i] = String(it.purchaserName || ""); });
    setPurchaserNameEdit(initNames);
    runPreview(result.items);
  }

  async function runPreview(parsed: Row[]) {
    if (!storeCode) { setError("请先选择店铺"); return; }
    setPreviewing(true); setError("");
    try {
      const res = await apiRequest<{ data?: PreviewResponse }>("/biz/batch-order/preview", {
        method: "POST",
        body: { storeCode, items: parsed },
      });
      const data = res.data || { summary: { total: 0, exists: 0, newCount: 0, invalid: 0, duplicate: 0 }, items: [] };
      setPreview(data);
      const init: Record<number, Decision> = {};
      const initBuyer: Record<number, number | undefined> = {};
      data.items.forEach((it) => {
        if (it.buyerStatus === "exists") {
          init[it.rowIndex] = "use";
          if (it.existingPurchaser?.id != null) initBuyer[it.rowIndex] = Number(it.existingPurchaser.id);
        } else if (it.buyerStatus === "new") {
          init[it.rowIndex] = "create";
        } else {
          init[it.rowIndex] = "skip";
        }
      });
      setDecisions(init);
      setSelectedPurchaser(initBuyer);
      setPickOpen({});
      setPickQuery({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "预览失败");
    } finally {
      setPreviewing(false);
    }
  }

  function handlePaste() {
    if (!rawText.trim()) { setError("请先粘贴内容"); return; }
    parseAndPreview(rawText);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const name = file.name.toLowerCase();
    if (name.endsWith(".xls")) {
      setError("旧版 .xls 暂不支持，请在 Excel 中另存为 .xlsx 后重试");
      event.target.value = "";
      return;
    }
    if (name.endsWith(".xlsx")) {
      try {
        if (!activeTemplate) { setError("无可用格式模板"); event.target.value = ""; return; }
        const { readExcelGrid } = await import("../../lib/excel");
        const grid = await readExcelGrid(file);
        if (!grid.length) { setError("Excel 文件没有可读工作表"); event.target.value = ""; return; }
        const result = parseGridWithTemplate(grid as string[][], activeTemplate);
        setLastParse(result);
        if (result.items.length === 0) {
          if (result.headerFound === false && activeTemplate.headerRow === 1) {
            setError("找不到表头行。请检查首行是否包含模板配置的「表头识别词」");
          } else {
            setError("解析后没有有效行（缺姓名/电话/数量 等必填字段）");
          }
          event.target.value = "";
          return;
        }
        const text = grid.map((row) => row.map((c) => String(c ?? "")).join("\t")).join("\n");
        setRawText(text);
        setItems(result.items);
        const initNames: Record<number, string> = {};
        result.items.forEach((it, i) => { initNames[i] = String(it.purchaserName || ""); });
        setPurchaserNameEdit(initNames);
        runPreview(result.items);
      } catch (e) {
        setError(e instanceof Error ? `Excel 解析失败：${e.message}` : "Excel 解析失败");
      }
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => { const text = String(e.target?.result || ""); setRawText(text); parseAndPreview(text); };
    reader.readAsText(file, "utf-8");
  }

  // 模板管理
  function startNewTemplate() {
    setEditingTemplate({
      id: newTemplateId(),
      name: "",
      description: "",
      separator: "auto",
      headerRow: 1,
      fields: [
        { key: "orderTime", aliases: ["收款时间"], required: false },
        { key: "payerNickname", aliases: ["付款方昵称"], required: false },
        { key: "orderItem", aliases: ["收款项"], required: false },
        { key: "quantity", aliases: ["数量"], required: true },
        { key: "address", aliases: ["地址"], required: false },
        { key: "customerName", aliases: ["姓名"], required: true },
        { key: "phone", aliases: ["电话"], required: true },
      ],
    });
  }

  function startEditTemplate(t: FormatTemplate) {
    setEditingTemplate(JSON.parse(JSON.stringify(t)) as FormatTemplate);
  }

  function saveEditingTemplate() {
    if (!editingTemplate) return;
    const t = editingTemplate;
    if (!t.name.trim()) { setError("请填写模板名称"); return; }
    const keys = new Set(t.fields.map((f) => f.key));
    if (!keys.has("customerName") || !keys.has("phone") || !keys.has("quantity")) {
      setError("字段映射至少要包含：姓名、电话、数量（后端预览接口必需）");
      return;
    }
    const emptyAlias = t.fields.find((f) => !f.aliases.some((a) => a.trim()));
    if (emptyAlias) {
      const label = FIELD_OPTIONS.find((o) => o.key === emptyAlias.key)?.label || emptyAlias.key;
      setError(`字段「${label}」至少要填一个表头识别词`);
      return;
    }
    const others = templates.filter((x) => x.id !== t.id);
    const next = [...others, t];
    setTemplates(next);
    saveUserTemplates(next);
    if (!templates.some((x) => x.id === t.id)) setActiveTemplate(t.id);
    setEditingTemplate(null);
    setError("");
  }

  function deleteTemplate(t: FormatTemplate) {
    if (t.builtin) return;
    if (!window.confirm(`删除模板「${t.name}」？已用此模板录入的历史订单不受影响`)) return;
    const next = templates.filter((x) => x.id !== t.id);
    setTemplates(next);
    saveUserTemplates(next);
    if (activeTemplateId === t.id) {
      const fallback = next[0];
      if (fallback) setActiveTemplate(fallback.id);
    }
  }

  function updateEditingField<K extends keyof TemplateField>(idx: number, key: K, value: TemplateField[K]) {
    if (!editingTemplate) return;
    const next = { ...editingTemplate, fields: editingTemplate.fields.slice() };
    next.fields[idx] = { ...next.fields[idx], [key]: value };
    setEditingTemplate(next);
  }

  function addEditingField() {
    if (!editingTemplate) return;
    const used = new Set(editingTemplate.fields.map((f) => f.key));
    const candidate = FIELD_OPTIONS.find((o) => !used.has(o.key));
    if (!candidate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: [...editingTemplate.fields, { key: candidate.key, aliases: [candidate.label], required: false }],
    });
  }

  function removeEditingField(idx: number) {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, fields: editingTemplate.fields.filter((_, i) => i !== idx) });
  }

  function moveEditingField(idx: number, dir: -1 | 1) {
    if (!editingTemplate) return;
    const next = editingTemplate.fields.slice();
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditingTemplate({ ...editingTemplate, fields: next });
  }

  // 买家选择 / 提交
  async function loadPurchasers(): Promise<PurchaserOption[]> {
    if (!storeCode) return [];
    if (purchasers) return purchasers;
    setPurchaserLoading(true);
    try {
      const res = await apiRequest<{ data?: any[] }>("/biz/purchaser/list", { query: { storeCode } });
      const list = Array.isArray(res.data) ? res.data.map((p) => ({
        id: Number(p.id), name: String(p.name || ""), phone: String(p.phone || ""),
        shortId: String(p.shortId || ""), storeName: p.storeName ? String(p.storeName) : undefined,
      })) : [];
      setPurchasers(list);
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : "买家列表加载失败");
      return [];
    } finally {
      setPurchaserLoading(false);
    }
  }

  // 切换店铺时清空买家缓存（不同店铺的买家列表不一样）
  useEffect(() => {
    setPurchasers(null);
  }, [storeCode]);

  async function togglePick(rowIndex: number, currentDecision: Decision) {
    const alreadyUse = currentDecision === "use";
    const isOpen = !!pickOpen[rowIndex];
    if (alreadyUse && isOpen) {
      setPickOpen((c) => ({ ...c, [rowIndex]: false }));
      return;
    }
    setDecisions((c) => ({ ...c, [rowIndex]: "use" }));
    setPickOpen((c) => ({ ...c, [rowIndex]: true }));
    setSelectedPurchaser((c) => {
      if (c[rowIndex] != null) return c;
      const matched = preview?.items.find((it) => it.rowIndex === rowIndex)?.existingPurchaser;
      if (matched?.id == null) return c;
      return { ...c, [rowIndex]: Number(matched.id) };
    });
    if (!purchasers) await loadPurchasers();
  }

  function choosePurchaser(rowIndex: number, p: PurchaserOption) {
    setSelectedPurchaser((c) => ({ ...c, [rowIndex]: p.id }));
    setDecisions((c) => ({ ...c, [rowIndex]: "use" }));
    setPickOpen((c) => ({ ...c, [rowIndex]: false }));
  }

  function setDecision(rowIndex: number, dec: Decision) {
    setDecisions((c) => ({ ...c, [rowIndex]: dec }));
    if (dec !== "use") {
      setPickOpen((c) => ({ ...c, [rowIndex]: false }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!storeCode) return setError("请先选择店铺");
    if (items.length === 0) return setError("没有可录入的订单，请先粘贴并解析");
    const pending = preview?.items.filter((it) => decisions[it.rowIndex] !== "skip") ?? [];
    if (pending.length === 0) return setError("所有行都被跳过，没有可录入的订单");
    const missingBuyer = pending.filter((it) => decisions[it.rowIndex] === "use" && !selectedPurchaser[it.rowIndex]);
    if (missingBuyer.length > 0) return setError(`第 ${missingBuyer[0].rowIndex + 1} 行选了「用已有」但未选择买家`);
    const missingName = pending.filter((it) => decisions[it.rowIndex] === "create" && !(purchaserNameEdit[it.rowIndex] || "").trim());
    if (missingName.length > 0) return setError(`第 ${missingName[0].rowIndex + 1} 行选了「新建」但买家名称为空`);
    setConfirmOpen(true);
  }

  async function confirmSubmit() {
    setConfirmOpen(false);
    setBusy(true); setError(""); setResults(null);
    try {
      const payloadItems = items.map((it, idx) => {
        const dec = decisions[idx] || "skip";
        const action = dec === "use" ? "use_existing" : dec === "create" ? "create_new" : "skip";
        const edited = dec === "create" ? (purchaserNameEdit[idx] || "").trim() : "";
        const nameValue = it.orderNameDesc ? productValueByLabel.get(String(it.orderNameDesc)) : undefined;
        const typeValue = it.orderTypeDesc ? sizeValueByLabel.get(String(it.orderTypeDesc)) : undefined;
        return {
          ...it,
          buyerAction: action,
          existingPurchaserId: dec === "use" ? selectedPurchaser[idx] : undefined,
          purchaserName: dec === "create" ? edited : it.purchaserName,
          orderName: nameValue,
          orderNameDesc: nameValue ? it.orderNameDesc : undefined,
          orderType: typeValue,
          orderTypeDesc: typeValue ? it.orderTypeDesc : undefined,
        };
      });
      const result = await apiRequest<{ data?: BatchResponse }>("/biz/batch-order/submit", {
        method: "POST",
        body: { storeCode, items: payloadItems, skipDuplicate: true },
      });
      setResults(result.data || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  const splitTotal = useMemo(() => items.reduce((sum, it) => sum + (Math.max(1, Number(it.quantity) || 1) - 1), 0), [items]);
  const totalOrders = items.length + splitTotal;
  const successCount = results?.successCount ?? 0;
  const duplicateCount = results?.duplicateCount ?? 0;
  const failedCount = results?.failedCount ?? 0;

  const pendingCount = useMemo(() => {
    if (!preview) return 0;
    return preview.items.filter((it) => decisions[it.rowIndex] !== "skip").length;
  }, [preview, decisions]);

  const productValueByLabel = useMemo(() => {
    const m = new Map<string, string>();
    productOptions.forEach((opt) => { if (opt.label && opt.value) m.set(opt.label, opt.value); });
    return m;
  }, [productOptions]);
  const sizeValueByLabel = useMemo(() => {
    const m = new Map<string, string>();
    sizeOptions.forEach((opt) => { if (opt.label && opt.value) m.set(opt.label, opt.value); });
    return m;
  }, [sizeOptions]);

  const STATUS_LABEL: Record<string, string> = { exists: "已存在买家", new: "待新建买家", invalid: "无效行", duplicate: "疑似重复" };
  const STATUS_TONE: Record<string, string> = { exists: "success", new: "new", invalid: "failed", duplicate: "duplicate" };

  return (
    <div className="batch-order-page">
      <div className="module-hero compact-hero"><div><small>BATCH ORDER ENTRY</small><h1>批量录单</h1><p>支持粘贴 Excel 或上传文件，先确认买家归属再录入</p></div><span className="hero-tool-icon"><FileSpreadsheet size={27} /></span></div>

      <form onSubmit={handleSubmit} className="batch-order-form">
        <section className="batch-order-section">
          <header><span>1</span><div><h2>选择店铺</h2><p>所有订单归属此店铺</p></div></header>
          <div className="tool-input">
            <Store size={17} />
            <select value={storeCode} onChange={(e) => setStoreCode(e.target.value)}>
              <option value="">请选择店铺</option>
              {stores.map((s) => <option key={String(s.id || s.code)} value={String(s.code)}>{s.name || s.text || s.value || s.code}</option>)}
            </select>
          </div>
        </section>

        <section className="batch-order-section">
          <header><span>2</span><div><h2>粘贴内容</h2><p>按当前格式模板识别表头与字段</p></div></header>

          <div className="batch-order-template-bar">
            <div className="batch-order-template-current">
              <ListChecks size={14} />
              <span className="batch-order-template-label">当前格式：</span>
              <select
                className="batch-order-template-select"
                value={activeTemplateId}
                onChange={(e) => setActiveTemplate(e.target.value)}
                title="切换格式模板"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.builtin ? "★ " : ""}{t.name}{t.headerRow === 0 ? "（无表头）" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="batch-order-template-download"
                onClick={handleDownloadTemplate}
                disabled={!activeTemplate}
                title="下载当前模板的样例 xlsx（表头 + 示例行）"
              >
                <Download size={14} />下载模板
              </button>
            </div>
          </div>
          {activeTemplate?.description ? (
            <p className="batch-order-template-hint">{activeTemplate.description}</p>
          ) : null}

          <div className="batch-order-toolbar">
            <button type="button" className="batch-order-template-mgmt" onClick={() => setTemplateSheetOpen(true)}>
              <Settings2 size={15} />管理模板
            </button>
            <button type="button" className="batch-order-file-btn" onClick={() => fileRef.current?.click()}><Upload size={15} />选择文件</button>
            <input ref={fileRef} hidden type="file" accept=".txt,.csv,.xlsx" onChange={handleFile} />
            <button type="button" className="batch-order-parse-btn" onClick={handlePaste}><ClipboardPaste size={15} />解析内容</button>
          </div>
          <textarea
            className="batch-order-textarea"
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              activeTemplate?.headerRow === 1
                ? `示例（粘贴到这里）：\n${activeTemplate.fields.slice(0, 6).map((f) => f.aliases[0] || "").join("\t")}\n${activeTemplate.fields.slice(0, 6).map(() => "...").join("\t")}`
                : `无表头模板：按字段顺序粘贴，每行一个订单\n共 ${activeTemplate?.fields.length || 0} 列（${activeTemplate?.fields.map((f) => f.aliases[0] || "").join(" | ")}）`
            }
          />
          {lastParse && lastParse.items.length > 0 ? (
            <p className="batch-order-template-stats">
              ✓ 解析 {lastParse.items.length} 行{lastParse.headerFound ? `（命中表头 ${lastParse.matchedFields} 个字段）` : "（按位置映射）"}
            </p>
          ) : null}
        </section>

        {preview ? (
          <section className="batch-order-section">
            <header><span>3</span><div><h2>买家确认（{preview.summary.total} 条）</h2><p>已存在 {preview.summary.exists} · 待新建 {preview.summary.newCount} · 重复 {preview.summary.duplicate} · 无效 {preview.summary.invalid}</p></div></header>
            <div className="batch-order-list">
              {preview.items.map((it) => {
                const dec = decisions[it.rowIndex] || "skip";
                const canUseExisting = it.buyerStatus === "exists" || it.buyerStatus === "new" || it.buyerStatus === "duplicate";
                const selectedId = selectedPurchaser[it.rowIndex];
                const selectedP =
                  (selectedId != null ? purchasers?.find((p) => p.id === selectedId) : undefined)
                  || (selectedId != null && it.existingPurchaser && Number(it.existingPurchaser.id) === selectedId
                    ? { id: Number(it.existingPurchaser.id), name: it.existingPurchaser.name, phone: it.existingPurchaser.phone, shortId: it.existingPurchaser.shortId, storeName: it.existingPurchaser.storeName }
                    : undefined)
                  || (dec === "use" && selectedId == null && it.existingPurchaser
                    ? { id: Number(it.existingPurchaser.id), name: it.existingPurchaser.name, phone: it.existingPurchaser.phone, shortId: it.existingPurchaser.shortId, storeName: it.existingPurchaser.storeName }
                    : undefined);
                const query = (pickQuery[it.rowIndex] || "").trim().toLowerCase();
                const filteredPurchasers = (() => {
                  const base = purchasers?.filter((p) =>
                    !query || p.name.toLowerCase().includes(query) || p.phone.includes(query) || p.shortId.toLowerCase().includes(query)
                  ) ?? [];
                  if (!it.existingPurchaser) return base;
                  const matchedId = Number(it.existingPurchaser.id);
                  return [...base].sort((a, b) => Number(b.id === matchedId) - Number(a.id === matchedId));
                })();
                return (
                  <article
                    key={it.rowIndex}
                    className={`batch-order-card batch-order-card-${STATUS_TONE[it.buyerStatus]}`}
                    onClick={(e) => {
                      // 点击卡片非交互区 = 打开预览；点内部按钮/输入框则不触发
                      const target = e.target as HTMLElement;
                      if (target.closest("button, input, select, textarea, a, [role='button']")) return;
                      setDetail({ type: "preview", data: items[it.rowIndex], rowIndex: it.rowIndex });
                    }}
                  >
                    <div className="batch-order-card-top">
                      <span className="batch-order-card-num">#{it.rowIndex + 1}</span>
                      <span className={`batch-order-status batch-order-status-${STATUS_TONE[it.buyerStatus]}`}>{STATUS_LABEL[it.buyerStatus]}</span>
                      <span className="batch-order-card-detail-btn" aria-hidden="true"><ChevronRight size={14} /></span>
                    </div>
                    <div className="batch-order-card-product">
                      <span className="batch-order-card-emoji">{emojiFor(String(it.orderItem || ""))}</span>
                      {items[it.rowIndex]?.orderNameDesc ? (() => {
                        const label = String(items[it.rowIndex].orderNameDesc);
                        const mapped = productValueByLabel.has(label);
                        return <span className={`batch-order-auto-tag ${mapped ? "is-mapped" : "is-unmapped"}`} title={mapped ? "已映射字典" : "未在字典中找到，提交时后端兜底"}>商品 · {label}{mapped ? "" : " · 待映射"}</span>;
                      })() : null}
                      {items[it.rowIndex]?.orderTypeDesc ? (() => {
                        const label = String(items[it.rowIndex].orderTypeDesc);
                        const mapped = sizeValueByLabel.has(label);
                        return <span className={`batch-order-auto-tag ${mapped ? "is-mapped" : "is-unmapped"}`} title={mapped ? "已映射字典" : "未在字典中找到，提交时后端兜底"}>规格 · {label}{mapped ? "" : " · 待映射"}</span>;
                      })() : null}
                      {(!items[it.rowIndex]?.orderNameDesc && !items[it.rowIndex]?.orderTypeDesc) ? (
                        <span className="batch-order-card-label">{String(it.orderItem || "--")}</span>
                      ) : null}
                      {Number(it.quantity) > 1 ? <span className="batch-order-card-split">×{it.quantity}</span> : null}
                    </div>
                    <div className="batch-order-card-meta">
                      <div><span className="batch-order-card-meta-label">买家(付款人)</span><span className="batch-order-card-meta-value">{String(it.payerNickname || "--")}</span></div>
                      <div><span className="batch-order-card-meta-label">收件人</span><span className="batch-order-card-meta-value">{String(it.customerName || "--")}</span></div>
                      <div><span className="batch-order-card-meta-label">电话</span><span className="batch-order-card-meta-value">{String(it.phone || "--")}</span></div>
                    </div>
                    {it.existingPurchaser ? (
                      <div className="batch-order-card-existing">系统匹配到：{it.existingPurchaser.name} · ID {it.existingPurchaser.shortId} · 店铺 {it.existingPurchaser.storeName || "--"}</div>
                    ) : null}
                    <div className="batch-order-card-decisions">
                      {canUseExisting ? (
                        <button type="button" className={`batch-order-decision ${dec === "use" ? "active" : ""}`} onClick={() => { void togglePick(it.rowIndex, dec); }}><UserCheck size={14} />用已有</button>
                      ) : null}
                      <button type="button" className={`batch-order-decision ${dec === "create" ? "active" : ""}`} onClick={() => setDecision(it.rowIndex, "create")}><UserPlus size={14} />新建</button>
                      <button type="button" className={`batch-order-decision batch-order-decision-skip ${dec === "skip" ? "active" : ""}`} onClick={() => setDecision(it.rowIndex, "skip")}>跳过</button>
                    </div>
                    {dec === "use" && pickOpen[it.rowIndex] ? (
                      <div className="batch-order-pick">
                        {selectedP ? (
                          <div className="batch-order-pick-selected">已选：{selectedP.name} · {selectedP.phone} · ID {selectedP.shortId}<button type="button" onClick={() => setSelectedPurchaser((c) => ({ ...c, [it.rowIndex]: undefined }))}>重选</button></div>
                        ) : null}
                        <input className="batch-order-pick-search" value={pickQuery[it.rowIndex] || ""} onChange={(e) => setPickQuery((c) => ({ ...c, [it.rowIndex]: e.target.value }))} placeholder="搜索姓名 / 手机号 / 短 ID" />
                        {purchaserLoading ? <p className="batch-order-loading">加载买家列表…</p> : null}
                        {!purchaserLoading && filteredPurchasers.length === 0 ? <p className="batch-order-empty">没有匹配的买家</p> : null}
                        <div className="batch-order-pick-list">
                          {filteredPurchasers.slice(0, 30).map((p) => (
                            <button type="button" key={p.id} className={`batch-order-pick-item ${selectedId === p.id ? "active" : ""}`} onClick={() => choosePurchaser(it.rowIndex, p)}>
                              <span className="batch-order-pick-item-name">{p.name}</span>
                              <span className="batch-order-pick-item-meta">{p.phone} · ID {p.shortId}{p.storeName ? ` · ${p.storeName}` : ""}</span>
                            </button>
                          ))}
                          {filteredPurchasers.length > 30 ? <p className="batch-order-pick-more">还有 {filteredPurchasers.length - 30} 个，请用搜索缩小范围</p> : null}
                        </div>
                      </div>
                    ) : null}
                    {dec === "create" ? (
                      <div className="batch-order-pick">
                        <div className="batch-order-pick-selected">
                          <span>将新建买家（付款人 {it.payerNickname}），并自动绑定到「{stores.find((s) => String(s.code) === storeCode)?.name || storeCode || "未选择店铺"}」，可改成真实姓名：</span>
                        </div>
                        <input
                          className="batch-order-pick-search"
                          value={purchaserNameEdit[it.rowIndex] || ""}
                          onChange={(e) => setPurchaserNameEdit((c) => ({ ...c, [it.rowIndex]: e.target.value }))}
                          placeholder="买家名称（默认付款方昵称）"
                        />
                      </div>
                    ) : null}
                    {!pickOpen[it.rowIndex] && dec === "use" && selectedP ? (
                      <div className="batch-order-card-existing">已选买家：{selectedP.name} · ID {selectedP.shortId}</div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {previewing ? <p className="batch-order-loading">正在分析买家状态…</p> : null}
        {error ? <p className="tool-error batch-order-error">{error}</p> : null}

        {results ? (
          <section className="batch-order-section batch-order-result">
            <header><span>✓</span><div><h2>录入结果</h2><p>成功 {successCount} · 重复跳过 {duplicateCount} · 失败 {failedCount}</p></div></header>
            {results.results.length > 0 ? (
              <div className="batch-order-list">
                {results.results.map((r) => (
                  <article key={r.rowIndex} className={`batch-order-card batch-order-card-result batch-order-card-${r.status}`} onClick={() => setDetail({ type: "result", data: r })}>
                    <div className="batch-order-card-top">
                      <span className="batch-order-card-num">#{r.rowIndex + 1}</span>
                      <span className={`batch-order-status batch-order-status-${r.status}`}>
                        {r.status === "success" ? "✓ 成功" : r.status === "duplicate" ? "⏭ 重复" : "✗ 失败"}
                      </span>
                      <ChevronRight size={14} className="batch-order-card-arrow" />
                    </div>
                    <div className="batch-order-card-message">{r.message}</div>
                    <div className="batch-order-card-result-grid">
                      <div><span>短 ID</span><b>{r.shortId || "--"}</b></div>
                      <div><span>订单号</span><b>{r.orderCodes || "--"}</b></div>
                      <div><span>创建数</span><b>{r.createdCount ?? 0}</b></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="batch-order-empty">无结果</p>}
          </section>
        ) : null}

        <div className="form-footer">
          <button type="button" className="button button-ghost" onClick={() => { setRawText(""); setItems([]); setResults(null); setPreview(null); setDecisions({}); setSelectedPurchaser({}); setPickOpen({}); setPickQuery({}); setPurchaserNameEdit({}); setError(""); setLastParse(null); }}><X size={15} />清空</button>
          <button type="submit" className="button button-primary" disabled={busy || pendingCount === 0}>{busy ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}{busy ? "录入中" : `开始录入 ${pendingCount ? `(${pendingCount})` : ""}`}</button>
        </div>
      </form>

      {confirmOpen ? <div className="batch-order-confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setConfirmOpen(false)}>
        <section className="batch-order-confirm-modal" role="alertdialog" aria-modal="true">
          <div className="batch-order-confirm-icon"><AlertCircle size={28} /></div>
          <h2>确认批量录入</h2>
          <p>即将提交 {pendingCount} 条到「{stores.find((s) => String(s.code) === storeCode)?.name || storeCode}」</p>
          <div className="batch-order-confirm-stats">
            <div><span>待录入</span><b>{pendingCount}</b></div>
            <div><span>含数量拆分</span><b>{totalOrders}</b></div>
            <div><span>店铺</span><b>{storeCode}</b></div>
          </div>
          {splitTotal > 0 ? <p className="batch-order-confirm-tip">⚠️ 检测到 {splitTotal} 行「数量 &gt; 1」，将自动拆成 {splitTotal} 张额外订单</p> : null}
          <div className="batch-order-confirm-actions">
            <button type="button" className="batch-order-confirm-cancel" onClick={() => setConfirmOpen(false)}>取消</button>
            <button type="button" className="batch-order-confirm-ok" onClick={confirmSubmit}>确认录入</button>
          </div>
        </section>
      </div> : null}

      {detail ? <div className="batch-order-detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}>
        <section className="batch-order-detail-modal" role="dialog" aria-modal="true">
          <button className="batch-order-detail-close" type="button" onClick={() => setDetail(null)} aria-label="关闭"><X size={18} /></button>
          <header>
            <small>{detail.type === "preview" ? "PREVIEW DETAIL" : "RESULT DETAIL"}</small>
            <h2>{detail.type === "preview" ? "订单预览详情" : "录入结果详情"}</h2>
            <p>行 #{detail.rowIndex !== undefined ? Number(detail.rowIndex) + 1 : "?"}</p>
          </header>
          {detail.type === "preview" ? (
            <div className="batch-order-detail-list">
              {[
                ["收款时间", detail.data.orderTime],
                ["商品", detail.data.orderItem],
                ["商品名", detail.data.orderNameDesc || detail.data.orderName],
                ["规格", detail.data.orderTypeDesc || detail.data.orderType],
                ["数量", detail.data.quantity],
                ["快递公司", detail.data.expCom],
                ["快递单号", detail.data.expCode],
                ["收件人", detail.data.customerName],
                ["电话", detail.data.phone],
                ["地址", detail.data.address],
                ["付款备注", detail.data.paymentRemark],
                ["商家备注", detail.data.merchantRemark],
                ["是否退款", detail.data.isRefunded],
                ["是否标记", detail.data.isMarked],
                ["顾客优惠", detail.data.customerDiscount],
                ["收款说明", detail.data.paymentNote],
                ["收款链接", detail.data.paymentLink],
                ["收款总金额", detail.data.totalAmount],
                ["付款方昵称", detail.data.payerNickname],
                ["收款项金额", detail.data.itemAmount],
              ].filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => (
                <div key={k as string}><span>{k}</span><b>{String(v)}</b></div>
              ))}
            </div>
          ) : (
            <div className="batch-order-detail-list">
              <div><span>状态</span><b>{detail.data.status === "success" ? "✓ 成功" : detail.data.status === "duplicate" ? "⏭ 重复" : "✗ 失败"}</b></div>
              <div><span>提示</span><b>{detail.data.message}</b></div>
              <div><span>短 ID</span><b>{detail.data.shortId || "--"}</b></div>
              <div><span>订单号</span><b>{detail.data.orderCodes || "--"}</b></div>
              <div><span>创建数</span><b>{detail.data.createdCount ?? 0}</b></div>
            </div>
          )}
        </section>
      </div> : null}

      {templateSheetOpen ? <TemplateSheet
        templates={templates}
        activeTemplateId={activeTemplateId}
        onActivate={setActiveTemplate}
        onClose={() => { setTemplateSheetOpen(false); setEditingTemplate(null); }}
        onNew={startNewTemplate}
        onEdit={startEditTemplate}
        onDelete={deleteTemplate}
        editing={editingTemplate}
        onCancelEdit={() => setEditingTemplate(null)}
        onSaveEdit={saveEditingTemplate}
        onChangeEditField={updateEditingField}
        onAddField={addEditingField}
        onRemoveField={removeEditingField}
        onMoveField={moveEditingField}
        onChangeEditMeta={(patch) => setEditingTemplate((cur) => cur ? { ...cur, ...patch } : cur)}
        error={error}
      /> : null}
    </div>
  );
}

function TemplateSheet(props: {
  templates: FormatTemplate[];
  activeTemplateId: string;
  onActivate: (id: string) => void;
  onClose: () => void;
  onNew: () => void;
  onEdit: (t: FormatTemplate) => void;
  onDelete: (t: FormatTemplate) => void;
  editing: FormatTemplate | null;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onChangeEditField: (idx: number, key: keyof TemplateField, value: any) => void;
  onAddField: () => void;
  onRemoveField: (idx: number) => void;
  onMoveField: (idx: number, dir: -1 | 1) => void;
  onChangeEditMeta: (patch: Partial<FormatTemplate>) => void;
  error: string;
}) {
  if (props.editing) {
    return <TemplateEditor
      template={props.editing}
      onCancel={props.onCancelEdit}
      onSave={props.onSaveEdit}
      onChangeField={props.onChangeEditField}
      onAddField={props.onAddField}
      onRemoveField={props.onRemoveField}
      onMoveField={props.onMoveField}
      onChangeMeta={props.onChangeEditMeta}
      error={props.error}
    />;
  }
  return <TemplateList
    templates={props.templates}
    activeTemplateId={props.activeTemplateId}
    onActivate={props.onActivate}
    onClose={props.onClose}
    onNew={props.onNew}
    onEdit={props.onEdit}
    onDelete={props.onDelete}
  />;
}

function TemplateList(props: {
  templates: FormatTemplate[];
  activeTemplateId: string;
  onActivate: (id: string) => void;
  onClose: () => void;
  onNew: () => void;
  onEdit: (t: FormatTemplate) => void;
  onDelete: (t: FormatTemplate) => void;
}) {
  return (
    <div className="batch-order-detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section className="batch-order-detail-modal batch-order-template-modal" role="dialog" aria-modal="true">
        <button className="batch-order-detail-close" type="button" onClick={props.onClose} aria-label="关闭"><X size={18} /></button>
        <header>
          <small>FORMAT TEMPLATES</small>
          <h2>格式模板</h2>
          <p>选择 / 新建 / 编辑批量录单使用的字段映射规则</p>
        </header>
        <div className="batch-order-template-list">
          {props.templates.map((t) => {
            const active = t.id === props.activeTemplateId;
            return (
              <article key={t.id} className={`batch-order-template-item ${active ? "is-active" : ""}`}>
                <div className="batch-order-template-item-info">
                  <div className="batch-order-template-item-name">
                    {t.builtin ? <span className="batch-order-template-badge">内置</span> : null}
                    {t.name}
                    {active ? <span className="batch-order-template-active-tag">使用中</span> : null}
                  </div>
                  <div className="batch-order-template-item-meta">
                    {t.fields.length} 个字段 · 分隔符：{SEPARATOR_LABELS[t.separator]} · {t.headerRow === 1 ? "第 1 行为表头" : "无表头（按位置）"}
                  </div>
                  {t.description ? <div className="batch-order-template-item-desc">{t.description}</div> : null}
                </div>
                <div className="batch-order-template-item-actions">
                  {!active ? (
                    <button type="button" className="batch-order-tpl-btn" onClick={() => props.onActivate(t.id)}>使用</button>
                  ) : null}
                  <button type="button" className="batch-order-tpl-btn" onClick={() => props.onEdit(t)}><Pencil size={12} />编辑</button>
                  {!t.builtin ? (
                    <button type="button" className="batch-order-tpl-btn batch-order-tpl-btn-danger" onClick={() => props.onDelete(t)}><Trash2 size={12} />删除</button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        <div className="batch-order-template-footer">
          <button type="button" className="button button-primary batch-order-template-new" onClick={props.onNew}><Plus size={15} />新建模板</button>
        </div>
      </section>
    </div>
  );
}

function TemplateEditor(props: {
  template: FormatTemplate;
  onCancel: () => void;
  onSave: () => void;
  onChangeField: (idx: number, key: keyof TemplateField, value: any) => void;
  onAddField: () => void;
  onRemoveField: (idx: number) => void;
  onMoveField: (idx: number, dir: -1 | 1) => void;
  onChangeMeta: (patch: Partial<FormatTemplate>) => void;
  error: string;
}) {
  const t = props.template;
  const fieldKeyUsed = new Set(t.fields.map((f) => f.key));
  const canAdd = FIELD_OPTIONS.some((o) => !fieldKeyUsed.has(o.key));
  return (
    <div className="batch-order-detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onCancel()}>
      <section className="batch-order-detail-modal batch-order-template-modal" role="dialog" aria-modal="true">
        <button className="batch-order-detail-close" type="button" onClick={props.onCancel} aria-label="关闭"><X size={18} /></button>
        <header>
          <small>{t.builtin ? "VIEW BUILT-IN" : "EDIT TEMPLATE"}</small>
          <h2>{t.builtin ? "查看模板（内置只读）" : "编辑模板"}</h2>
          <p>配置字段映射 + 分隔符 + 表头行；保存后立即生效</p>
        </header>

        <div className="batch-order-template-form">
          <label className="batch-order-tpl-field">
            <span>模板名称 *</span>
            <input
              value={t.name}
              onChange={(e) => props.onChangeMeta({ name: e.target.value })}
              placeholder="例如：我的微信账单 / 拼多多导单"
              disabled={!!t.builtin}
            />
          </label>
          <label className="batch-order-tpl-field">
            <span>说明（选填）</span>
            <input
              value={t.description || ""}
              onChange={(e) => props.onChangeMeta({ description: e.target.value })}
              placeholder="这个模板适用的来源 / 备注"
              disabled={!!t.builtin}
            />
          </label>
          <div className="batch-order-tpl-row">
            <label className="batch-order-tpl-field">
              <span>分隔符</span>
              <select
                value={t.separator}
                onChange={(e) => props.onChangeMeta({ separator: e.target.value as SeparatorType })}
                disabled={!!t.builtin}
              >
                {(Object.keys(SEPARATOR_LABELS) as SeparatorType[]).map((k) => (
                  <option key={k} value={k}>{SEPARATOR_LABELS[k]}</option>
                ))}
              </select>
            </label>
            <label className="batch-order-tpl-field">
              <span>表头行</span>
              <select
                value={String(t.headerRow)}
                onChange={(e) => props.onChangeMeta({ headerRow: Number(e.target.value) as 0 | 1 })}
                disabled={!!t.builtin}
              >
                <option value="1">第 1 行是表头（按识别词匹配）</option>
                <option value="0">无表头（按字段顺序映射）</option>
              </select>
            </label>
          </div>
        </div>

        <div className="batch-order-template-fields">
          <div className="batch-order-template-fields-title">
            <span>字段映射</span>
            <span className="batch-order-template-fields-hint">
              {t.headerRow === 1
                ? "表头识别词任一命中即视为该列；识别不到则该列被忽略"
                : "按字段在下方列表的顺序映射到第 1 / 2 / 3… 列"}
            </span>
          </div>
          {t.fields.map((f, i) => {
            return (
              <div key={`${f.key}-${i}`} className="batch-order-tpl-row-item">
                <div className="batch-order-tpl-row-num">{i + 1}</div>
                <select
                  className="batch-order-tpl-row-key"
                  value={f.key}
                  onChange={(e) => props.onChangeField(i, "key", e.target.value)}
                  disabled={!!t.builtin}
                >
                  {FIELD_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key} disabled={o.key !== f.key && fieldKeyUsed.has(o.key)}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  className="batch-order-tpl-row-aliases"
                  value={f.aliases.join(" / ")}
                  placeholder="识别词（/ 分隔，如 收款时间 / 支付时间）"
                  onChange={(e) => props.onChangeField(i, "aliases", e.target.value.split(/[/,，]/).map((s) => s.trim()).filter(Boolean))}
                  disabled={!!t.builtin}
                />
                <input
                  className="batch-order-tpl-row-dropdown"
                  value={(f.dropdown || []).join(" / ")}
                  placeholder="下拉（/ 分隔，留空 = 自由文本）"
                  onChange={(e) => props.onChangeField(i, "dropdown", e.target.value.split(/[/,，]/).map((s) => s.trim()).filter(Boolean))}
                  disabled={!!t.builtin}
                />
                <label className="batch-order-tpl-row-required">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => props.onChangeField(i, "required", e.target.checked)}
                    disabled={!!t.builtin}
                  />
                  <span>必填</span>
                </label>
                <div className="batch-order-tpl-row-move">
                  <button type="button" onClick={() => props.onMoveField(i, -1)} disabled={i === 0 || !!t.builtin}>↑</button>
                  <button type="button" onClick={() => props.onMoveField(i, 1)} disabled={i === t.fields.length - 1 || !!t.builtin}>↓</button>
                </div>
                <button type="button" className="batch-order-tpl-row-del" onClick={() => props.onRemoveField(i)} disabled={!!t.builtin}>×</button>
              </div>
            );
          })}
          {!t.builtin ? (
            <button type="button" className="batch-order-tpl-add" onClick={props.onAddField} disabled={!canAdd}>
              <Plus size={13} />{canAdd ? "添加字段" : "已添加所有可选字段"}
            </button>
          ) : null}
        </div>

        {props.error ? <p className="tool-error batch-order-error">{props.error}</p> : null}

        <div className="batch-order-template-footer">
          <button type="button" className="batch-order-confirm-cancel" onClick={props.onCancel}>取消</button>
          {!t.builtin ? (
            <button type="button" className="batch-order-confirm-ok" onClick={props.onSave}>保存模板</button>
          ) : (
            <button type="button" className="batch-order-confirm-ok" onClick={props.onCancel}>关闭</button>
          )}
        </div>
      </section>
    </div>
  );
}
