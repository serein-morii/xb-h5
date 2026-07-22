import { CheckCircle2, ClipboardCopy, Download, FileSpreadsheet, LoaderCircle, Scale, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { extractProvince, FreightRow, parsePastedRows, priceFor } from "../freight-data";

type CompareRow = FreightRow & { index: number; province: string; 京东?: number; 顺丰?: number; 邮政?: number };

async function readExcel(file: File): Promise<FreightRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return (XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet) || []).flatMap((row) => {
    const spec = String(row["商品规格"] || "").trim();
    const address = String(row["地址"] || "").trim();
    return spec && address ? [{ name: String(row["收件人"] || "").trim(), spec, address, company: "" }] : [];
  });
}

function buildRows(rows: FreightRow[]): CompareRow[] {
  return rows.map((row, position) => {
    const province = extractProvince(row.address);
    return { ...row, index: position + 1, province, 京东: priceFor("京东", province, row.spec), 顺丰: priceFor("顺丰", province, row.spec), 邮政: priceFor("邮政", province, row.spec) };
  });
}

function clipboardText(rows: CompareRow[]) {
  return [["#", "姓名", "地址", "省份", "规格", "京东", "顺丰", "邮政"].join("\t"), ...rows.map((row) => [row.index, row.name, row.address, row.province, row.spec, row.京东 ?? "-", row.顺丰 ?? "-", row.邮政 ?? "-"].join("\t"))].join("\n");
}

export default function FreightCompare() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const savings = useMemo(() => rows.reduce((sum, row) => sum + (typeof row.京东 === "number" && typeof row.顺丰 === "number" ? Math.abs(row.京东 - row.顺丰) : 0), 0), [rows]);

  async function compare() {
    setLoading(true); setMessage("");
    try {
      const source = file ? await readExcel(file) : parsePastedRows(text);
      if (!source.length) throw new Error("没有识别到有效数据，请检查表头或粘贴内容");
      setRows(buildRows(source));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "对比失败"); }
    finally { setLoading(false); }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] || null); setMessage(""); }
  async function copy() { if (!rows.length) return; await navigator.clipboard.writeText(clipboardText(rows)); setMessage("对比表已复制"); }
  async function exportExcel() {
    if (!rows.length) return;
    const XLSX = await import("xlsx");
    const data = rows.map((row) => ({ 序号: row.index, 收件人: row.name, 地址: row.address, 省份: row.province, 商品规格: row.spec, 京东: row.京东 ?? "-", 顺丰: row.顺丰 ?? "-", 邮政: row.邮政 ?? "-" }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), "运费对比");
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    XLSX.writeFile(workbook, `运费对比表_${timestamp}.xlsx`);
  }

  return <div className="tool-page freight-tool">
    <section className="tool-hero tool-hero-blue"><span><Scale size={25} /></span><div><small>FREIGHT COMPARISON</small><h1>运费对比</h1><p>同一批地址同时计算三家快递，快速找出更优价格。</p></div></section>
    <section className="tool-form-card">
      <div className="tool-section-title"><div><b>导入待比较订单</b><p>表头需要包含收件人、商品规格和地址。</p></div><FileSpreadsheet size={20} /></div>
      <label className={`tool-upload tool-upload-blue ${file ? "selected" : ""}`}><Upload size={20} /><span><b>{file ? file.name : "选择 Excel 文件"}</b><small>支持 .xlsx 和 .xls 文件</small></span><input type="file" accept=".xlsx,.xls" onChange={chooseFile} /></label>
      <div className="tool-divider"><span>或粘贴数据</span></div>
      <label className="tool-textarea"><span>订单 JSON / Excel 表格内容</span><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="粘贴接口 rows 数据，或从 Excel 直接复制订单行" /></label>
      {message && message !== "对比表已复制" ? <p className="tool-error">{message}</p> : null}
      <button className="tool-primary tool-primary-blue" disabled={loading} type="button" onClick={compare}>{loading ? <LoaderCircle className="spin" size={18} /> : <Scale size={18} />}{loading ? "正在对比" : "生成对比表"}</button>
    </section>
    {rows.length ? <section className="freight-result-card compare-card"><header><div><small>对比完成</small><h2>{rows.length} 个地址</h2></div><strong><small>京东 / 顺丰价差合计</small>¥{savings}</strong></header><div className="freight-actions freight-export-actions"><button type="button" onClick={copy}><ClipboardCopy size={15} />复制表格</button><button type="button" className="primary blue" onClick={exportExcel}><Download size={15} />导出 Excel</button></div><div className="freight-table-wrap"><table className="freight-table"><thead><tr><th>#</th><th>收件人 / 地址</th><th>省份</th><th>规格</th><th>京东</th><th>顺丰</th><th>邮政</th></tr></thead><tbody>{rows.map((row) => { const prices = [row.京东, row.顺丰].filter((price): price is number => typeof price === "number"); const min = prices.length ? Math.min(...prices) : -1; const max = prices.length ? Math.max(...prices) : -1; return <tr key={row.index}><td>{row.index}</td><td><b>{row.name || "未填写"}</b><small>{row.address}</small></td><td>{row.province}</td><td>{row.spec}</td><td className={row.京东 === min ? "price-low" : row.京东 === max && min !== max ? "price-high" : ""}>{row.京东 == null ? "-" : `¥${row.京东}`}</td><td className={row.顺丰 === min ? "price-low" : row.顺丰 === max && min !== max ? "price-high" : ""}>{row.顺丰 == null ? "-" : `¥${row.顺丰}`}</td><td>{row.邮政 == null ? "-" : `¥${row.邮政}`}</td></tr>; })}</tbody></table></div></section> : null}
    {message === "对比表已复制" ? <div className="public-copy-toast"><CheckCircle2 size={16} />对比表已复制</div> : null}
  </div>;
}
