import { ArrowLeft, Check, ChevronLeft, ChevronRight, HandHeart, LoaderCircle, LogIn, LogOut, Mail, Search, UserCheck, Users, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest, clearStoredToken, getStoredToken, loginByEmail, sendEmailCode, setStoredToken } from "../../lib/api";
import { API_PATHS, APP_ROUTES } from "../../lib/pathConventions";
import { ipDetailLabel, type IpInfo } from "../../lib/ipInfo";
import "./volunteer.css";

type Application = {
  id: number; name: string; photoUrl?: string; gender: string; birthDate: string; ethnicity: string; politicalStatus: string;
  phone: string; wechat?: string; qq?: string; idCardMasked: string; address: string; workUnit: string; joinedDate: string;
  specialty: string; availability: string[]; suggestion?: string; status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string; reviewedBy?: string; reviewedAt?: string; consentVersion: string; consentAt: string; createTime: string;
  sourceIp?: string; ipInfo?: IpInfo;
};
type Member = { id: number; applicationId: number; memberNo: string; status: string; name: string; photoUrl?: string; gender: string; phone: string; specialty: string; joinedDate: string; activityCount: number; serviceMinutes: number; createTime: string };
type PageResult<T> = { rows: T[]; total: number };

const statusLabel: Record<string, string> = { PENDING: "待审核", APPROVED: "已通过", REJECTED: "已拒绝", ACTIVE: "正常", PAUSED: "暂停", EXITED: "已退出" };

