"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Box, LoaderCircle, PackageCheck, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { publicApiRequest } from "../lib/api";
import OrderList, { PublicOrderRecord } from "../tools/OrderList";

function readLinkId() {
  const rawHash = window.location.hash.replace(/^#/, "").trim();
  const hashId = rawHash.startsWith("id=") ? new URLSearchParams(rawHash).get("id") : rawHash;
  const queryId = new URLSearchParams(window.location.search).get("id");
  return (hashId || queryId || "").trim();
}

export default function PublicOrder({ embedded = false }: { embedded?: boolean }) {
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const id = readLinkId();
    if (!id || !/^[a-zA-Z0-9_-]{4,80}$/.test(id)) {
      setOrders([]); setError("订单链接无效，请使用订单管理系统生成的查询链接"); setLoading(false); return;
    }
    setLoading(true); setError("");
    try {
      const result = await publicApiRequest<{ data?: PublicOrderRecord[] }>("/search/by", { id });
      const data = Array.isArray(result.data) ? result.data : [];
      setOrders(data);
      if (!data.length) setError("没有查询到订单，请检查链接是否正确");
    } catch (cause) { setOrders([]); setError(cause instanceof Error ? cause.message : "订单查询失败，请稍后重试"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); window.addEventListener("hashchange", load); return () => window.removeEventListener("hashchange", load); }, [load]);

  return <div className="tool-page signed-order-tool">
    <section className="tool-hero"><span><PackageCheck size={25} /></span><div><small>SECURE ORDER LINK</small><h1>链接订单详情</h1><p>通过系统生成的加密 ID，查看订单与最新物流信息。</p></div></section>
    {loading ? <section className="public-state signed-order-state"><LoaderCircle className="spin" size={32} /><h1>正在查询订单</h1><p>请稍候，正在同步最新订单与物流信息</p></section> : error ? <section className="public-state public-state-error signed-order-state"><Box size={34} /><h1>暂时无法查看</h1><p>{error}</p><button type="button" onClick={load}><RefreshCw size={17} />重新查询</button></section> : <OrderList orders={orders} contact={orders[0]?.linkNameAndPhone?.trim()} />}
    {!embedded ? <footer className="signed-order-footer"><span>喜八订单查询 · 信息以系统最新记录为准</span><a href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></footer> : null}
  </div>;
}
