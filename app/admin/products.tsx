import { Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { DictionaryContext } from "./core";

type Sku = { id?: number; skuCode: string; displayName: string; specValues: string; billOrderType?: string; salePrice: number | string; stock?: number | null; status: number; sortNum: number };
type Product = { id?: number; productCode: string; name: string; subtitle: string; description: string; coverUrl: string; specSchema: string; status: number; sortNum: number; skus: Sku[] };
type SpecGroup = { name: string; values: string[] };
const EMPTY_PRODUCT: Product = { productCode: "", name: "", subtitle: "", description: "", coverUrl: "", specSchema: "[]", status: 1, sortNum: 0, skus: [{ skuCode: "", displayName: "", specValues: "{}", billOrderType: "", salePrice: "", stock: null, status: 1, sortNum: 0 }] };

function parseSpecGroups(value: string): SpecGroup[] {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SpecGroup => Boolean(item && typeof item === "object" && "name" in item && "values" in item && Array.isArray((item as SpecGroup).values)));
  } catch { return []; }
}
function parseSpecValues(value: string): Record<string, string> {
  try { const parsed = JSON.parse(value || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}
function inferBillOrderType(sku: Sku) {
  const values = parseSpecValues(sku.specValues);
  const source = [sku.billOrderType, values["重量"], sku.displayName, sku.skuCode].filter(Boolean).join(" ");
  const weight = source.match(/(\d+(?:\.\d+)?)\s*(斤|公斤|kg)/i);
  if (weight) return `${weight[1]}${weight[2].toLowerCase() === "kg" ? "公斤" : weight[2]}`;
  const suffix = String(sku.skuCode || "").match(/(?:^|-)(\d+(?:\.\d+)?)$/);
  return suffix ? `${suffix[1]}斤` : "";
}

export default function ProductsPage({ notify }: { notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const dictionaries = useContext(DictionaryContext);
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await apiRequest<{ data?: Product[] }>("/biz/product/list");
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "商品加载失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function edit(product?: Product) {
    setError("");
    setEditing(product ? JSON.parse(JSON.stringify(product)) as Product : JSON.parse(JSON.stringify(EMPTY_PRODUCT)) as Product);
  }
  function setField<K extends keyof Product>(key: K, value: Product[K]) { setEditing((current) => current ? { ...current, [key]: value } : current); }
  function setSku(index: number, key: keyof Sku, value: unknown) { setEditing((current) => current ? { ...current, skus: current.skus.map((sku, i) => i === index ? { ...sku, [key]: value } : sku) } : current); }
  const specGroups = editing ? parseSpecGroups(editing.specSchema) : [];
  function updateSpecGroup(index: number, next: Partial<SpecGroup>) {
    if (!editing) return;
    const groups = parseSpecGroups(editing.specSchema);
    const oldName = groups[index]?.name || "";
    groups[index] = { ...groups[index], ...next };
    const nextName = groups[index].name;
    setEditing({ ...editing, specSchema: JSON.stringify(groups), skus: oldName && nextName !== oldName ? editing.skus.map((sku) => {
      const values = parseSpecValues(sku.specValues);
      if (Object.prototype.hasOwnProperty.call(values, oldName)) { values[nextName] = values[oldName]; delete values[oldName]; }
      return { ...sku, specValues: JSON.stringify(values) };
    }) : editing.skus });
  }
  function addSpecGroup() {
    if (!editing) return;
    setField("specSchema", JSON.stringify([...specGroups, { name: `规格类目${specGroups.length + 1}`, values: [] }]));
  }
  function removeSpecGroup(index: number) {
    if (!editing) return;
    const removedName = specGroups[index]?.name;
    setEditing({ ...editing, specSchema: JSON.stringify(specGroups.filter((_, i) => i !== index)), skus: editing.skus.map((sku) => {
      const values = parseSpecValues(sku.specValues); delete values[removedName];
      return { ...sku, specValues: JSON.stringify(values) };
    }) });
  }
  function setSkuSpec(index: number, name: string, value: string) {
    const values = parseSpecValues(editing?.skus[index]?.specValues || "{}"); values[name] = value;
    setSku(index, "specValues", JSON.stringify(values));
  }

  async function save() {
    if (!editing) return;
    if (!editing.productCode.trim() || !editing.name.trim()) return setError("请填写商品编码和名称");
    if (!editing.skus.length || editing.skus.some((sku) => !sku.skuCode.trim() || !sku.displayName.trim() || sku.salePrice === "")) return setError("请完整填写每个 SKU 的编码、名称和售价");
    if (specGroups.some((group) => !group.name.trim() || !group.values.length)) return setError("请完整填写规格类目和可选值");
    if (editing.skus.some((sku) => specGroups.some((group) => !parseSpecValues(sku.specValues)[group.name]))) return setError("请为每个 SKU 选择完整的规格值");
    try { JSON.parse(editing.specSchema || "[]"); editing.skus.forEach((sku) => JSON.parse(sku.specValues || "{}")); }
    catch { return setError("规格类目或规格值必须是有效 JSON"); }
    setBusy(true); setError("");
    try {
      await apiRequest(editing.id ? `/biz/product/${editing.id}` : "/biz/product", { method: editing.id ? "PUT" : "POST", body: { ...editing, skus: editing.skus.map((sku, index) => ({ ...sku, billOrderType: sku.billOrderType || inferBillOrderType(sku), salePrice: Number(sku.salePrice), sortNum: index })) } });
      setEditing(null); notify("商品与规格已保存", "success"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBusy(false); }
  }

  async function remove(product: Product) {
    if (!product.id) return;
    setBusy(true);
    try { await apiRequest(`/biz/product/${product.id}`, { method: "DELETE" }); notify("商品已下架并移除", "success"); await load(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : "删除失败", "error"); }
    finally { setBusy(false); }
  }

  return <div className="module-page product-manager-page"><div className="module-hero compact-hero"><div><span className="eyebrow">经营管理</span><h1>商品管理</h1><p>管理客户下单页的商品、多规格组合与销售价格</p></div></div>
    <div className="product-manager-toolbar"><button type="button" onClick={() => edit()}><Plus size={17} />新增商品</button><button type="button" onClick={load}><RefreshCw className={loading ? "spin" : ""} size={17} />刷新</button></div>
    {error && !editing ? <p className="tool-error">{error}</p> : null}
    {loading ? <div className="product-manager-empty">正在加载商品</div> : <section className="product-manager-list">{rows.map((product) => <article key={product.id}><header><div><small>{product.productCode}</small><h2>{product.name}</h2><p>{product.subtitle || "暂无副标题"}</p></div><span className={product.status === 1 ? "on" : "off"}>{product.status === 1 ? "上架" : "下架"}</span></header><div className="product-sku-summary">{(product.skus || []).map((sku) => <span key={sku.id || sku.skuCode}><b>{sku.displayName}</b><em>¥{Number(sku.salePrice).toFixed(2)}</em></span>)}</div><footer><button type="button" onClick={() => edit(product)}>编辑商品</button><button type="button" className="danger-text" disabled={busy} onClick={() => remove(product)}><Trash2 size={15} />删除</button></footer></article>)}</section>}
    {!loading && !rows.length ? <div className="product-manager-empty">还没有商品，先创建一个客户可选的商品</div> : null}

    {editing ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setEditing(null)}><section className="purchaser-create-modal product-editor-modal"><button type="button" onClick={() => setEditing(null)}><X size={18} /></button><small>PRODUCT &amp; SKU</small><h2>{editing.id ? "编辑商品" : "新增商品"}</h2><p>规格类目可自定义多个维度。每个 SKU 保存一份规格 JSON 快照，后续接支付时价格直接沿用。</p>
      <div className="product-editor-grid"><label><em>商品编码</em><input value={editing.productCode} onChange={(event) => setField("productCode", event.target.value.toUpperCase())} placeholder="如 HT" /></label><label><em>商品名称</em><input value={editing.name} onChange={(event) => setField("name", event.target.value)} placeholder="如 炎陵黄桃" /></label><label className="wide"><em>商品副标题</em><input value={editing.subtitle || ""} onChange={(event) => setField("subtitle", event.target.value)} placeholder="一句话说明商品特点" /></label><label className="wide"><em>商品说明</em><textarea rows={2} value={editing.description || ""} onChange={(event) => setField("description", event.target.value)} /></label><label><em>上架状态</em><select value={editing.status} onChange={(event) => setField("status", Number(event.target.value))}><option value={1}>上架</option><option value={0}>下架</option></select></label><label><em>排序</em><input type="number" value={editing.sortNum} onChange={(event) => setField("sortNum", Number(event.target.value))} /></label></div>
      <div className="product-spec-builder"><header><div><b>规格类目</b><small>可添加重量、产区、等级、包装等多个维度</small></div><button type="button" onClick={addSpecGroup}><Plus size={15} />添加类目</button></header>{specGroups.length ? specGroups.map((group, index) => <article key={index}><label><em>类目名称</em><input value={group.name} onChange={(event) => updateSpecGroup(index, { name: event.target.value })} placeholder="如 重量" /></label><label><em>可选值</em><input value={group.values.join("、")} onChange={(event) => updateSpecGroup(index, { values: event.target.value.split(/[、,，]/).map((value) => value.trim()).filter(Boolean) })} placeholder="如 5斤、10斤" /><small>使用顿号或逗号分隔</small></label><button type="button" onClick={() => removeSpecGroup(index)} aria-label={`删除${group.name || "规格类目"}`}><Trash2 size={15} /></button></article>) : <p>暂未添加规格类目。单一价格商品也可以直接配置 SKU。</p>}</div>
      <div className="product-sku-editor"><header><div><b>SKU 组合</b><small>每一种规格组合可配置独立售价</small></div><button type="button" onClick={() => setField("skus", [...editing.skus, { skuCode: "", displayName: "", specValues: "{}", billOrderType: "", salePrice: "", stock: null, status: 1, sortNum: editing.skus.length }])}><Plus size={15} />添加规格</button></header>{editing.skus.map((sku, index) => <article key={index}><div><label><em>SKU 编码</em><input value={sku.skuCode} onChange={(event) => setSku(index, "skuCode", event.target.value)} /></label><label><em>展示名称</em><input value={sku.displayName} onChange={(event) => setSku(index, "displayName", event.target.value)} placeholder="如 湖南省内 · 10斤" /></label><label><em>销售价</em><input type="number" min="0" step="0.01" value={sku.salePrice} onChange={(event) => setSku(index, "salePrice", event.target.value)} /></label><label><em>账单计价规格</em><select value={sku.billOrderType || inferBillOrderType(sku)} onChange={(event) => setSku(index, "billOrderType", event.target.value)}><option value="">自动识别</option>{dictionaries.sizes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><em>状态</em><select value={sku.status} onChange={(event) => setSku(index, "status", Number(event.target.value))}><option value={1}>可售</option><option value={0}>停用</option></select></label>{specGroups.length ? <div className="product-sku-spec-fields">{specGroups.map((group) => <label key={group.name}><em>{group.name || "未命名类目"}</em><select value={parseSpecValues(sku.specValues)[group.name] || ""} onChange={(event) => setSkuSpec(index, group.name, event.target.value)}><option value="">请选择</option>{group.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div> : null}</div><button type="button" disabled={editing.skus.length === 1} onClick={() => setField("skus", editing.skus.filter((_, i) => i !== index))}><Trash2 size={15} /></button></article>)}</div>
      {error ? <p className="tool-error">{error}</p> : null}<button className="purchaser-create-submit" type="button" disabled={busy} onClick={save}><Save size={17} />{busy ? "正在保存" : "保存商品"}</button>
    </section></div> : null}
  </div>;
}
