
import { AlertCircle, CheckCircle2, ChevronRight, ClipboardPaste, FileSpreadsheet, LoaderCircle, MapPin, Store, Upload, UserCheck, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";

type Row = Record<string, any>;
type ItemResult = { rowIndex: number; status: "success" | "duplicate" | "failed"; message: string; shortId?: string; orderCodes?: string; createdCount?: number };
type BatchResponse = { totalCount: number; successCount: number; duplicateCount: number; failedCount: number; results: ItemResult[] };
type PreviewSummary = { total: number; exists: number; newCount: number; invalid: number; duplicate: number };
type PreviewPurchaser = { id: number; shortId: string; name: string; phone: string; storeName: string };
type PreviewItem = { rowIndex: number; customerName: string; phone: string; orderItem: string; orderTime: string; quantity: number; buyerStatus: "exists" | "new" | "invalid" | "duplicate"; existingPurchaser?: PreviewPurchaser; message: string };
type PreviewResponse = { summary: PreviewSummary; items: PreviewItem[] };
// 用户对每行的决定：create / use / skip
type Decision = "create" | "use" | "skip";

// 简易 emoji 映射（防商品名没匹配上 PRODUCT_EMOJI 时显示 📦）
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

// Excel 列名 -> 后端字段映射
const HEADER_MAP: Record<string, string> = {
  "收款时间": "orderTime", "收款总金额": "totalAmount", "付款方昵称": "payerNickname",
  "收款项": "orderItem", "收款项金额": "itemAmount", "数量": "quantity",
  "地址": "address", "姓名": "customerName", "电话": "phone",
  "付款备注": "paymentRemark", "商家备注": "merchantRemark", "是否已标记": "isMarked",
  "顾客优惠": "customerDiscount", "是否退款": "isRefunded", "收款说明": "paymentNote", "收款链接": "paymentLink",
};

function parseRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());
  return line.split(/\s{2,}/).map((s) => s.trim());
}

function normalizeDate(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/\//g, "-").trim();
  const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")} ${h.padStart(2, "0")}:${mi.padStart(2, "0")}:${s.padStart(2, "0")}`;
  }
  return cleaned;
}

