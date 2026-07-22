"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import { CheckCircle2, LoaderCircle, PackageSearch, Phone, RefreshCw, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import OrderList, { PublicOrderRecord } from "../OrderList";

type Row = Record<string, unknown>;

export default function OrderSearch() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [uuid, setUuid] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCaptcha = useCallback(async () => {
    try {
      const result = await apiRequest<Row>("/captchaImage", { auth: false });
      setUuid(String(result.uuid || "")); setCaptcha(result.img ? `data:image/png;base64,${result.img}` : ""); setCode("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "验证码加载失败"); }
  }, []);
  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!phone.trim() || !code.trim()) return setError("请输入手机号和验证码");
    setLoading(true); setError(""); setOrders([]);
    try {
      const result = await apiRequest<{ data?: PublicOrderRecord[] }>("/search", { auth: false, method: "POST", body: { searchKey: phone.trim(), code: code.trim(), uuid } });
      const data = Array.isArray(result.data) ? result.data : [];
      setOrders(data); if (!data.length) setError("暂无订单记录");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "查询失败，请稍后重试"); await loadCaptcha(); }
    finally { setLoading(false); }
  }

  return <div className="tool-page order-search-tool"><section className="tool-hero"><span><PackageSearch size={25} /></span><div><small>PUBLIC ORDER SEARCH</small><h1>订单查询</h1><p>输入收件手机号和验证码，无需登录即可查询订单。</p></div></section>
    <form className="tool-form-card" onSubmit={submit}><label><span>手机号</span><div className="tool-input"><Phone size={17} /><input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入收件手机号" /></div></label><label><span>验证码</span><div className="tool-captcha"><div className="tool-input"><CheckCircle2 size={17} /><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="请输入验证码" /></div><button type="button" onClick={loadCaptcha}>{captcha ? <img src={captcha} alt="验证码" /> : <RefreshCw size={18} />}</button></div></label>{error ? <p className="tool-error">{error}</p> : null}<button className="tool-primary" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}{loading ? "正在查询" : "查询订单"}</button></form>
    {orders.length ? <OrderList orders={orders} contact={orders[0]?.linkNameAndPhone?.trim()} /> : null}
  </div>;
}
