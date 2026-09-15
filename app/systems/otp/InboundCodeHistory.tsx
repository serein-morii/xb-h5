import { Check, Copy, LoaderCircle, Mail, MessageSquareText, Webhook } from "lucide-react";
import type { DynamicCodeSource, VaultDynamicCode } from "./vaultApi";

const sourceLabel = (source?: DynamicCodeSource) => source === "SMS" ? "短信" : source === "EMAIL" ? "邮箱" : "Webhook";

export function inboundCodeTiming(receivedTime?: string, expireTime?: string, now = Date.now()) {
  const received = receivedTime ? new Date(normalizeDateTime(receivedTime)).getTime() : 0;
  const expires = expireTime ? new Date(normalizeDateTime(expireTime)).getTime() : 0;
  const total = Math.max(1, Math.ceil((expires - received) / 1000));
  const left = expires ? Math.max(0, Math.ceil((expires - now) / 1000)) : 0;
  return { left, total, progress: expires ? Math.max(0, Math.min(100, left / total * 100)) : 0 };
}

export function formatCodeTime(seconds: number) {
  if (seconds <= 0) return "已过期";
  const minutes = Math.floor(seconds / 60), rest = seconds % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分` : ""}`;
  return minutes ? `${minutes}分${rest ? `${rest}秒` : ""}` : `${rest}秒`;
}

export default function InboundCodeHistory({ rows, total, loading, allowCopy, now, onCopy, onLoadMore }: {
  rows: VaultDynamicCode[];
  total: number;
  loading: boolean;
  allowCopy: boolean;
  now: number;
  onCopy: (value: string) => void;
  onLoadMore: () => void;
}) {
  return <section className="vault-share-section vault-detail-section vault-code-history">
    <div className="vault-section-title"><div><span>02</span><h3>历史验证码</h3></div><small>加密保留 30 天 · 每次 5 条</small></div>
    {rows.length ? <div className="vault-code-history-list">{rows.map((item) => {
      const timing = inboundCodeTiming(item.receivedTime, item.expireTime, now);
      return <article key={item.id} className={timing.left ? "is-live" : "is-expired"}>
        <span className="vault-history-source">{item.sourceType === "EMAIL" ? <Mail size={12} /> : item.sourceType === "WEBHOOK" ? <Webhook size={12} /> : <MessageSquareText size={12} />}<b>{sourceLabel(item.sourceType)}</b></span>
        <div><b>{item.code.replace(/(.{3})(?=.)/, "$1 ")}</b><small>{item.sender || "接收通道"} · {formatReceivedTime(item.receivedTime)}</small></div>
        <em>{item.used ? <><Check size={11} />已使用</> : timing.left ? formatCodeTime(timing.left) : "已过期"}</em>
        {allowCopy ? <button type="button" onClick={() => onCopy(item.code)} aria-label={`复制${sourceLabel(item.sourceType)}历史验证码`}><Copy size={13} /></button> : null}
      </article>;
    })}</div> : !loading ? <div className="vault-code-history-empty">还没有收到过验证码</div> : null}
    {loading ? <div className="vault-code-history-loading"><LoaderCircle className="spin" size={15} />正在读取历史记录</div> : rows.length < total ? <button type="button" className="vault-history-more" onClick={onLoadMore}>加载更多 <small>{rows.length} / {total}</small></button> : rows.length ? <p className="vault-history-end">已显示全部 {total} 条</p> : null}
  </section>;
}

function formatReceivedTime(value: string) {
  const time = new Date(normalizeDateTime(value));
  if (Number.isNaN(time.getTime())) return value;
  const now = new Date();
  const sameDay = time.getFullYear() === now.getFullYear() && time.getMonth() === now.getMonth() && time.getDate() === now.getDate();
  return new Intl.DateTimeFormat("zh-CN", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(time);
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : value.replace(" ", "T");
}
