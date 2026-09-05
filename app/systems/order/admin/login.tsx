import {
  Briefcase,
  ShoppingBag,
  Building2,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  apiRequest,
  bindEmail,
  changePwdByEmail,
  loginByEmail,
  resetPasswordByEmail,
  sendEmailCode,
  updateProfile,
  COMMON_MAILBOX_HINT,
} from "../../../lib/api";
import { API_PATHS, APP_ROUTES } from "../../../lib/pathConventions";
import type { DataRow } from "./core";
import { Sheet } from "./ui";
import { SliderCaptcha } from "../../../components/SliderCaptcha";
import { getPasskey } from "../../../lib/passkey";
import VaultToastMessage from "../../otp/VaultToastMessage";
import "../../otp/otp-vault.css";
import "../../otp/otp-auth.css";

export function LoginScreen({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [uuid, setUuid] = useState("");
  const [captchaOn, setCaptchaOn] = useState(true);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [publicKey, setPublicKey] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loginMethod, setLoginMethod] = useState<"account" | "email" | "passkey">("email");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  // 读取因登录过期跳转带来的 flash 提示（由 apiRequest 在 401 时写入 sessionStorage）
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
    const saved = window.localStorage.getItem("xb-mobile-username");
    if (saved) setUsername(saved);
    apiRequest<DataRow>(API_PATHS.auth.publicKey, { auth: false }).then((result) => {
        setPublicKey(String(result.publicKey || result.data?.publicKey || ""));
      }).catch((error) => setMessage(error instanceof Error ? error.message : "系统初始化失败"));
  }, []);

  function switchLoginMethod(next: "account" | "email" | "passkey") {
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
      const result = await apiRequest<DataRow>(API_PATHS.auth.login, {
        auth: false,
        method: "POST",
        body: { username: username.trim(), password: encryptedPassword, code: code.trim(), uuid },
      });
      const token = String(result.token || "");
      if (!token) throw new Error("登录成功但未返回凭证");
      if (remember) window.localStorage.setItem("xb-mobile-username", username.trim());
      else window.localStorage.removeItem("xb-mobile-username");
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
      if (remember) window.localStorage.setItem("xb-mobile-username", username.trim());
      onLogin(token, String(result.data?.username || username.trim()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey 登录失败");
    } finally { setLoading(false); }
  }

  return (
    <main className="otp-auth-page login-order-page">
      <div className="otp-auth-app">
        <section className="otp-auth-hero">
          <span className="otp-auth-mark"><ShoppingBag size={25} /></span>
          <div className="otp-auth-brand"><small>ORDER SYSTEM</small><h1>喜八订单管理</h1><p>订单、发货与账单的移动工作台</p></div>
          <div className="otp-auth-signal"><ShieldCheck size={14} />RSA 加密通道已就绪</div>
        </section>
        <section className="otp-auth-card">
          <span className="otp-auth-handle" aria-hidden="true" />
          <div className="otp-auth-copy"><h2>欢迎回来</h2><p>{loginMethod === "account" ? "使用账号密码登录订单系统。" : loginMethod === "passkey" ? "通过此设备的生物识别或系统 PIN 登录。" : "使用绑定邮箱的验证码登录。"}</p></div>
          <div className="otp-login-methods"><button type="button" className={loginMethod === "email" ? "is-active" : ""} onClick={() => switchLoginMethod("email")}>邮箱验证码</button><button type="button" className={loginMethod === "account" ? "is-active" : ""} onClick={() => switchLoginMethod("account")}>账号密码</button><button type="button" className={loginMethod === "passkey" ? "is-active" : ""} onClick={() => switchLoginMethod("passkey")}>Passkey</button></div>
          <form className="otp-auth-form" onSubmit={submit}>
            {loginMethod === "account" || loginMethod === "passkey" ? <label><span>{loginMethod === "passkey" ? "账号或邮箱" : "账号"}</span><div><User size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder={loginMethod === "passkey" ? "输入账号或邮箱" : "请输入账号"} /></div></label> : null}
            {loginMethod === "email" ? <label><span>邮箱</span><div><Send size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="请输入已绑定邮箱" /></div></label> : null}
            {loginMethod === "email" ? <label><span>邮箱验证码</span><div className="otp-email-code"><ShieldCheck size={17} /><input inputMode="numeric" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} autoComplete="one-time-code" placeholder="6 位验证码" /><button type="button" disabled={emailSending || emailCountdown > 0} onClick={() => void requestEmailCode()}>{emailSending ? "发送中" : emailCountdown > 0 ? `${emailCountdown}s` : "获取验证码"}</button></div></label> : null}
            {loginMethod === "account" ? <label><span>密码</span><div><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入密码" /></div></label> : null}
            {loginMethod === "account" && captchaOn ? <label><span>安全验证</span><SliderCaptcha resetKey={captchaReset} disabled={loading} onEnabledChange={setCaptchaOn} onVerified={(value) => { setUuid(value.uuid); setCode(value.token); }} /></label> : null}
            {loginMethod === "account" ? <label className="otp-long-session"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><i /><span><b>记住账号</b><small>下次打开自动填入</small></span></label> : null}
            {loginMethod === "account" ? <button type="button" className="otp-auth-forgot" onClick={() => setForgotOpen(true)}>忘记密码？</button> : null}
            <VaultToastMessage message={message} onDismiss={() => setMessage("")} />
            <button className="otp-auth-submit" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : loginMethod === "passkey" ? <Fingerprint size={18} /> : <ShieldCheck size={18} />}{loading ? "正在处理" : loginMethod === "passkey" ? "使用 Passkey 登录" : loginMethod === "email" ? "验证并登录" : "安全登录"}</button>
          </form>
          <footer><a href={APP_ROUTES.tools}><Sparkles size={13} />进入工具箱 · 订单查询 / 运费计算</a></footer>
        </section>
      </div>
      <a className="icp-link otp-auth-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a>
      <ForgotPasswordSheet open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </main>
  );
}

