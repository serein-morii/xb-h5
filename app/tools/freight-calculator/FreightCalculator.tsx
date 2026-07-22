import { ArrowDownAZ, Calculator, CheckCircle2, ClipboardCopy, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { extractProvince, FreightCompany, FreightRow, parsePastedRows, priceFor } from "../freight-data";

type CalcResult = FreightRow & { index: number; province: string; ok: boolean; price: number; text: string };

async function readExcel(file: File): Promise<FreightRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return (XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet) || []).flatMap((row) => {
    const spec = String(row["商品规格"] || "").trim();
    const address = String(row["地址"] || "").trim();
    if (!spec || !address) return [];
    return [{
      name: String(row["收件人"] || "").trim(),
      spec,
      address,
      company: String(row["快递公司"] || "京东").trim() || "京东",
    }];
  });
}

function normalizeCompany(company: string) {
  if (company.includes("京东")) return "京东";
  if (company.includes("顺丰")) return "顺丰";
  if (company.includes("邮政") || company.toUpperCase().includes("EMS")) return "邮政";
  return company;
}

function calculateRows(rows: FreightRow[]): CalcResult[] {
  return rows.map((row, position) => {
    const index = position + 1;
    const province = extractProvince(row.address);
    const company = normalizeCompany(row.company);
    const price = priceFor(company, province, row.spec);
    const ok = typeof price === "number";
    return {
      ...row, company, index, province, ok, price: price || 0,
      text: ok
        ? `✅ 第${index}单 - ${row.name || "未知"} - ${company} - ${province} - ${row.spec}：¥${price}`
        : `❌ 第${index}单 - ${row.name || "未知"}：无价格配置 → ${company} - ${province} - ${row.spec}`,
    };
  });
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

function sortedSummary(results: CalcResult[], companies: FreightCompany[]) {
  const sections = companies.flatMap((company) => {
    const rows = results.filter((row) => row.ok && row.company === company).sort((a, b) => a.price - b.price || a.province.localeCompare(b.province, "zh-CN"));
    return rows.length ? [summary(rows, `${company}排序`)] : [];
  });
  return sections.length ? sections.join("\n\n") : "暂无对应快递公司的有效价格数据。";
}

export default function FreightCalculator() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<CalcResult[]>([]);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const total = useMemo(() => results.filter((row) => row.ok).reduce((sum, row) => sum + row.price, 0), [results]);

  async function calculate() {
    setLoading(true); setMessage("");
    try {
      const rows = file ? await readExcel(file) : parsePastedRows(text);
      if (!rows.length) throw new Error("没有识别到有效数据，请检查表头或粘贴内容");
      const next = calculateRows(rows);
      setResults(next); setOutput(summary(next));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "计算失败"); }
    finally { setLoading(false); }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null); setMessage("");
  }

  async function copy() {
    if (!output) return setMessage("请先计算运费");
    await navigator.clipboard.writeText(output); setMessage("计算结果已复制");
  }

  return <div className="tool-page freight-tool">
    <section className="tool-hero tool-hero-amber"><span><Calculator size={25} /></span><div><small>FREIGHT CALCULATOR</small><h1>寄递运费计算</h1><p>批量识别省份、规格和快递公司，并自动汇总运费。</p></div></section>
    <section className="tool-form-card">
      <div className="tool-section-title"><div><b>导入订单数据</b><p>Excel 与粘贴数据二选一，Excel 优先读取。</p></div><FileSpreadsheet size={20} /></div>
      <label className={`tool-upload ${file ? "selected" : ""}`}><Upload size={20} /><span><b>{file ? file.name : "选择 Excel 文件"}</b><small>表头需要包含：收件人、商品规格、地址、快递公司</small></span><input type="file" accept=".xlsx,.xls" onChange={chooseFile} /></label>
      <div className="tool-divider"><span>或粘贴数据</span></div>
      <label className="tool-textarea"><span>订单 JSON / Excel 表格内容</span><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={'支持接口返回的 {"rows": [...]}，也支持直接从 Excel 复制的制表符内容'} /></label>
      {message ? <p className={message.includes("已复制") ? "tool-success" : "tool-error"}>{message}</p> : null}
      <button className="tool-primary tool-primary-amber" disabled={loading} type="button" onClick={calculate}>{loading ? <LoaderCircle className="spin" size={18} /> : <Calculator size={18} />}{loading ? "正在计算" : "开始计算"}</button>
    </section>
    {results.length ? <section className="freight-result-card">
      <header><div><small>计算完成</small><h2>{results.length} 个订单</h2></div><strong><small>总运费</small>¥{total}</strong></header>
      <div className="freight-actions"><button type="button" onClick={() => setOutput(sortedSummary(results, ["京东", "顺丰"]))}><ArrowDownAZ size={15} />京东 + 顺丰</button><button type="button" onClick={() => setOutput(sortedSummary(results, ["京东"]))}>京东排序</button><button type="button" onClick={() => setOutput(sortedSummary(results, ["顺丰"]))}>顺丰排序</button><button type="button" className="primary" onClick={copy}><ClipboardCopy size={15} />复制</button></div>
      <pre className="freight-output">{output}</pre>
    </section> : null}
    {message === "计算结果已复制" ? <div className="public-copy-toast"><CheckCircle2 size={16} />计算结果已复制</div> : null}
  </div>;
}
