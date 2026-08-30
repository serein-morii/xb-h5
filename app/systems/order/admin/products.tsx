import { Edit3, Layers3, LoaderCircle, PackageCheck, Plus, RefreshCw, Save, Tags, Trash2, X } from "lucide-react";
import { API_PATHS } from "../../../lib/pathConventions";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { DictionaryContext } from "./core";
import { ConfirmDialog } from "./ui";
import { useAccess } from "./access";

type Sku = { id?: number; skuCode: string; displayName: string; specValues: string; billOrderType?: string; salePrice: number | string; stock?: number | null; status: number; sortNum: number };
type Product = { id?: number; productCode: string; name: string; subtitle: string; description: string; coverUrl: string; specSchema: string; status: number; sortNum: number; skus: Sku[] };
type SpecGroup = { name: string; values: string[] };

const emptySku = (index = 0): Sku => ({ skuCode: "", displayName: "", specValues: "{}", billOrderType: "", salePrice: "", stock: null, status: 1, sortNum: index });
const EMPTY_PRODUCT: Product = { productCode: "", name: "", subtitle: "", description: "", coverUrl: "", specSchema: "[]", status: 1, sortNum: 0, skus: [emptySku()] };

function parseSpecGroups(value: string): SpecGroup[] {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SpecGroup => Boolean(item && typeof item === "object" && "name" in item && "values" in item && Array.isArray((item as SpecGroup).values)));
  } catch { return []; }
}

function parseSpecValues(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function money(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) ? `¥${price.toFixed(2)}` : "--";
}

function inferBillOrderType(sku: Sku) {
  const values = parseSpecValues(sku.specValues);
  const source = [sku.billOrderType, values["重量"], sku.displayName, sku.skuCode].filter(Boolean).join(" ");
  const weight = source.match(/(\d+(?:\.\d+)?)\s*(斤|公斤|kg)/i);
  if (weight) return `${weight[1]}${weight[2].toLowerCase() === "kg" ? "公斤" : weight[2]}`;
  const suffix = String(sku.skuCode || "").match(/(?:^|-)(\d+(?:\.\d+)?)$/);
  return suffix ? `${suffix[1]}斤` : "";
}

function cloneProduct(product?: Product): Product {
  const base = product ? JSON.parse(JSON.stringify(product)) as Product : JSON.parse(JSON.stringify(EMPTY_PRODUCT)) as Product;
  return { ...base, skus: base.skus?.length ? base.skus : [emptySku()] };
}

