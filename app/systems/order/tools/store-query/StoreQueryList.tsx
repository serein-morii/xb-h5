import { ArrowRight, LoaderCircle, Search, Store as StoreIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listPublicStores, PublicStoreRow } from "../../api";
import { APP_ROUTES } from "../../../../lib/pathConventions";

function getStoreCode(row: PublicStoreRow): string {
  return String(row.code || "").trim();
}

function getStoreName(row: PublicStoreRow): string {
  return String(row.value || row.text || row.code || "未命名店铺").trim();
}

function getStoreKey(row: PublicStoreRow, index: number): string {
  const code = getStoreCode(row);
  return code || `store-${index}`;
}

export default function StoreQueryList() {
  const [stores, setStores] = useState<PublicStoreRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listPublicStores();
      const data = Array.isArray(result) ? result : Array.isArray(result.data) ? result.data : [];
      setStores(data);
      if (!data.length) setError("暂无可查询的店铺");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "店铺列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const key = keyword.trim();
    if (!key) return stores;
    return stores.filter((row) => {
      const name = getStoreName(row).toLowerCase();
      const code = getStoreCode(row).toLowerCase();
      return name.includes(key.toLowerCase()) || code.includes(key.toLowerCase());
    });
  }, [stores, keyword]);

  return <div className="tool-page store-query-list-tool">
    <section className="tool-hero">
      <span><StoreIcon size={25} /></span>
      <div>
        <small>STORE-SCOPED ORDER SEARCH</small>
        <h1>专属查询</h1>
        <p>选择要查询的店铺，查询时只显示该店铺下的订单，避免串单。</p>
      </div>
    </section>
    <form className="tool-form-card store-query-list-filter" onSubmit={(event) => event.preventDefault()}>
      <label>
        <span>搜索店铺</span>
        <div className="tool-input">
          <Search size={17} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按店铺名或编码过滤"
          />
        </div>
      </label>
      {error ? <p className="tool-error">{error}</p> : null}
    </form>
    {loading ? (
      <div className="store-query-list-loading">
        <LoaderCircle className="spin" size={20} />
        <span>正在加载店铺…</span>
      </div>
    ) : null}
    {!loading && filtered.length ? (
      <ul className="store-query-list-grid">
        {filtered.map((row, index) => {
          const code = getStoreCode(row);
          const name = getStoreName(row);
          const notice = String(row.notice || "").trim();
          return (
            <li key={getStoreKey(row, index)}>
              <a className="store-query-list-card" href={code ? `${APP_ROUTES.toolStoreQuery}/${encodeURIComponent(code)}` : "#"}>
                <span className="store-query-list-card-icon"><StoreIcon size={20} /></span>
                <div className="store-query-list-card-body">
                  <h2 title={name}>{name}</h2>
                  {notice ? <p title={notice}>{notice}</p> : <p>仅查询该店铺的订单</p>}
                </div>
                <ArrowRight size={17} />
              </a>
            </li>
          );
        })}
      </ul>
    ) : null}
  </div>;
}
