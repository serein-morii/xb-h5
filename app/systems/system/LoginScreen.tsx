import { Fingerprint, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  apiRequest,
  loginByEmail,
  sendEmailCode,
} from "../../lib/api";
import { API_PATHS, APP_ROUTES } from "../../lib/pathConventions";
import { ArrowLeft, Settings2 } from "lucide-react";
import { SliderCaptcha } from "../../components/SliderCaptcha";
import { getPasskey } from "../../lib/passkey";
import VaultToastMessage from "../otp/VaultToastMessage";
import { ForgotPasswordSheet } from "../order/admin/login";
import "../otp/otp-auth.css";

type LoginMethod = "email" | "account" | "passkey";

/**
 * 系统中心专属登录页：与订单管理登录页分开维护。
 * 结构复用 OTP 登录的设计语言；认证走同一套后端账号体系，功能独立。
 */
export default function SystemLoginScreen({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [uuid, setUuid] = useState("");
  const [captchaOn, setCaptchaOn] = useState(true);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [publicKey, setPublicKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    const flash = window.sessionStorage.getItem("xb-mobile-flash");
    if (flash) {
      setMessage(flash);
      window.sessionStorage.removeItem("xb-mobile-flash");
    }
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (emailCountdown <= 0) return;
    const timer = window.setTimeout(() => setEmailCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [emailCountdown]);
  useEffect(() => {
    apiRequest<{ publicKey?: string; data?: { publicKey?: string } }>(API_PATHS.auth.publicKey, { auth: false })
      .then((result) => setPublicKey(String(result.publicKey || result.data?.publicKey || "")))
      .catch((error) => setMessage(error instanceof Error ? error.message : "系统初始化失败"));
  }, []);

  function switchLoginMethod(next: LoginMethod) {
    setLoginMethod(next);
    setPassword(""); setEmailCode(""); setUuid(""); setCode("");
    setMessage(""); setCaptchaReset((value) => value + 1);
  }

  async function requestEmailCode() {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return setMessage("请输入正确的邮箱地址");
    setEmailSending(true); setMessage("");
    try {
      const result = await sendEmailCode(value, "login") as { resendAfter?: number };
      setEmailCountdown(Number(result.resendAfter || 60));
      setMessage("验证码已发送，请到邮箱查收");
    } catch (error) { setMessage(error instanceof Error ? error.message : "验证码发送失败"); }
    finally { setEmailSending(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (loginMethod === "passkey") return void loginWithPasskey();
    if (loginMethod === "email") {
      const value = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return setMessage("请输入正确的邮箱地址");
      if (!/^\d{6}$/.test(emailCode.trim())) return setMessage("请输入 6 位邮箱验证码");
      setLoading(true);
      try {
        const result = await loginByEmail(value, emailCode.trim());
        const token = String(result.token || "");
        if (!token) throw new Error("登录成功但未返回凭证");
        onLogin(token, value);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "登录失败");
      } finally { setLoading(false); }
      return;
    }
    if (!username.trim() || !password) return setMessage("请输入账号和密码");
    if (captchaOn && !code.trim()) return setMessage("请先完成滑块验证");
    if (!publicKey) return setMessage("登录加密尚未准备完成，请稍后重试");
    setLoading(true);
    try {
      const { JSEncrypt } = await import("jsencrypt");
      const encryptor = new JSEncrypt();
      encryptor.setPublicKey(publicKey);
      const encryptedPassword = encryptor.encrypt(password);
      if (!encryptedPassword) throw new Error("密码加密失败");
      const result = await apiRequest<{ token?: string }>(API_PATHS.auth.login, {
        auth: false,
        method: "POST",
        body: { username: username.trim(), password: encryptedPassword, code: code.trim(), uuid },
      });
      const token = String(result.token || "");
      if (!token) throw new Error("登录成功但未返回凭证");
      onLogin(token, username.trim());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
      setCaptchaReset((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPasskey() {
    if (!username.trim()) return setMessage("请先输入账号或邮箱");
    setLoading(true); setMessage("");
    try {
      const options = await apiRequest<{ data?: { requestId?: string; publicKey?: Record<string, unknown> } }>(`${API_PATHS.auth.passkeyLogin}/options`, { auth: false, method: "POST", body: { identifier: username.trim() } });
      if (!options.data?.requestId || !options.data.publicKey) throw new Error("Passkey 登录参数不完整");
      const result = await apiRequest<{ data?: { token?: string; username?: string } }>(`${API_PATHS.auth.passkeyLogin}/finish`, { auth: false, method: "POST", body: { requestId: options.data.requestId, credential: await getPasskey(options.data.publicKey) } });
      const token = String(result.data?.token || "");
      if (!token) throw new Error("登录成功但未返回凭证");
      onLogin(token, String(result.data?.username || username.trim()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey 登录失败");
    } finally { setLoading(false); }
  }

  return <main className="otp-auth-page login-system-page">
    <div className="otp-auth-app">
      <section className="otp-auth-hero">
        <span className="otp-auth-mark"><Settings2 size={25} /></span>
        <div className="otp-auth-brand"><small>PLATFORM CONSOLE</small><h1>系统中心</h1><p>账号权限、运行监控与平台服务</p></div>
        <div className="otp-auth-signal"><ShieldCheck size={14} />RSA 加密通道已就绪</div>
      </section>
      <section className="otp-auth-card">
        <span className="otp-auth-handle" aria-hidden="true" />
        <div className="otp-auth-copy"><h2>管理员登录</h2><p>{loginMethod === "email" ? "使用绑定邮箱的验证码登录。" : loginMethod === "passkey" ? "通过此设备的生物识别或系统 PIN 登录。" : "使用账号密码登录系统中心。"}</p></div>
        <div className="otp-login-methods"><button type="button" className={loginMethod === "email" ? "is-active" : ""} onClick={() => switchLoginMethod("email")}>邮箱验证码</button><button type="button" className={loginMethod === "account" ? "is-active" : ""} onClick={() => switchLoginMethod("account")}>账号密码</button><button type="button" className={loginMethod === "passkey" ? "is-active" : ""} onClick={() => switchLoginMethod("passkey")}>Passkey</button></div>
        <form className="otp-auth-form" onSubmit={submit}>
          {loginMethod === "email" ? <label><span>邮箱</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="请输入已绑定邮箱" /></div></label> : null}
          {loginMethod === "email" ? <label><span>邮箱验证码</span><div className="otp-email-code"><ShieldCheck size={17} /><input inputMode="numeric" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} autoComplete="one-time-code" placeholder="6 位验证码" /><button type="button" disabled={emailSending || emailCountdown > 0} onClick={() => void requestEmailCode()}>{emailSending ? "发送中" : emailCountdown > 0 ? `${emailCountdown}s` : "获取验证码"}</button></div></label> : null}
          {loginMethod === "account" || loginMethod === "passkey" ? <label><span>{loginMethod === "passkey" ? "账号或邮箱" : "账号"}</span><div><Settings2 size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder={loginMethod === "passkey" ? "输入账号或邮箱" : "请输入账号"} /></div></label> : null}
          {loginMethod === "account" ? <label><span>密码</span><div><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入密码" /></div></label> : null}
          {loginMethod === "account" && captchaOn ? <label><span>安全验证</span><SliderCaptcha resetKey={captchaReset} disabled={loading} onEnabledChange={setCaptchaOn} onVerified={(value) => { setUuid(value.uuid); setCode(value.token); }} /></label> : null}
          {loginMethod === "account" ? <button type="button" className="otp-auth-forgot" onClick={() => setForgotOpen(true)}>忘记密码？</button> : null}
          <VaultToastMessage message={message} onDismiss={() => setMessage("")} />
          <button className="otp-auth-submit" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : loginMethod === "passkey" ? <Fingerprint size={18} /> : <ShieldCheck size={18} />}{loading ? "正在处理" : loginMethod === "passkey" ? "使用 Passkey 登录" : loginMethod === "email" ? "验证并登录" : "进入控制台"}</button>
        </form>
        <footer><a href={APP_ROUTES.manage}><ArrowLeft size={13} />返回订单系统</a></footer>
      </section>
    </div>
    <a className="icp-link otp-auth-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a>
    <ForgotPasswordSheet open={forgotOpen} onClose={() => setForgotOpen(false)} />
  </main>;
}