/**
 * 忘记密码 Sheet：邮箱 + 验证码 + 新密码
 */
export function ForgotPasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (!open) {
      setEmail("");
      setCode("");
      setNewPwd("");
      setConfirmPwd("");
      setMessage(null);
      setCountdown(0);
    }
  }, [open]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  async function requestCode() {
    if (!email.trim()) return setMessage({ type: "error", text: "请输入邮箱" });
    if (countdown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailCode(email, "reset");
      setMessage({ type: "info", text: "验证码已发送，请到邮箱查收" });
      setCountdown(60);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "发送失败" });
    } finally {
      setSending(false);
    }
  }
  async function submit() {
    if (!email.trim() || !code.trim()) return setMessage({ type: "error", text: "请输入邮箱和验证码" });
    if (!newPwd || newPwd.length < 5) return setMessage({ type: "error", text: "新密码至少 5 位" });
    if (newPwd !== confirmPwd) return setMessage({ type: "error", text: "两次输入的密码不一致" });
    setSubmitting(true);
    setMessage(null);
    try {
      await resetPasswordByEmail(email, code, newPwd);
      setMessage({ type: "info", text: "密码已重置，请使用新密码登录" });
      window.setTimeout(() => onClose(), 1200);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "重置失败" });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Sheet
      open={open}
      title="忘记密码"
      onClose={onClose}
      headerAction={
        <button className="sheet-header-save" type="submit" form="forgot-password-form" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={15} /> : <LockKeyhole size={15} />}
          {submitting ? "重置中" : "重置密码"}
        </button>
      }
    >
      <form
        id="forgot-password-form"
        className="mobile-form email-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label>
          <span>注册邮箱</span>
          <div className="input-shell">
            <Send size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="请输入注册时使用的邮箱"
            />
          </div>
        </label>
        <label>
          <span>验证码</span>
          <div className="input-shell email-code-shell">
            <ShieldCheck size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
            />
            <button
              type="button"
              className="email-code-button"
              onClick={requestCode}
              disabled={sending || countdown > 0}
            >
              {sending ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
            </button>
          </div>
        </label>
        <label>
          <span>新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={newPwd}
              onChange={(event) => setNewPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="至少 5 位"
            />
          </div>
        </label>
        <label>
          <span>确认新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={confirmPwd}
              onChange={(event) => setConfirmPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="再输一次"
            />
          </div>
        </label>
        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

/**
 * 改密 Sheet：已登录用户用「邮箱验证码」修改自己的密码
 * 前置：必须已绑定邮箱（由调用方在打开前判断）
 */
export function ChangePwdByEmailSheet({
  open,
  boundEmail,
  onClose,
  notify,
}: {
  open: boolean;
  boundEmail: string;
  onClose: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (!open) {
      setEmail("");
      setCode("");
      setNewPwd("");
      setConfirmPwd("");
      setMessage(null);
      setCountdown(0);
    } else if (boundEmail) {
      // 预填当前账号邮箱，用户无需再输入（仍允许手动改）
      setEmail(boundEmail);
    }
  }, [open, boundEmail]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  async function requestCode() {
    if (!email.trim()) return setMessage({ type: "error", text: "请输入邮箱" });
    if (countdown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailCode(email, "change");
      setMessage({ type: "info", text: "验证码已发送，请到邮箱查收" });
      setCountdown(60);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "发送失败" });
    } finally {
      setSending(false);
    }
  }
  async function submit() {
    if (!email.trim() || !code.trim()) return setMessage({ type: "error", text: "请输入邮箱和验证码" });
    if (!newPwd || newPwd.length < 5) return setMessage({ type: "error", text: "新密码至少 5 位" });
    if (newPwd !== confirmPwd) return setMessage({ type: "error", text: "两次输入的密码不一致" });
    setSubmitting(true);
    setMessage(null);
    try {
      await changePwdByEmail(email, code, newPwd);
      notify("密码已修改，请使用新密码重新登录", "success");
      onClose();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "修改失败" });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Sheet
      open={open}
      title="修改密码"
      onClose={onClose}
      headerAction={
        <button className="sheet-header-save" type="submit" form="change-pwd-form" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={15} /> : <LockKeyhole size={15} />}
          {submitting ? "修改中" : "确认修改"}
        </button>
      }
    >
      <form
        id="change-pwd-form"
        className="mobile-form email-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="email-auth-tip top">已绑定邮箱才能通过验证码修改密码，验证码会发到下面的邮箱</p>
        <label>
          <span>邮箱</span>
          <div className="input-shell">
            <Send size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="请输入当前账号的邮箱"
            />
          </div>
        </label>
        <label>
          <span>验证码</span>
          <div className="input-shell email-code-shell">
            <ShieldCheck size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
            />
            <button
              type="button"
              className="email-code-button"
              onClick={requestCode}
              disabled={sending || countdown > 0}
            >
              {sending ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
            </button>
          </div>
        </label>
        <label>
          <span>新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={newPwd}
              onChange={(event) => setNewPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="至少 5 位"
            />
          </div>
        </label>
        <label>
          <span>确认新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={confirmPwd}
              onChange={(event) => setConfirmPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="再输一次"
            />
          </div>
        </label>
        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

/**
 * 编辑个人信息 Sheet：
 * - 可编辑：昵称、手机号、性别
 * - 不可编辑（只读）：登录账号、所属部门、岗位（这些由管理员维护）
 * - 邮箱：单独走 BindEmailSheet 流程（要验证码），不在这里编辑
 * - 调 PUT /identity/users/profile 写入；保存成功后通过 onSaved 回调让父组件刷新 userInfo
 */
export function EditProfileSheet({
  open,
  userInfo,
  username,
  onClose,
  onSaved,
  onBindEmail,
  notify,
}: {
  open: boolean;
  userInfo: DataRow | null;
  username: string;
  onClose: () => void;
  onSaved: () => void;
  onBindEmail: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [nickName, setNickName] = useState("");
  const [phone, setPhone] = useState("");
  const [sex, setSex] = useState("0");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (open) {
      setNickName(String(userInfo?.nickName || ""));
      setPhone(String(userInfo?.phonenumber || ""));
      setSex(String(userInfo?.sex || "0"));
      setMessage(null);
    }
  }, [open, userInfo]);
  const dept = userInfo?.dept;
  const deptName = String(dept?.deptName || "--");
  const roles = Array.isArray(userInfo?.roles) ? userInfo.roles : [];
  const postNames = roles.map((role) => String(role.roleName || role.roleKey || "")).filter(Boolean);
  const lockName = String(userInfo?.userName || username);
  const currentEmail = String(userInfo?.email || "");
  async function submit() {
    if (!nickName.trim()) return setMessage({ type: "error", text: "请输入昵称" });
    if (phone && !/^1[3-9]\d{9}$/.test(phone.trim())) return setMessage({ type: "error", text: "手机号格式不正确" });
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({ nickName, phonenumber: phone, sex });
      notify("个人信息已更新", "success");
      onSaved();
      onClose();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet
      open={open}
      title="编辑个人信息"
      onClose={onClose}
      headerAction={
        <button className="sheet-header-save" type="submit" form="edit-profile-form" disabled={saving}>
          {saving ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
          {saving ? "保存中" : "保存"}
        </button>
      }
    >
      <form
        id="edit-profile-form"
        className="mobile-form edit-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="email-auth-tip top">
          登录账号、所属部门和岗位由系统管理员维护，个人只能修改昵称、手机号、性别。邮箱通过验证码单独绑定/更换。
        </p>

        <label>
          <span>登录账号（不可改）</span>
          <div className="field-readonly"><LockKeyhole size={15} />{lockName}</div>
        </label>
        <label>
          <span>所属部门（不可改）</span>
          <div className="field-readonly"><Building2 size={15} />{deptName}</div>
        </label>
        <label>
          <span>岗位（不可改）</span>
          <div className="field-readonly"><Briefcase size={15} />{postNames.length ? postNames.join(" / ") : "--"}</div>
        </label>

        <label>
          <span>昵称</span>
          <div className="input-shell"><User size={18} /><input value={nickName} onChange={(event) => setNickName(event.target.value)} placeholder="请输入昵称" maxLength={30} /></div>
        </label>
        <label>
          <span>手机号</span>
          <div className="input-shell"><Phone size={18} /><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={11} placeholder="11 位手机号" /></div>
        </label>
        <label>
          <span>邮箱</span>
          <div className="field-readonly"><Send size={15} />{currentEmail || "未绑定"}</div>
          <button type="button" className="field-action" onClick={() => { onBindEmail(); onClose(); }}>
            {currentEmail ? "更换邮箱" : "立即绑定邮箱"}
          </button>
          <p className="field-readonly-hint">绑定后可使用「邮箱登录 / 忘记密码 / 邮箱改密」</p>
        </label>
        <label>
          <span>性别</span>
          <select value={sex} onChange={(event) => setSex(event.target.value)}>
            <option value="0">男</option>
            <option value="1">女</option>
            <option value="2">未填写</option>
          </select>
        </label>

        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

/**
 * 绑定/更换邮箱 Sheet：邮箱 + 验证码（type=bind）
 * 成功后通过 onSaved 回调让父组件刷新 userInfo
 */
export function BindEmailSheet({
  open,
  currentEmail,
  onClose,
  onSaved,
  notify,
}: {
  open: boolean;
  currentEmail: string;
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (open) {
      setEmail(currentEmail || "");
      setCode("");
      setMessage(null);
      setCountdown(0);
    }
  }, [open, currentEmail]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  async function requestCode() {
    const trimmed = email.trim();
    if (!trimmed) return setMessage({ type: "error", text: "请输入邮箱" });
    if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(trimmed)) return setMessage({ type: "error", text: "邮箱格式不正确" });
    if (countdown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailCode(trimmed, "bind");
      setMessage({ type: "info", text: "验证码已发送，请到新邮箱查收" });
      setCountdown(60);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "发送失败" });
    } finally {
      setSending(false);
    }
  }
  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || !code.trim()) return setMessage({ type: "error", text: "请输入邮箱和验证码" });
    if (currentEmail && trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      return setMessage({ type: "error", text: "该邮箱已是当前账号的邮箱" });
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await bindEmail(trimmed, code);
      notify("邮箱已绑定", "success");
      onSaved();
      onClose();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "绑定失败" });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Sheet
      open={open}
      title={currentEmail ? "更换邮箱" : "绑定邮箱"}
      onClose={onClose}
      headerAction={
        <button className="sheet-header-save" type="submit" form="bind-email-form" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
          {submitting ? "提交中" : currentEmail ? "确认更换" : "确认绑定"}
        </button>
      }
    >
      <form
        id="bind-email-form"
        className="mobile-form email-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="email-auth-tip top">
          验证码会发到下面填写的邮箱，填写后请到对应邮箱查收。{COMMON_MAILBOX_HINT}。{currentEmail ? `当前已绑定：${currentEmail}` : "当前未绑定邮箱，绑定后即可使用邮箱登录 / 找回密码 / 邮箱改密。"}
        </p>
        <label>
          <span>新邮箱</span>
          <div className="input-shell">
            <Send size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder={COMMON_MAILBOX_HINT}
            />
          </div>
        </label>
        <label>
          <span>验证码</span>
          <div className="input-shell email-code-shell">
            <ShieldCheck size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
            />
            <button
              type="button"
              className="email-code-button"
              onClick={requestCode}
              disabled={sending || countdown > 0}
            >
              {sending ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
            </button>
          </div>
        </label>
        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
