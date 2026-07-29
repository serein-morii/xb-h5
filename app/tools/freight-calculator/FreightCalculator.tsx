import { Calculator, CheckCircle2, ClipboardCopy, FileSpreadsheet, LoaderCircle, Truck, Upload, X } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { copyToClipboard } from "../../lib/api";
import { extractProvince, freightRowFromRecord, FreightRow, parsePastedRows, priceFor } from "../freight-data";

type CalcResult = FreightRow & { index: number; province: string; ok: boolean; price: number; text: string };
const COMPANY_SORT_ORDER = ["顺丰", "京东", "邮政"];

async function readExcel(file: File): Promise<FreightRow[]> {
  const { readExcelJson } = await import("../../lib/excel");
  return (await readExcelJson(file)).flatMap((row) => {
    const parsedRow = freightRowFromRecord(row);
    return parsedRow ? [parsedRow] : [];
  });
}

function normalizeCompany(company: string) {
  if (company.includes("京东")) return "京东";
  if (company.includes("顺丰")) return "顺丰";
  if (company.includes("邮政") || company.toUpperCase().includes("EMS")) return "邮政";
  return company;
}

async function calculateRows(rows: FreightRow[], onProgress: (value: number) => void): Promise<CalcResult[]> {
  const calculated: CalcResult[] = [];
  const batchSize = Math.max(1, Math.ceil(rows.length / 40));
  for (let position = 0; position < rows.length; position += 1) {
    const row = rows[position];
    const index = position + 1;
    const province = extractProvince(row.address);
    const company = normalizeCompany(row.company);
    const price = priceFor(company, province, row.spec);
    const ok = typeof price === "number";
    calculated.push({
      ...row, company, index, province, ok, price: price || 0,
      text: ok
        ? `✅ ${row.orderNo ? `订单 ${row.orderNo}` : `第${index}单`} - ${row.name || "未知"} - ${company} - ${province} - ${row.spec}：¥${price}`
        : `❌ ${row.orderNo ? `订单 ${row.orderNo}` : `第${index}单`} - ${row.name || "未知"}：无价格配置 → ${company} - ${province} - ${row.spec}`,
    });
    if ((position + 1) % batchSize === 0 || position === rows.length - 1) {
      onProgress(20 + Math.round(((position + 1) / rows.length) * 75));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }
  return calculated;
}

function weightInKilograms(spec: string) {
  const normalized = spec.trim();
  if (normalized === "大果" || normalized === "大") return 6;
  if (normalized === "小果" || normalized === "小") return 3;
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|公斤|斤)?/i);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2] === "斤" ? value / 2 : value;
}

function mixedComparator(companies: string[]) {
  const companyOrder = new Map(companies.map((company, index) => [company, index]));
  return (a: CalcResult, b: CalcResult) =>
    (companyOrder.get(a.company) ?? Number.MAX_SAFE_INTEGER) - (companyOrder.get(b.company) ?? Number.MAX_SAFE_INTEGER)
    || weightInKilograms(b.spec) - weightInKilograms(a.spec)
    || a.price - b.price
    || a.province.localeCompare(b.province, "zh-CN");
}

function summary(results: CalcResult[], title = "计算明细") {
  const valid = results.filter((row) => row.ok);
  const total = valid.reduce((sum, row) => sum + row.price, 0);
  const stats = new Map<string, { price: number; count: number; total: number }>();
  valid.forEach((row) => {
    const key = `${row.company} · ${row.province} · ${row.spec}`;
    const item = stats.get(key) || { price: row.price, count: 0, total: 0 };
    item.count += 1;
    item.total += row.price;
    stats.set(key, item);
  });
  const statLines = Array.from(stats.entries()).map(([key, item]) => `${key} ¥${item.price} × ${item.count} = ¥${item.total}`);
  return [`【${title}】`, ...results.map((row) => row.text), "", `成功 ${valid.length} 单 · 无价格 ${results.length - valid.length} 单`, `总运费：¥${total}`, ...(statLines.length ? ["", "【分类统计】", ...statLines] : [])].join("\n");
}

