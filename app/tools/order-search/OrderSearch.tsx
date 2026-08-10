
import { LoaderCircle, PackageSearch, Phone, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/api";
import OrderList, { PublicOrderRecord } from "../OrderList";
import { OrderStatsCards, StatusFilter, computeOrderStats, filterOrdersByStatus } from "../OrderStatsCards";
import PeachTip from "../../components/PeachTip";
import { SliderCaptcha } from "../../components/SliderCaptcha";

type Row = Record<string, unknown>;

export default function OrderSearch() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [uuid, setUuid] = useState("");
  const [captchaOn, setCaptchaOn] = useState(true);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!orders.length) return;
    const node = resultsRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    // 结果区在视口下方时才往下滚，让用户能看到订单；用户依然能自由滚动
    if (rect.top > window.innerHeight * 0.4) {
      window.scrollBy({ top: rect.top - 80, behavior: "smooth" });
    }
  }, [orders]);

  const stats = useMemo(() => computeOrderStats(orders), [orders]);
  const filteredOrders = useMemo(() => filterOrdersByStatus(orders, statusFilter), [orders, statusFilter]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!phone.trim()) return setError("请输入手机号");
    if (captchaOn && !code.trim()) return setError("请先完成滑块验证");
    setLoading(true); setError(""); setOrders([]); setStatusFilter(null);
    try {
      const result = await apiRequest<{ data?: PublicOrderRecord[] }>("/search", { auth: false, method: "POST", body: { searchKey: phone.trim(), code: code.trim(), uuid } });
      const data = Array.isArray(result.data) ? result.data : [];
      setOrders(data); if (!data.length) setError("暂无订单记录");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "查询失败，请稍后重试"); setCaptchaReset((value) => value + 1); }
    finally { setLoading(false); }
  }

  return <div className="tool-page order-search-tool"><section className="tool-hero"><span><PackageSearch size={25} /></span><div><small>PUBLIC ORDER SEARCH</small><h1>订单查询</h1><p>输入收件手机号和验证码查询订单。</p></div></section>
    <form className="tool-form-card" onSubmit={submit}><label><span>手机号</span><div className="tool-input"><Phone size={17} /><input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入收件手机号" /></div></label>{captchaOn ? <label><span>安全验证</span><SliderCaptcha resetKey={captchaReset} disabled={loading} onEnabledChange={setCaptchaOn} onVerified={(value) => { setUuid(value.uuid); setCode(value.token); }} /></label> : null}{error ? <p className="tool-error">{error}</p> : null}<button className="tool-primary" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}{loading ? "正在查询" : "查询订单"}</button></form>
    <PeachTip />
    {orders.length ? <div ref={resultsRef}>
      <OrderStatsCards stats={stats} filter={statusFilter} onSelect={setStatusFilter} label="查询结果概览" />
      <OrderList orders={filteredOrders} contact={orders[0]?.linkNameAndPhone?.trim()} />
    </div> : null}
  </div>;
}