export default function VolunteerAdmin() {
  const [token, setToken] = useState(getStoredToken());
  const [tab, setTab] = useState<"applications" | "members">("applications");
  const [applications, setApplications] = useState<Application[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [queryKeyword, setQueryKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setMessage("");
    try {
      if (tab === "applications") {
        const result = await apiRequest<PageResult<Application>>(`${API_PATHS.volunteer.admin}/applications`, { query: { pageNum: page, pageSize: 20, keyword: queryKeyword, status } });
        setApplications(result.rows || []); setTotal(Number(result.total || 0));
      } else {
        const result = await apiRequest<PageResult<Member>>(`${API_PATHS.volunteer.admin}/members`, { query: { pageNum: page, pageSize: 20, keyword: queryKeyword, status } });
        setMembers(result.rows || []); setTotal(Number(result.total || 0));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "数据加载失败"); }
    finally { setLoading(false); }
  }, [page, queryKeyword, status, tab, token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const expired = () => setToken(""); window.addEventListener("xb-session-expired", expired); return () => window.removeEventListener("xb-session-expired", expired); }, []);

  function search(event: FormEvent) { event.preventDefault(); setPage(1); setQueryKeyword(keyword.trim()); }
  function switchTab(next: "applications" | "members") { setTab(next); setPage(1); setStatus(""); setQueryKeyword(""); setKeyword(""); }
  function openReview(item: Application, next: "APPROVED" | "REJECTED") { setReviewing(item); setReviewStatus(next); setReviewNote(""); }

  async function saveReview() {
    if (!reviewing) return;
    setReviewSaving(true); setMessage("");
    try {
      await apiRequest(`${API_PATHS.volunteer.admin}/applications/${reviewing.id}/review`, { method: "PUT", body: { status: reviewStatus, note: reviewNote } });
      setReviewing(null); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "审核失败"); }
    finally { setReviewSaving(false); }
  }

  if (!token) return <VolunteerAdminLogin onLogin={(value) => { setStoredToken(value); setToken(value); }} />;

  const pageCount = Math.max(1, Math.ceil(total / 20));
  return <main className="yv-admin">
    <aside className="yv-admin-side">
      <a className="yv-brand" href={APP_ROUTES.volunteer}><span><HandHeart size={19} /></span><div><b>鱼片志愿</b><small>管理后台</small></div></a>
      <nav><button className={tab === "applications" ? "is-active" : ""} onClick={() => switchTab("applications")}><UserCheck size={17} />登记审核</button><button className={tab === "members" ? "is-active" : ""} onClick={() => switchTab("members")}><Users size={17} />会员档案</button></nav>
      <div><a href={APP_ROUTES.volunteer}><ArrowLeft size={15} />返回志愿首页</a><button onClick={() => { clearStoredToken(); setToken(""); }}><LogOut size={15} />退出登录</button></div>
    </aside>
    <section className="yv-admin-main">
      <header><div><small>YUPIAN VOLUNTEER</small><h1>{tab === "applications" ? "登记审核" : "会员档案"}</h1><p>{tab === "applications" ? "核对申请资料，通过后自动生成会员编号。" : "查看已经审核通过的正式会员。"}</p></div><span>{total} 条记录</span></header>
      <div className="yv-admin-mobile-tabs"><button className={tab === "applications" ? "is-active" : ""} onClick={() => switchTab("applications")}>登记审核</button><button className={tab === "members" ? "is-active" : ""} onClick={() => switchTab("members")}>会员档案</button></div>
      <form className="yv-admin-filter" onSubmit={search}><label><Search size={16} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={tab === "applications" ? "搜索姓名或联系方式" : "搜索姓名、联系方式或会员编号"} /></label><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>{tab === "applications" ? <><option value="">全部状态</option><option value="PENDING">待审核</option><option value="APPROVED">已通过</option><option value="REJECTED">已拒绝</option></> : <><option value="">全部状态</option><option value="ACTIVE">正常</option><option value="PAUSED">暂停</option><option value="EXITED">已退出</option></>}</select><button>查询</button></form>
      {message ? <p className="yv-admin-message" role="alert">{message}</p> : null}
      {loading ? <div className="yv-admin-empty"><LoaderCircle className="spin" size={24} />正在加载</div> : tab === "applications" ? <ApplicationList rows={applications} onReview={openReview} /> : <MemberList rows={members} />}
      <footer className="yv-pagination"><span>第 {page} / {pageCount} 页</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} />上一页</button><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>下一页<ChevronRight size={16} /></button></div></footer>
    </section>
    {reviewing ? <div className="yv-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewing(null); }}><section className="yv-review-modal" role="dialog" aria-modal="true"><button className="yv-modal-close" onClick={() => setReviewing(null)} aria-label="关闭"><X size={17} /></button><small>APPLICATION REVIEW</small><h2>{reviewStatus === "APPROVED" ? "通过登记申请" : "拒绝登记申请"}</h2><p>申请人：<b>{reviewing.name}</b> · {reviewing.phone}</p><label><span>审核备注</span><textarea maxLength={500} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder={reviewStatus === "APPROVED" ? "可选，记录核对情况" : "建议填写拒绝原因"} /></label><div><button className="ghost" onClick={() => setReviewing(null)}>取消</button><button className={reviewStatus === "APPROVED" ? "approve" : "reject"} disabled={reviewSaving} onClick={() => void saveReview()}>{reviewSaving ? <LoaderCircle className="spin" size={16} /> : reviewStatus === "APPROVED" ? <Check size={16} /> : <X size={16} />}{reviewSaving ? "处理中" : "确认提交"}</button></div></section></div> : null}
  </main>;
}

function ApplicationList({ rows, onReview }: { rows: Application[]; onReview: (item: Application, status: "APPROVED" | "REJECTED") => void }) {
  if (!rows.length) return <div className="yv-admin-empty"><UserCheck size={27} />没有符合条件的登记申请</div>;
  return <div className="yv-admin-list">{rows.map((item) => <article className="yv-application-card" key={item.id}>
    <div className="yv-member-head">{item.photoUrl ? <img src={item.photoUrl} alt="" /> : <span>{item.name.slice(0, 1)}</span>}<div><h2>{item.name}</h2><p>{item.gender} · {item.ethnicity} · {item.politicalStatus}</p></div><em className={`status-${item.status.toLowerCase()}`}>{statusLabel[item.status]}</em></div>
    <dl><div><dt>联系方式</dt><dd>{item.phone}</dd></div><div><dt>身份证</dt><dd>{item.idCardMasked}</dd></div><div><dt>工作单位</dt><dd>{item.workUnit}</dd></div><div><dt>联系地址</dt><dd>{item.address}</dd></div><div><dt>加入时间</dt><dd>{item.joinedDate}</dd></div><div><dt>可服务时间</dt><dd>{item.availability.join("、")}</dd></div><div className="wide"><dt>特长</dt><dd>{item.specialty}</dd></div><div className="wide"><dt>提交来源</dt><dd>{item.sourceIp || "未知 IP"} · {ipDetailLabel(item.ipInfo)}</dd></div>{item.suggestion ? <div className="wide"><dt>意见建议</dt><dd>{item.suggestion}</dd></div> : null}</dl>
    <footer><small>提交于 {formatTime(item.createTime)} · 承诺书 {item.consentVersion}</small>{item.status === "PENDING" ? <div><button className="reject" onClick={() => onReview(item, "REJECTED")}><X size={14} />拒绝</button><button className="approve" onClick={() => onReview(item, "APPROVED")}><Check size={14} />通过</button></div> : <span>{item.reviewedBy ? `${item.reviewedBy} · ${formatTime(item.reviewedAt)}` : "已完成审核"}</span>}</footer>
  </article>)}</div>;
}

