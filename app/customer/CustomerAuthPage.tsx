import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest, clearCustomerToken, getCustomerToken, setCustomerToken } from "../lib/api";
import { SliderCaptcha } from "../components/SliderCaptcha";

type Mode = "login" | "register" | "reset";
type LoginMethod = "password" | "code";
type Context = {
  purchaserShortId?: string;
  purchaserName?: string;
  registered?: boolean;
  phoneRequired?: boolean;
  accountRequired?: number;
  quickLoginEnabled?: number;
  passwordAvailable?: boolean;
  maskedEmail?: string;
};
type AuthData = { token?: string; purchaserShortId?: string; purchaserName?: string; email?: string };
type RegisterPreview = { confirmRequired?: boolean; matchType?: string; registered?: boolean; purchaserName?: string; maskedEmail?: string; maskedPhone?: string; message?: string };

const SHORT_ID_PATTERN = /^[2-9a-hj-km-np-z]{6}$/;

export default function CustomerAuthPage({ mode }: { mode: Mode }) {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const [shortId, setShortId] = useState((query.get("shortId") || "").toLowerCase());
  const [context, setContext] = useState<Context | null>(null);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaUuid, setCaptchaUuid] = useState("");
  const [captchaOn, setCaptchaOn] = useState(true);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [registerPreview, setRegisterPreview] = useState<RegisterPreview | null>(null);
  const [confirmExisting, setConfirmExisting] = useState(false);

  const isSelfRegistration = mode === "register" && shortId.length === 0;

  useEffect(() => {
    if (mode === "reset" || !SHORT_ID_PATTERN.test(shortId)) {
      setContext(null);
      return;
    }
    setError("");
    apiRequest<{ data?: Context }>("/customer/register-context", { auth: false, query: { shortId } })
      .then((result) => {
        const next = result.data || null;
        setContext(next);
        if (mode === "login" && next && !next.passwordAvailable) setLoginMethod("code");
      })
      .catch((cause) => {
        setContext(null);
        if (mode !== "login") setError(cause instanceof Error ? cause.message : "专属下单码无效");
      });
  }, [mode, shortId]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    setRegisterPreview(null);
    setConfirmExisting(false);
  }, [email, mode, name, phone, shortId]);

  function validateShortIdForAction() {
    if (mode === "reset" || mode === "login") return true;
    if (mode === "register" && shortId.length === 0) return true;
    if (!SHORT_ID_PATTERN.test(shortId) || !context) {
      setError("请输入有效的专属下单码");
      return false;
    }
    return true;
  }

  async function sendCode() {
    if (!email.trim()) return setError("请输入邮箱");
    if (!validateShortIdForAction()) return;
    if (mode === "register" && isSelfRegistration && !(await ensureRegisterConfirmation())) return;
    setSending(true);
    setError("");
    try {
      await apiRequest("/customer/auth/code", {
        auth: false,
        method: "POST",
        body: { shortId, email, type: mode === "login" ? "login" : mode },
      });
      setCountdown(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "验证码发送失败");
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!validateShortIdForAction()) return;
    if (isSelfRegistration && !name.trim()) return setError("请输入姓名");
    if (isSelfRegistration && !/^1\d{10}$/.test(phone)) return setError("请输入真实的11位手机号");
    if (mode !== "login" && password !== confirmPassword) return setError("两次输入的密码不一致");
    if (mode === "register" && isSelfRegistration && !(await ensureRegisterConfirmation())) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const endpoint = loginMethod === "code" ? "/customer/auth/login-code" : "/customer/auth/login";
        if (loginMethod === "password" && captchaOn && !captchaCode.trim()) return setError("请先完成滑块验证");
        const result = await apiRequest<{ data?: AuthData }>(endpoint, {
          auth: false,
          method: "POST",
          body: loginMethod === "code" ? { shortId, email, code } : { shortId, email, password, code: captchaCode.trim(), uuid: captchaUuid },
        });
        finishLogin(result.data);
      } else if (mode === "register") {
        const result = await apiRequest<{ data?: AuthData }>("/customer/auth/register", {
          auth: false,
          method: "POST",
          body: { shortId, name, email, phone, code, password, confirmExisting: confirmExisting ? "1" : "0" },
        });
        finishLogin(result.data);
      } else {
        await apiRequest("/customer/auth/reset", {
          auth: false,
          method: "POST",
          body: { email, code, password },
        });
        clearCustomerToken();
        window.location.href = shortId ? `/customer/login?shortId=${shortId}&reset=success` : "/customer/login?reset=success";
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请重试");
      if (mode === "login" && loginMethod === "password") setCaptchaReset((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  function finishLogin(data?: AuthData) {
    if (!data?.token || !data.purchaserShortId) throw new Error("登录结果不完整");
    setCustomerToken(data.token);
    window.location.href = `/tools/order/${data.purchaserShortId}`;
  }

  async function ensureRegisterConfirmation() {
    if (!email.trim()) { setError("请输入邮箱"); return false; }
    if (!name.trim()) { setError("请输入姓名"); return false; }
    if (!/^1\d{10}$/.test(phone)) { setError("请输入真实的11位手机号"); return false; }
    if (confirmExisting) return true;
    try {
      const result = await apiRequest<{ data?: RegisterPreview }>("/customer/auth/register-preview", {
        auth: false,
        method: "POST",
        body: { shortId, name, email, phone },
      });
      const preview = result.data || null;
      if (!preview?.confirmRequired) return true;
      setRegisterPreview(preview);
      setError("");
      return false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "注册信息校验失败");
      return false;
    }
  }

  const title = mode === "login" ? "客户登录" : mode === "register" ? "开通客户账号" : "找回密码";
  const subtitle = mode === "login"
    ? "验证身份后进入你的专属下单与订单页面"
    : mode === "register"
      ? "有专属下单码可直接绑定，没有也可以注册新账号"
      : "通过邮箱验证码重新设置登录密码";
  const shortIdLink = shortId ? `?shortId=${shortId}` : "";

  return (
    <main className="customer-auth-page">
      <a className="customer-auth-brand" href="/"><b>炎陵黄桃</b><span>返回主页</span></a>
      <section className="customer-auth-panel">
        <header><span>客户中心</span><h1>{title}</h1><p>{subtitle}</p></header>
        <form onSubmit={submit}>
          {mode === "register" ? (
            <label>
              <span>专属下单码（选填）</span>
              <input
                value={shortId}
                maxLength={6}
                autoComplete="off"
                onChange={(event) => setShortId(event.target.value.toLowerCase().replace(/[^2-9a-hj-km-np-z]/g, ""))}
                placeholder="没有可留空，系统自动生成"
              />
              <small>{context ? `${context.purchaserName || "买家"}，${context.registered ? "账号已开通" : "尚未完成注册"}` : "填写后绑定已有专属页面，留空则创建新的专属页面"}</small>
            </label>
          ) : null}

          {mode === "register" && isSelfRegistration ? (
            <label><span>姓名</span><input value={name} maxLength={30} autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="用于收货与订单识别" /></label>
          ) : null}
          {mode === "login" && context && !context.registered ? <p className="customer-auth-error">该买家尚未开通账号，请先完成注册。</p> : null}
          {mode === "login" ? (
            <div className="customer-login-method" role="tablist">
              <button type="button" className={loginMethod === "password" ? "active" : ""} onClick={() => setLoginMethod("password")} disabled={context?.passwordAvailable === false}>密码登录</button>
              <button type="button" className={loginMethod === "code" ? "active" : ""} onClick={() => setLoginMethod("code")}>邮箱验证码</button>
            </div>
          ) : null}
          <label><span>邮箱</span><input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder={context?.maskedEmail || "用于登录和找回密码"} /></label>
          {mode === "register" && (isSelfRegistration || context?.phoneRequired) ? (
            <label><span>真实手机号</span><input inputMode="tel" autoComplete="tel" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder={isSelfRegistration ? "用于创建买家资料" : "当前为占位手机号，请先完善"} /></label>
          ) : null}
          {mode === "register" && registerPreview?.confirmRequired ? (
            <section className="customer-register-confirm">
              <b>{registerPreview.registered && registerPreview.matchType === "phone" ? "该手机号已绑定账号" : "发现已有买家档案"}</b>
              <p>{registerPreview.message || "确认后继续绑定原档案。"}</p>
              <small>{[registerPreview.purchaserName, registerPreview.maskedPhone, registerPreview.maskedEmail].filter(Boolean).join(" · ")}</small>
              {registerPreview.registered && registerPreview.matchType === "phone"
                ? <a href="/customer/login">去登录</a>
                : <button type="button" onClick={() => { setConfirmExisting(true); setRegisterPreview(null); setError(""); }}>确认并继续</button>}
            </section>
          ) : null}
          {mode !== "login" || loginMethod === "code" ? (
            <label><span>邮箱验证码</span><div className="customer-code-row"><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6位验证码" /><button type="button" disabled={sending || countdown > 0} onClick={sendCode}>{countdown > 0 ? `${countdown}s` : sending ? "发送中" : "获取验证码"}</button></div></label>
          ) : null}
          {mode !== "login" || loginMethod === "password" ? (
            <label><span>{mode === "reset" ? "新密码" : "登录密码"}</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8-64位，需包含字母和数字" /></label>
          ) : null}
          {mode === "login" && loginMethod === "password" && captchaOn ? (
            <label><span>安全验证</span><SliderCaptcha resetKey={captchaReset} disabled={busy} onEnabledChange={setCaptchaOn} onVerified={(value) => { setCaptchaUuid(value.uuid); setCaptchaCode(value.token); }} /></label>
          ) : null}
          {mode !== "login" ? <label><span>确认密码</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" /></label> : null}
          {error ? <p className="customer-auth-error">{error}</p> : null}
          <button className="customer-auth-submit" disabled={busy || (mode === "register" && context?.registered) || (mode === "login" && context?.registered === false)}>{busy ? "正在处理" : mode === "login" ? "登录并进入" : mode === "register" ? "完成注册" : "重置密码"}</button>
        </form>
        <footer>
          {mode === "login" ? <><a href={`/customer/register${shortIdLink}`}>首次注册</a><a href="/customer/reset">忘记密码</a></> : <a href={`/customer/login${shortIdLink}`}>返回客户登录</a>}
          {getCustomerToken() ? <button type="button" onClick={() => { clearCustomerToken(); window.location.reload(); }}>清除旧登录</button> : null}
        </footer>
      </section>
    </main>
  );
}
