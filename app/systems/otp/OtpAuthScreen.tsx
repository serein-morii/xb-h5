import { BookOpen, Fingerprint, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldAlert, ShieldCheck, User, UserPlus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SliderCaptcha } from "../../components/SliderCaptcha";
import { apiRequest, COMMON_MAILBOX_HINT, loginByEmail, sendEmailCode } from "../../lib/api";
import { API_PATHS, APP_ROUTES } from "../../lib/pathConventions";
import { finishPasskeyLogin, getPasskeyLoginOptions, registerOtpAccount } from "./vaultApi";
import { getPasskey } from "../../lib/passkey";
import VaultToastMessage from "./VaultToastMessage";
import "./otp-auth.css";

export default function OtpAuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, registration?: { username: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginMethod, setLoginMethod] = useState<"password" | "email" | "passkey">("email");
  const [username, setUsername] = useState(() => localStorage.getItem("otp-vault-username") || "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [publicKey, setPublicKey] = useState("");
  const [uuid, setUuid] = useState("");
  const [code, setCode] = useState("");
  const [captchaOn, setCaptchaOn] = useState(true);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [longSession, setLongSession] = useState(true);
  const [message, setMessage] = useState("");
  const [registrationPrompt, setRegistrationPrompt] = useState(false);

  useEffect(() => {
    apiRequest<{ publicKey?: string; data?: { publicKey?: string } }>(API_PATHS.auth.publicKey, { auth: false }).then((result) => setPublicKey(String(result.publicKey || result.data?.publicKey || ""))).catch((error) => setMessage(error instanceof Error ? error.message : "初始化失败"));
  }, []);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  useEffect(() => {
    if (!registrationPrompt) return;
    const overflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setRegistrationPrompt(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [registrationPrompt]);

  const switchMode = (next: "login" | "register") => {
    setMode(next); setLoginMethod("email"); setPassword(""); setEmailCode(""); setCountdown(0); setUuid(""); setCode(""); setMessage(""); setRegistrationPrompt(false); setCaptchaReset((value) => value + 1);
  };

  const switchLoginMethod = (next: "password" | "email" | "passkey") => {
    setLoginMethod(next); setPassword(""); setEmailCode(""); setCountdown(0); setUuid(""); setCode(""); setMessage(""); setRegistrationPrompt(false); setCaptchaReset((value) => value + 1);
  };

  async function requestEmailCode(type: "otp-login" | "otp-register") {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return setMessage("请输入正确的邮箱地址");
    setEmailSending(true); setMessage("");
    try {
      const result = await sendEmailCode(value, type);
      // 有效期与重发间隔以后端下发的策略为准，避免双写漂移
      const expiresIn = Number((result as { expiresIn?: number }).expiresIn || 300);
      const resendAfter = Number((result as { resendAfter?: number }).resendAfter || 60);
      setEmail(value); setCountdown(resendAfter);
      setMessage(`验证码已发送，请在 ${Math.round(expiresIn / 60)} 分钟内完成${type === "otp-login" ? "登录" : "注册"}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "验证码发送失败"); }
    finally { setEmailSending(false); }
  }

  // 注册只需邮箱 + 验证码，成功即自动登录，由保险库引导页补全账号、用户名和密码
  async function submitRegister() {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return setMessage("请输入正确的邮箱地址");
    if (!/^\d{6}$/.test(emailCode.trim())) return setMessage("请输入 6 位邮箱验证码");
    setBusy(true); setMessage("");
    try {
      const result = await registerOtpAccount(value, emailCode.trim());
      const token = String(result.token || "");
      if (!token) throw new Error("注册成功但未返回凭证");
      onAuthenticated(token, { username: String(result.username || value.split("@")[0]) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "注册失败");
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "register") return void submitRegister();
    const account = username.trim();
		if ((loginMethod === "password" || loginMethod === "passkey") && !account) return setMessage("请输入账号或邮箱");
    if (loginMethod === "password" && (password.length < 5 || password.length > 20)) return setMessage("密码长度必须为 5-20 位");
    if (loginMethod === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setMessage("请输入正确的邮箱地址");
    if (loginMethod === "email" && !/^\d{6}$/.test(emailCode.trim())) return setMessage("请输入 6 位邮箱验证码");
    if (captchaOn && loginMethod === "password" && (!uuid || !code)) return setMessage("请先完成滑块验证");
    if (loginMethod === "password" && !publicKey) return setMessage("安全加密尚未准备完成，请稍后重试");
    setBusy(true); setMessage("");
    try {
			if (loginMethod === "passkey") {
				const options = await getPasskeyLoginOptions(account, longSession);
				const credential = await getPasskey(options.data.publicKey);
				const result = await finishPasskeyLogin(options.data.requestId, credential);
				if (!result.data.token) throw new Error("登录成功但未返回凭证");
				localStorage.setItem("otp-vault-username", result.data.username || account);
				onAuthenticated(result.data.token); return;
			}
      if (loginMethod === "email") {
        const result = await loginByEmail(email, emailCode, "otp-login", longSession);
        const token = String(result.token || "");
        if (!token) throw new Error("登录成功但未返回凭证");
        onAuthenticated(token);
        return;
      }
      const { JSEncrypt } = await import("jsencrypt");
      const encryptor = new JSEncrypt(); encryptor.setPublicKey(publicKey);
      const encryptedPassword = encryptor.encrypt(password);
      if (!encryptedPassword) throw new Error("密码加密失败");
      const result = await apiRequest<Record<string, unknown>>(API_PATHS.auth.login, { auth: false, method: "POST", body: { username: account, password: encryptedPassword, code, uuid, longSession } });
      const token = String(result.token || "");
      if (!token) throw new Error("登录成功但未返回凭证");
      localStorage.setItem("otp-vault-username", account);
      onAuthenticated(token);
    } catch (error) {
      if (loginMethod === "email" && error instanceof Error && error.message === "该邮箱未注册") {
        setEmailCode(""); setCountdown(0); setRegistrationPrompt(true); return;
      }
      setMessage(error instanceof Error ? error.message : "登录失败");
      setUuid(""); setCode(""); setCaptchaReset((value) => value + 1);
    } finally { setBusy(false); }
  }

  return <main className="otp-auth-page"><div className="otp-auth-app">
    <section className="otp-auth-hero">
      <span className="otp-auth-mark"><KeyRound size={25} /></span>
      <div className="otp-auth-brand"><small>SECURE ACCESS</small><h1>OTP Vault</h1><p>私人身份保险库</p></div>
      <div className="otp-auth-signal"><ShieldCheck size={14} />加密连接已就绪</div>
    </section>
    <section className="otp-auth-card">
      <span className="otp-auth-handle" aria-hidden="true" />
      <div className="otp-auth-copy"><h2>{mode === "login" ? "欢迎回来" : "创建账户"}</h2><p>{mode === "login" ? loginMethod === "email" ? "使用绑定邮箱和验证码登录。" : loginMethod === "passkey" ? "通过此设备的生物识别或系统 PIN 登录。" : "使用账号密码登录 OTP Vault。" : `只需邮箱和验证码，注册成功后自动登录。${COMMON_MAILBOX_HINT}。`}</p></div>
      <div className="otp-auth-tabs"><button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => switchMode("login")}>登录</button><button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => switchMode("register")}>注册</button></div>
      <form className="otp-auth-form" onSubmit={submit}>
		{mode === "login" ? <div className="otp-login-methods"><button type="button" className={loginMethod === "email" ? "is-active" : ""} onClick={() => switchLoginMethod("email")}>邮箱验证码</button><button type="button" className={loginMethod === "password" ? "is-active" : ""} onClick={() => switchLoginMethod("password")}>账号密码</button><button type="button" className={loginMethod === "passkey" ? "is-active" : ""} onClick={() => switchLoginMethod("passkey")}>Passkey</button></div> : null}
		{mode === "login" && (loginMethod === "password" || loginMethod === "passkey") ? <label><span>{loginMethod === "passkey" ? "账号或邮箱" : "账号"}</span><div>{loginMethod === "passkey" ? <Fingerprint size={17} /> : <User size={17} />}<input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={50} autoComplete="username webauthn" placeholder={loginMethod === "passkey" ? "输入账号或邮箱" : "2-20 位账号"} /></div></label> : null}
        {mode === "register" || loginMethod === "email" ? <label><span>邮箱</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setRegistrationPrompt(false); }} maxLength={50} autoComplete="email" placeholder={mode === "register" ? COMMON_MAILBOX_HINT : "请输入已绑定邮箱"} /></div></label> : null}
        {mode === "register" || loginMethod === "email" ? <label><span>邮箱验证码</span><div className="otp-email-code"><ShieldCheck size={17} /><input inputMode="numeric" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} autoComplete="one-time-code" placeholder="6 位验证码" /><button type="button" disabled={emailSending || countdown > 0} onClick={() => void requestEmailCode(mode === "register" ? "otp-register" : "otp-login")}>{emailSending ? "发送中" : countdown > 0 ? `${countdown}s` : "获取验证码"}</button></div></label> : null}
        {mode === "login" && loginMethod === "password" ? <label><span>密码</span><div><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={20} autoComplete="current-password" placeholder="5-20 位密码" /></div></label> : null}
        {captchaOn && mode === "login" && loginMethod === "password" ? <label><span>安全验证</span><SliderCaptcha resetKey={captchaReset} disabled={busy} onEnabledChange={setCaptchaOn} onVerified={(value) => { setUuid(value.uuid); setCode(value.token); }} /></label> : null}
        {mode === "login" ? <><label className="otp-long-session"><input type="checkbox" checked={longSession} onChange={(event) => setLongSession(event.target.checked)} /><i /><span><b>保持登录 15 天</b><small>有操作时自动续期</small></span></label>{longSession ? <p className="otp-session-warning"><ShieldAlert size={15} /><span><b>请确认这是你的私人设备</b><small>15 天内无需重新登录，公共或他人设备请勿开启。</small></span></p> : null}</> : null}
		<VaultToastMessage message={message} onDismiss={() => setMessage("")} />
		<button className="otp-auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : mode === "login" && loginMethod === "passkey" ? <Fingerprint size={18} /> : mode === "login" ? <ShieldCheck size={18} /> : <UserPlus size={18} />}{busy ? "正在处理" : mode === "login" && loginMethod === "passkey" ? "使用 Passkey 登录" : mode === "login" ? "进入保险库" : "创建账号并进入"}</button>
      </form>
      <footer><a href={APP_ROUTES.otpGuide}><BookOpen size={13} />使用指南</a></footer>
    </section>
  </div>{registrationPrompt ? <div className="otp-register-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) setRegistrationPrompt(false); }}><section className="otp-register-modal" role="alertdialog" aria-modal="true" aria-labelledby="otp-register-prompt-title" aria-describedby="otp-register-prompt-detail"><button type="button" className="otp-register-modal-close" onClick={() => setRegistrationPrompt(false)} aria-label="关闭"><X size={17} /></button><span className="otp-register-modal-icon"><UserPlus size={23} /></span><div><small>CREATE ACCOUNT</small><h2 id="otp-register-prompt-title">该邮箱尚未注册</h2><p id="otp-register-prompt-detail">是否使用 <b>{email.trim().toLowerCase()}</b> 创建 OTP Vault 账户？</p></div><footer><button type="button" onClick={() => setRegistrationPrompt(false)}>暂不注册</button><button type="button" autoFocus onClick={() => switchMode("register")}>创建账户</button></footer></section></div> : null}</main>;
}
