import { Fingerprint, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPasskey } from "../lib/passkey";

type Passkey = { id: number; displayName: string; backedUp?: boolean; backupEligible?: boolean; lastUsedTime?: string };
export type PasskeyRequest = (path: string, options?: { method?: string; body?: Record<string, unknown> }) => Promise<{ data?: unknown }>;

export function PasskeyManager({ endpoint, request }: { endpoint: string; request: PasskeyRequest }) {
  const [items, setItems] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const result = await request(endpoint);
    setItems(Array.isArray(result.data) ? result.data as Passkey[] : []);
  }, [endpoint, request]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Passkey 加载失败")); }, [load]);

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key); setMessage("");
    try { await task(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "操作失败，请重试"); }
    finally { setBusy(""); }
  }

  function add() {
    void run("add", async () => {
      const options = await request(`${endpoint}/options`, { method: "POST" }) as { data?: { requestId?: string; publicKey?: Record<string, unknown> } };
      if (!options.data?.requestId || !options.data.publicKey) throw new Error("Passkey 创建参数不完整");
      await request(endpoint, { method: "POST", body: { requestId: options.data.requestId, credential: await createPasskey(options.data.publicKey), displayName: deviceName() } });
      await load();
    });
  }

  function rename(item: Passkey) {
    const name = window.prompt("Passkey 名称", item.displayName)?.trim();
    if (!name || name === item.displayName) return;
    void run(`rename-${item.id}`, async () => { await request(`${endpoint}/${item.id}`, { method: "PUT", body: { displayName: name } }); await load(); });
  }

  function remove(item: Passkey) {
    if (!window.confirm(`移除“${item.displayName}”？移除后这台设备不能再用它登录。`)) return;
    void run(`delete-${item.id}`, async () => { await request(`${endpoint}/${item.id}`, { method: "DELETE" }); await load(); });
  }

  return <div className="account-passkeys">
    <div className="account-passkeys-heading"><span><Fingerprint size={18} /></span><div><b>Passkey</b><small>使用面容、指纹或设备 PIN 登录，不保存生物信息</small></div><button type="button" disabled={!!busy} onClick={add}>{busy === "add" ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}添加</button></div>
    <div className="account-passkeys-list">{items.length ? items.map((item) => <article key={item.id}><Fingerprint size={17} /><div><b>{item.displayName}</b><small>{item.backedUp ? "已同步到设备云钥匙串" : item.backupEligible ? "支持设备备份" : "仅此安全设备"}{item.lastUsedTime ? ` · 最近使用 ${String(item.lastUsedTime).slice(0, 16)}` : " · 尚未使用"}</small></div><button type="button" disabled={!!busy} onClick={() => rename(item)} aria-label="重命名"><Pencil size={14} /></button><button className="danger" type="button" disabled={!!busy} onClick={() => remove(item)} aria-label="移除"><Trash2 size={14} /></button></article>) : <p><Fingerprint size={17} />还没有 Passkey，可添加当前设备</p>}</div>
    {message ? <div className="account-passkeys-message">{message}</div> : null}
  </div>;
}

function deviceName() {
  const platform = navigator.userAgent.includes("iPhone") ? "iPhone" : navigator.userAgent.includes("Android") ? "Android" : navigator.userAgent.includes("Mac") ? "Mac" : "当前设备";
  return `${platform} Passkey`;
}