export default function FreightCalculator() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<CalcResult[]>([]);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [sortCompany, setSortCompany] = useState("");
  const [pendingRows, setPendingRows] = useState<FreightRow[] | null>(null);

  const total = useMemo(() => results.filter((row) => row.ok).reduce((sum, row) => sum + row.price, 0), [results]);

  // 从计算结果里动态提取出现的快递公司（按出现顺序）
  const availableCompanies = useMemo(() => {
    const seen: string[] = [];
    results.forEach((row) => { if (row.ok && row.company && !seen.includes(row.company)) seen.push(row.company); });
    return seen.sort((a, b) => {
      const aIndex = COMPANY_SORT_ORDER.indexOf(a);
      const bIndex = COMPANY_SORT_ORDER.indexOf(b);
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex)
        || a.localeCompare(b, "zh-CN");
    });
  }, [results]);

  function sortAndOutput(companies: string[]) {
    if (companies.length === 0) return;
    const rows = results.filter((row) => row.ok && companies.includes(row.company))
      .sort(mixedComparator(companies));
    setOutput(rows.length ? summary(rows, `${companies.length > 1 ? "混排" : `${companies[0]}排序`}`) : "暂无对应快递公司的有效价格数据。");
  }

  // 分类排：按快递公司分组，每组内依次按重量、价格和省份排序
  function sortGrouped(companies: string[]) {
    if (companies.length === 0) return;
    const sections = companies.flatMap((company) => {
      const rows = results.filter((row) => row.ok && row.company === company).sort(mixedComparator([company]));
      return rows.length ? [summary(rows, `${company}排序`)] : [];
    });
    setOutput(sections.length ? sections.join("\n\n") : "暂无对应快递公司的有效价格数据。");
  }

  async function calculatePreparedRows(rows: FreightRow[]) {
    setLoading(true);
    setProgress(20);
    setMessage("");
    try {
      setProgress(20);
      const next = await calculateRows(rows, setProgress);
      setResults(next); setOutput(summary(next));
      setProgress(100);
    } catch (cause) {
      setProgress(0);
      setMessage(cause instanceof Error ? cause.message : "计算失败");
    }
    finally { setLoading(false); }
  }

  async function calculate() {
    setLoading(true); setProgress(5); setMessage("");
    try {
      const rows = file ? await readExcel(file) : parsePastedRows(text);
      if (!rows.length) throw new Error("没有识别到有效数据，请检查表头或粘贴内容");
      if (rows.some((row) => !row.company.trim())) {
        setPendingRows(rows);
        setProgress(0);
        setLoading(false);
        return;
      }
      await calculatePreparedRows(rows);
    } catch (cause) {
      setProgress(0);
      setMessage(cause instanceof Error ? cause.message : "计算失败");
      setLoading(false);
    }
  }

  function chooseDefaultCompany(company: string) {
    if (!pendingRows) return;
    const rows = pendingRows.map((row) => ({ ...row, company: row.company.trim() || company }));
    setPendingRows(null);
    void calculatePreparedRows(rows);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;
    if (next?.name.toLowerCase().endsWith(".xls")) {
      setFile(null);
      setMessage("旧版 .xls 暂不支持，请在 Excel 中另存为 .xlsx 后重试");
      event.target.value = "";
      return;
    }
    setFile(next); setProgress(0); setMessage("");
  }

  async function copy() {
    if (!output) return setMessage("请先计算运费");
    const ok = await copyToClipboard(output);
    setMessage(ok ? "计算结果已复制" : "复制失败，请手动选择文本复制");
  }

  return <div className="tool-page freight-tool">
    <section className="tool-hero"><span><Calculator size={25} /></span><div><small>FREIGHT CALCULATOR</small><h1>寄递运费计算</h1><p>批量识别省份、规格和快递公司，并自动汇总运费。</p></div></section>
    <section className="tool-form-card">
      <div className="tool-section-title"><div><b>导入订单数据</b><p>Excel 与粘贴数据二选一，Excel 优先读取。</p></div><FileSpreadsheet size={20} /></div>
      <label className={`tool-upload ${file ? "selected" : ""}`}><Upload size={20} /><span><b>{file ? file.name : "选择 Excel 文件"}</b><small>支持 .xlsx，兼容商品规格/商品重量、收件地址、快递等常见表头</small></span><input type="file" accept=".xlsx" onChange={chooseFile} /></label>
      <div className="tool-divider"><span>或粘贴数据</span></div>
      <label className="tool-textarea"><span>订单 JSON / Excel 表格内容</span><textarea value={text} onChange={(event) => { setText(event.target.value); setProgress(0); }} placeholder={'支持接口返回的 {"rows": [...]}，也支持直接从 Excel 复制的制表符内容'} /></label>
      {message ? <p className={message.includes("已复制") ? "tool-success" : "tool-error"}>{message}</p> : null}
      {progress > 0 ? <div className={`freight-progress ${progress === 100 ? "complete" : ""}`} role="progressbar" aria-label="运费计算进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div><span>{progress < 20 ? "正在读取数据" : progress < 100 ? "正在计算运费" : "计算完成"}</span><b>{progress}%</b></div>
        <div className="freight-progress-track"><span style={{ width: `${progress}%` }} /></div>
      </div> : null}
      <button className="tool-primary" disabled={loading} type="button" onClick={calculate}>{loading ? <LoaderCircle className="spin" size={18} /> : <Calculator size={18} />}{loading ? `正在计算 ${progress}%` : "开始计算"}</button>
    </section>
    {results.length ? <section className="freight-result-card">
      <header><div><small>计算完成</small><h2>{results.length} 个订单</h2></div><strong><small>总运费</small>¥{total}</strong></header>
      <div className="freight-actions">
        <select className="freight-sort-select" value={sortCompany} onChange={(e) => setSortCompany(e.target.value)}>
          <option value="">全部（{availableCompanies.length}家）</option>
          {availableCompanies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={() => { const list = sortCompany ? [sortCompany] : availableCompanies; sortAndOutput(list); }}>混排</button>
        <button type="button" onClick={() => { const list = sortCompany ? [sortCompany] : availableCompanies; sortGrouped(list); }}>分类排</button>
        <button type="button" className="primary" onClick={copy}><ClipboardCopy size={15} />复制</button>
      </div>
      <pre className="freight-output">{output}</pre>
    </section> : null}
    {pendingRows ? <div className="freight-company-backdrop">
      <section className="freight-company-dialog" role="dialog" aria-modal="true" aria-labelledby="freight-company-title">
        <button className="freight-company-close" type="button" aria-label="关闭快递选择" onClick={() => setPendingRows(null)}><X size={18} /></button>
        <span className="freight-company-icon"><Truck size={22} /></span>
        <small>统一补充快递</small>
        <h2 id="freight-company-title">请选择本批订单的快递</h2>
        <p>检测到 {pendingRows.filter((row) => !row.company.trim()).length} 条订单没有快递，选择后将统一应用到缺失订单。</p>
        <div className="freight-company-options">
          {COMPANY_SORT_ORDER.map((company) => <button type="button" key={company} onClick={() => chooseDefaultCompany(company)}><span>{company.slice(0, 1)}</span><b>{company}</b></button>)}
        </div>
      </section>
    </div> : null}
    {message === "计算结果已复制" ? <div className="public-copy-toast"><CheckCircle2 size={16} />计算结果已复制</div> : null}
  </div>;
}