export default function ProductsPage({ notify }: { notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const access = useAccess();
  const dictionaries = useContext(DictionaryContext);
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<{ data?: Product[] }>(API_PATHS.catalog.products);
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "商品加载失败，请稍后重试", "error");
    } finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const specGroups = useMemo(() => editing ? parseSpecGroups(editing.specSchema) : [], [editing]);
  const activeProducts = rows.filter((product) => product.status === 1).length;
  const activeSkus = rows.reduce((total, product) => total + (product.skus || []).filter((sku) => sku.status === 1).length, 0);

  function edit(product?: Product) {
    setEditing(cloneProduct(product));
  }

  function setField<K extends keyof Product>(key: K, value: Product[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  function setSku(index: number, key: keyof Sku, value: unknown) {
    setEditing((current) => current ? { ...current, skus: current.skus.map((sku, i) => i === index ? { ...sku, [key]: value } : sku) } : current);
  }

  function updateSpecGroup(index: number, next: Partial<SpecGroup>) {
    if (!editing) return;
    const groups = parseSpecGroups(editing.specSchema);
    const oldName = groups[index]?.name || "";
    const nextGroup = { ...groups[index], ...next };
    if (next.values) nextGroup.values = uniqueValues(next.values);
    groups[index] = nextGroup;
    const nextName = nextGroup.name;
    setEditing({
      ...editing,
      specSchema: JSON.stringify(groups),
      skus: oldName && nextName !== oldName ? editing.skus.map((sku) => {
        const values = parseSpecValues(sku.specValues);
        if (Object.prototype.hasOwnProperty.call(values, oldName)) {
          values[nextName] = values[oldName];
          delete values[oldName];
        }
        return { ...sku, specValues: JSON.stringify(values) };
      }) : editing.skus,
    });
  }

  function addSpecGroup() {
    if (!editing) return;
    setField("specSchema", JSON.stringify([...specGroups, { name: `规格类目${specGroups.length + 1}`, values: [] }]));
  }

  function removeSpecGroup(index: number) {
    if (!editing) return;
    const removedName = specGroups[index]?.name;
    setEditing({
      ...editing,
      specSchema: JSON.stringify(specGroups.filter((_, i) => i !== index)),
      skus: editing.skus.map((sku) => {
        const values = parseSpecValues(sku.specValues);
        delete values[removedName];
        return { ...sku, specValues: JSON.stringify(values) };
      }),
    });
  }

  function setSkuSpec(index: number, name: string, value: string) {
    const values = parseSpecValues(editing?.skus[index]?.specValues || "{}");
    values[name] = value;
    setSku(index, "specValues", JSON.stringify(values));
  }

  function validationMessages(product: Product) {
    const messages: string[] = [];
    const code = product.productCode.trim();
    if (!code || !/^[A-Z0-9_-]{2,32}$/.test(code)) messages.push("商品编码请使用 2-32 位大写字母、数字、- 或 _");
    if (!product.name.trim()) messages.push("请填写商品名称");
    if (!Number.isFinite(Number(product.sortNum)) || Number(product.sortNum) < 0) messages.push("排序必须是非负数字");

    const groupNames = specGroups.map((group) => group.name.trim()).filter(Boolean);
    if (new Set(groupNames).size !== groupNames.length) messages.push("规格类目名称不能重复");
    specGroups.forEach((group, index) => {
      const name = group.name.trim() || `第 ${index + 1} 个规格类目`;
      const values = uniqueValues(group.values);
      if (!group.name.trim()) messages.push(`${name}：请填写类目名称`);
      if (!values.length) messages.push(`${name}：请至少填写一个可选值`);
      if (values.length !== group.values.map((value) => value.trim()).filter(Boolean).length) messages.push(`${name}：可选值不能重复`);
    });

    if (!product.skus.length) messages.push("至少配置一个 SKU");
    const skuCodes = product.skus.map((sku) => sku.skuCode.trim()).filter(Boolean);
    if (new Set(skuCodes).size !== skuCodes.length) messages.push("SKU 编码不能重复");
    product.skus.forEach((sku, index) => {
      const label = `第 ${index + 1} 个 SKU`;
      const values = parseSpecValues(sku.specValues);
      const price = Number(sku.salePrice);
      if (!sku.skuCode.trim()) messages.push(`${label}：请填写 SKU 编码`);
      if (!sku.displayName.trim()) messages.push(`${label}：请填写展示名称`);
      if (sku.salePrice === "" || !Number.isFinite(price) || price < 0) messages.push(`${label}：销售价必须是大于等于 0 的数字`);
      specGroups.forEach((group) => {
        if (!values[group.name]) messages.push(`${label}：请选择${group.name}`);
        else if (!group.values.includes(values[group.name])) messages.push(`${label}：${group.name}的值不在可选范围内`);
      });
    });
    return messages;
  }

  async function save() {
    if (!editing) return;
    const messages = validationMessages(editing);
    if (messages.length) {
      const preview = messages.slice(0, 3).join("；");
      notify(`${preview}${messages.length > 3 ? `；另有 ${messages.length - 3} 项待完善` : ""}`, "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...editing,
        productCode: editing.productCode.trim().toUpperCase(),
        name: editing.name.trim(),
        skus: editing.skus.map((sku, index) => ({
          ...sku,
          skuCode: sku.skuCode.trim(),
          displayName: sku.displayName.trim(),
          billOrderType: sku.billOrderType || inferBillOrderType(sku),
          salePrice: Number(sku.salePrice),
          sortNum: index,
        })),
      };
      await apiRequest(editing.id ? `${API_PATHS.catalog.products}/${editing.id}` : API_PATHS.catalog.products, { method: editing.id ? "PUT" : "POST", body: payload });
      setEditing(null);
      notify("商品与规格已保存", "success");
      await load();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "保存失败，请稍后重试", "error");
    } finally { setBusy(false); }
  }

  function requestRemove(product: Product) {
    if (!product.id) return;
    setConfirm({
      title: "删除商品",
      message: `确认删除「${product.name}」？删除后客户下单页将不再展示该商品。`,
      danger: true,
      action: async () => {
        try {
          await apiRequest(`${API_PATHS.catalog.products}/${product.id}`, { method: "DELETE" });
          notify("商品已下架并移除", "success");
          await load();
        } catch (cause) {
          notify(cause instanceof Error ? cause.message : "删除失败，请稍后重试", "error");
        }
      },
    });
  }

  return (
    <div className="module-page product-manager-page">
      <div className="module-hero compact-hero product-manager-hero">
        <div><span className="eyebrow">经营管理</span><h1>商品管理</h1><p>维护客户下单页的商品、规格、地区和销售价格。</p></div>
      </div>

      <section className="product-manager-stats" aria-label="商品概览">
        <span><b>{rows.length}</b><small>商品总数</small></span>
        <span><b>{activeProducts}</b><small>上架商品</small></span>
        <span><b>{activeSkus}</b><small>可售规格</small></span>
      </section>

      <div className="product-manager-toolbar">
        {access.has("products.create") ? <button type="button" className="primary" onClick={() => edit()}><Plus size={17} />新增商品</button> : null}
        <button type="button" onClick={load}><RefreshCw className={loading ? "spin" : ""} size={17} />刷新</button>
      </div>

      {loading ? <div className="product-manager-empty"><LoaderCircle className="spin" size={24} />正在加载商品</div> : rows.length ? (
        <section className="product-manager-list">
          {rows.map((product) => (
            <article key={product.id}>
              <header>
                <div><small>{product.productCode}</small><h2>{product.name}</h2><p>{product.subtitle || product.description || "暂无说明"}</p></div>
                <span className={product.status === 1 ? "on" : "off"}>{product.status === 1 ? "上架" : "下架"}</span>
              </header>
              <div className="product-sku-summary">
                {(product.skus || []).map((sku) => <span key={sku.id || sku.skuCode} className={sku.status === 1 ? "" : "off"}><b>{sku.displayName}</b><em>{money(sku.salePrice)}</em></span>)}
              </div>
              <footer>
                {access.has("products.edit") ? <button type="button" onClick={() => edit(product)}><Edit3 size={15} />编辑</button> : null}
                {access.has("products.delete") ? <button type="button" className="danger-text" disabled={busy} onClick={() => requestRemove(product)}><Trash2 size={15} />删除</button> : null}
              </footer>
            </article>
          ))}
        </section>
      ) : <div className="product-manager-empty"><PackageCheck size={28} />还没有商品，先创建一个客户可选的商品</div>}

      {editing && access.has(editing.id ? "products.edit" : "products.create") ? (
        <div className="purchaser-create-backdrop product-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setEditing(null)}>
          <section className="purchaser-create-modal product-editor-modal product-editor-modern">
            <button type="button" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button>
            <small>PRODUCT &amp; SKU</small>
            <h2>{editing.id ? "编辑商品" : "新增商品"}</h2>
            <p>客户下单页会按商品、规格、地区逐步展示；每个 SKU 单独配置价格。</p>

            <section className="product-editor-section">
              <header><span><PackageCheck size={17} /></span><div><b>基础信息</b><small>商品编码保存后用于下单和收款码匹配</small></div></header>
              <div className="product-editor-grid">
                <label><em>商品编码</em><input value={editing.productCode} onChange={(event) => setField("productCode", event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="如 HT" /></label>
                <label><em>商品名称</em><input value={editing.name} onChange={(event) => setField("name", event.target.value)} placeholder="如 炎陵黄桃" /></label>
                <label className="wide"><em>商品副标题</em><input value={editing.subtitle || ""} onChange={(event) => setField("subtitle", event.target.value)} placeholder="一句话说明商品特点" /></label>
                <label className="wide"><em>商品说明</em><textarea rows={2} value={editing.description || ""} onChange={(event) => setField("description", event.target.value)} placeholder="选填，展示给运营人员参考" /></label>
                <label><em>上架状态</em><select value={editing.status} onChange={(event) => setField("status", Number(event.target.value))}><option value={1}>上架</option><option value={0}>下架</option></select></label>
                <label><em>排序</em><input type="number" min={0} value={editing.sortNum} onChange={(event) => setField("sortNum", Number(event.target.value))} /></label>
              </div>
            </section>

            <section className="product-editor-section product-spec-builder">
              <header><span><Layers3 size={17} /></span><div><b>规格类目</b><small>例如重量、配送区域。新疆西藏可以作为一个地区值。</small></div><button type="button" onClick={addSpecGroup}><Plus size={15} />添加类目</button></header>
              {specGroups.length ? specGroups.map((group, index) => (
                <article key={index}>
                  <label><em>类目名称</em><input value={group.name} onChange={(event) => updateSpecGroup(index, { name: event.target.value })} placeholder="如 重量" /></label>
                  <label><em>可选值</em><input value={group.values.join("、")} onChange={(event) => updateSpecGroup(index, { values: event.target.value.split(/[、,，]/) })} placeholder="如 湖南省内、湖南省外、新疆西藏" /><small>使用顿号或逗号分隔</small></label>
                  <button type="button" onClick={() => removeSpecGroup(index)} aria-label={`删除${group.name || "规格类目"}`}><Trash2 size={15} /></button>
                </article>
              )) : <p>单一价格商品可以不添加类目；多规格商品建议至少配置“重量”。</p>}
            </section>

            <section className="product-editor-section product-sku-editor">
              <header><span><Tags size={17} /></span><div><b>SKU 组合</b><small>每一行是一种可售组合，价格不要写进展示名称里</small></div><button type="button" onClick={() => setField("skus", [...editing.skus, emptySku(editing.skus.length)])}><Plus size={15} />添加规格</button></header>
              {editing.skus.map((sku, index) => {
                const values = parseSpecValues(sku.specValues);
                return (
                  <article key={index}>
                    <div>
                      <label><em>SKU 编码</em><input value={sku.skuCode} onChange={(event) => setSku(index, "skuCode", event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="如 XJ-5" /></label>
                      <label><em>展示名称</em><input value={sku.displayName} onChange={(event) => setSku(index, "displayName", event.target.value)} placeholder="如 新疆西藏 · 5斤" /></label>
                      <label><em>销售价</em><input type="number" min="0" step="0.01" value={sku.salePrice} onChange={(event) => setSku(index, "salePrice", event.target.value)} placeholder="0.00" /></label>
                      <label><em>账单计价规格</em><select value={sku.billOrderType || inferBillOrderType(sku)} onChange={(event) => setSku(index, "billOrderType", event.target.value)}><option value="">自动识别</option>{dictionaries.sizes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                      <label><em>状态</em><select value={sku.status} onChange={(event) => setSku(index, "status", Number(event.target.value))}><option value={1}>可售</option><option value={0}>停用</option></select></label>
                      {specGroups.length ? <div className="product-sku-spec-fields">{specGroups.map((group) => <label key={group.name}><em>{group.name || "未命名类目"}</em><select value={values[group.name] || ""} onChange={(event) => setSkuSpec(index, group.name, event.target.value)}><option value="">请选择</option>{group.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div> : null}
                    </div>
                    <button type="button" disabled={editing.skus.length === 1} onClick={() => setField("skus", editing.skus.filter((_, i) => i !== index))} aria-label="删除 SKU"><Trash2 size={15} /></button>
                  </article>
                );
              })}
            </section>

            <div className="product-editor-actions">
              <button type="button" onClick={() => setEditing(null)} disabled={busy}>取消</button>
              <button className="purchaser-create-submit" type="button" disabled={busy} onClick={save}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{busy ? "正在保存" : "保存商品"}</button>
            </div>
          </section>
        </div>
      ) : null}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