export default function BatchOrderEntry() {
  const [storeCode, setStoreCode] = useState("");
  const [stores, setStores] = useState<Row[]>([]);
  const [rawText, setRawText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<{ type: "preview" | "result"; data: any } | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  // 预览结果（每行买家状态）
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // 用户对每行的决定（rowIndex -> decision）
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [results, setResults] = useState<BatchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiRequest<{ data?: Row[] }>("/search/store", { auth: false, query: { createBy: "", name: "" } })
      .then((r) => {
        const rows = Array.isArray(r.data) ? r.data.filter((s) => Number(s.isDelete ?? 1) === 1) : [];
        setStores(rows);
        if (rows[0]?.code) setStoreCode(String(rows[0].code));
      })
      .catch(() => setError("店铺列表加载失败"));
  }, []);

  function parseText(text: string) {
    setError(""); setResults(null); setPreview(null); setDecisions({});
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setError("内容为空"); return; }
    const headerIdx = lines.findIndex((l) => l.includes("收款时间") && l.includes("姓名") && l.includes("电话"));
    if (headerIdx < 0) { setError("找不到表头行（应包含「收款时间」「姓名」「电话」）"); return; }
    const headers = parseRow(lines[headerIdx]);
    const colIdx: Record<string, number> = {};
    headers.forEach((h, i) => { const field = HEADER_MAP[h.trim()]; if (field) colIdx[field] = i; });
    if (colIdx.orderTime === undefined || colIdx.customerName === undefined) { setError("表头缺少必要列（收款时间 / 姓名）"); return; }
    const parsed: Row[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cells = parseRow(lines[i]);
      if (cells.every((c) => !c)) continue;
      const item: Row = {};
      Object.keys(colIdx).forEach((field) => {
        const idx = colIdx[field];
        let val: any = cells[idx] || "";
        if (field === "orderTime") val = normalizeDate(val);
        if (field === "quantity") val = Number(val) || 1;
        item[field] = val;
      });
      if (!item.customerName || !item.phone) continue;
      parsed.push(item);
    }
    setItems(parsed);
    if (parsed.length === 0) { setError("解析后没有有效行（缺姓名/电话）"); return; }
    // 解析成功后自动调 preview
    runPreview(parsed);
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
      // 默认决定：exists -> use，new -> create，invalid/duplicate -> skip
      const init: Record<number, Decision> = {};
      data.items.forEach((it) => {
        if (it.buyerStatus === "exists") init[it.rowIndex] = "use";
        else if (it.buyerStatus === "new") init[it.rowIndex] = "create";
        else init[it.rowIndex] = "skip";
      });
      setDecisions(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : "预览失败");
    } finally {
      setPreviewing(false);
    }
  }

  function handlePaste() {
    if (!rawText.trim()) { setError("请先粘贴内容"); return; }
    parseText(rawText);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      try {
        const XLSX = await import("xlsx");
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) { setError("Excel 文件没有可读工作表"); event.target.value = ""; return; }
        const sheet = workbook.Sheets[firstSheetName];
        const text = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
        setRawText(text);
        parseText(text);
      } catch (e) {
        setError(e instanceof Error ? `Excel 解析失败：${e.message}` : "Excel 解析失败");
      }
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => { const text = String(e.target?.result || ""); setRawText(text); parseText(text); };
    reader.readAsText(file, "utf-8");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!storeCode) return setError("请先选择店铺");
    if (items.length === 0) return setError("没有可录入的订单，请先粘贴并解析");
    const pending = preview?.items.filter((it) => decisions[it.rowIndex] !== "skip") ?? [];
    if (pending.length === 0) return setError("所有行都被跳过，没有可录入的订单");
    setConfirmOpen(true);
  }

  async function confirmSubmit() {
    setConfirmOpen(false);
    setBusy(true); setError(""); setResults(null);
    try {
      // 把决定写回 items（映射成后端 buyerAction + existingPurchaserId）
      const previewMap = new Map((preview?.items ?? []).map((it) => [it.rowIndex, it]));
      const payloadItems = items.map((it, idx) => {
        const pi = previewMap.get(idx);
        const dec = decisions[idx] || "skip";
        const action = dec === "use" ? "use_existing" : dec === "create" ? "create_new" : "skip";
        return { ...it, buyerAction: action, existingPurchaserId: dec === "use" ? pi?.existingPurchaser?.id : undefined };
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
          <header><span>2</span><div><h2>粘贴内容</h2><p>自动定位表头行，之后是数据</p></div></header>
          <div className="batch-order-toolbar">
            <button type="button" className="batch-order-file-btn" onClick={() => fileRef.current?.click()}><Upload size={15} />选择文件</button>
            <input ref={fileRef} hidden type="file" accept=".txt,.csv,.xlsx,.xls" onChange={handleFile} />
            <button type="button" className="batch-order-parse-btn" onClick={handlePaste}><ClipboardPaste size={15} />解析内容</button>
          </div>
          <textarea
            className="batch-order-textarea"
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"示例（粘贴到这里）：\n收款时间\t收款项\t数量\t地址\t姓名\t电话\t付款备注\n2024-01-15 10:30\t苹果\t1\t上海市青浦区\t张三\t13800000000\t送货前联系"}
          />
        </section>

        {preview ? (
          <section className="batch-order-section">
            <header><span>3</span><div><h2>买家确认（{preview.summary.total} 条）</h2><p>已存在 {preview.summary.exists} · 待新建 {preview.summary.newCount} · 重复 {preview.summary.duplicate} · 无效 {preview.summary.invalid}</p></div></header>
            <div className="batch-order-list">
              {preview.items.map((it) => {
                const dec = decisions[it.rowIndex] || "skip";
                return (
                  <article key={it.rowIndex} className={`batch-order-card batch-order-card-${STATUS_TONE[it.buyerStatus]}`}>
                    <div className="batch-order-card-top">
                      <span className="batch-order-card-num">#{it.rowIndex + 1}</span>
                      <span className={`batch-order-status batch-order-status-${STATUS_TONE[it.buyerStatus]}`}>{STATUS_LABEL[it.buyerStatus]}</span>
                      <button type="button" className="batch-order-card-detail-btn" onClick={() => setDetail({ type: "preview", data: items[it.rowIndex] })}><ChevronRight size={14} /></button>
                    </div>
                    <div className="batch-order-card-product">
                      <span className="batch-order-card-emoji">{emojiFor(String(it.orderItem || ""))}</span>
                      <span className="batch-order-card-label">{String(it.orderItem || "--")}</span>
                      {Number(it.quantity) > 1 ? <span className="batch-order-card-split">×{it.quantity}</span> : null}
                    </div>
                    <div className="batch-order-card-meta">
                      <div><span className="batch-order-card-meta-label">收件人</span><span className="batch-order-card-meta-value">{String(it.customerName || "--")}</span></div>
                      <div><span className="batch-order-card-meta-label">电话</span><span className="batch-order-card-meta-value">{String(it.phone || "--")}</span></div>
                    </div>
                    {it.existingPurchaser ? (
                      <div className="batch-order-card-existing">已存在买家：{it.existingPurchaser.name} · ID {it.existingPurchaser.shortId} · 店铺 {it.existingPurchaser.storeName || "--"}</div>
                    ) : null}
                    <div className="batch-order-card-decisions">
                      {it.buyerStatus === "exists" ? (
                        <button type="button" className={`batch-order-decision ${dec === "use" ? "active" : ""}`} onClick={() => setDecisions((c) => ({ ...c, [it.rowIndex]: "use" }))}><UserCheck size={14} />用已有</button>
                      ) : null}
                      <button type="button" className={`batch-order-decision ${dec === "create" ? "active" : ""}`} onClick={() => setDecisions((c) => ({ ...c, [it.rowIndex]: "create" }))}><UserPlus size={14} />新建</button>
                      <button type="button" className={`batch-order-decision batch-order-decision-skip ${dec === "skip" ? "active" : ""}`} onClick={() => setDecisions((c) => ({ ...c, [it.rowIndex]: "skip" }))}>跳过</button>
                    </div>
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
          <button type="button" className="button button-ghost" onClick={() => { setRawText(""); setItems([]); setResults(null); setPreview(null); setDecisions({}); setError(""); }}><X size={15} />清空</button>
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
            <p>行 #{detail.data.rowIndex !== undefined ? Number(detail.data.rowIndex) + 1 : "?"}</p>
          </header>
          {detail.type === "preview" ? (
            <div className="batch-order-detail-list">
              {[
                ["收款时间", detail.data.orderTime],
                ["商品", detail.data.orderItem],
                ["数量", detail.data.quantity],
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
    </div>
  );
}