function MemberList({ rows }: { rows: Member[] }) {
  if (!rows.length) return <div className="yv-admin-empty"><Users size={27} />没有符合条件的会员档案</div>;
  return <div className="yv-member-grid">{rows.map((item) => <article key={item.id}><div className="yv-member-head">{item.photoUrl ? <img src={item.photoUrl} alt="" /> : <span>{item.name.slice(0, 1)}</span>}<div><h2>{item.name}</h2><p>{item.memberNo}</p></div><em className={`status-${item.status.toLowerCase()}`}>{statusLabel[item.status]}</em></div><p className="yv-member-specialty">{item.specialty}</p><dl><div><dt>联系方式</dt><dd>{item.phone}</dd></div><div><dt>加入时间</dt><dd>{item.joinedDate}</dd></div><div><dt>参与活动</dt><dd>{item.activityCount} 次</dd></div><div><dt>服务时长</dt><dd>{Math.floor(item.serviceMinutes / 60)} 小时 {item.serviceMinutes % 60} 分</dd></div></dl></article>)}</div>;
}

function VolunteerAdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [sending, setSending] = useState(false); const [loading, setLoading] = useState(false); const [countdown, setCountdown] = useState(0); const [message, setMessage] = useState("");
  useEffect(() => { if (countdown <= 0) return; const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000); return () => window.clearTimeout(timer); }, [countdown]);
  async function send() { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setMessage("请输入正确的邮箱地址"); setSending(true); try { const result = await sendEmailCode(email, "login") as { resendAfter?: number }; setCountdown(Number(result.resendAfter || 60)); setMessage("验证码已发送"); } catch (error) { setMessage(error instanceof Error ? error.message : "发送失败"); } finally { setSending(false); } }
  async function submit(event: FormEvent) { event.preventDefault(); if (!/^\d{6}$/.test(code)) return setMessage("请输入 6 位验证码"); setLoading(true); try { const result = await loginByEmail(email, code); onLogin(result.token); } catch (error) { setMessage(error instanceof Error ? error.message : "登录失败"); } finally { setLoading(false); } }
  return <main className="yv-admin-login"><a className="yv-brand" href={APP_ROUTES.volunteer}><span><HandHeart size={19} /></span><b>鱼片志愿</b></a><section><span><LogIn size={24} /></span><small>MANAGEMENT CONSOLE</small><h1>管理后台</h1><p>使用具备志愿管理权限的系统账号登录。</p><form onSubmit={submit}><label><span>邮箱</span><div><Mail size={16} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="请输入已绑定邮箱" /></div></label><label><span>邮箱验证码</span><div><Check size={16} /><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 位验证码" /><button type="button" disabled={sending || countdown > 0} onClick={() => void send()}>{countdown > 0 ? `${countdown}s` : sending ? "发送中" : "获取验证码"}</button></div></label>{message ? <p>{message}</p> : null}<button className="yv-login-submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}{loading ? "正在登录" : "进入管理后台"}</button></form><a href={APP_ROUTES.manage}>也可以先前往统一管理端登录</a></section></main>;
}

function formatTime(value?: string) { return value ? value.replace("T", " ").slice(0, 16) : ""; }
