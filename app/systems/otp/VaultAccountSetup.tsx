import { ArrowLeft, ArrowRight, Check, Copy, KeyRound, LoaderCircle, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, User } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, copyToClipboard, sendEmailCode } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";
import { setVaultPassword, setVaultUsername } from "./vaultApi";
import "./otp-auth.css";
import "./otp-setup.css";

export type VaultSetupResult = {
  username?: string;
  passwordSet?: boolean;
  passwordSkipped?: boolean;
  plainPassword?: string;
};

type PasswordMode = "complex" | "simple" | "custom" | "skip";
type VerifyMode = "password" | "email";

/** 用 crypto 随机取字符，避免 Math.random 的可预测性 */
function randomChars(pool: string, length: number) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => pool[value % pool.length]).join("");
}

function shuffle(value: string) {
  const chars = value.split("");
  const indices = crypto.getRandomValues(new Uint32Array(chars.length));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = indices[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** 16 位强密码：大小写 + 数字 + 符号各至少 1 位（字符池排除易混淆的 0O1lI） */
function generateComplexPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*_-+=";
  return shuffle(
    randomChars(upper, 4) + randomChars(lower, 4) + randomChars(digits, 4) + randomChars(symbols, 4),
  );
}

/** 8 位简单密码：小写字母 + 数字，便于手输和记忆 */
function generateSimplePassword() {
  return shuffle(randomChars("abcdefghijkmnpqrstuvwxyz", 5) + randomChars("23456789", 3));
}

/**
 * 注册后 / 设置页共用的账号补全面板：两步引导设置用户名和登录密码。
 * 密码支持随机复杂、随机简单、自定义或跳过；跳过则只能邮箱验证码登录。
 */
export default function VaultAccountSetup({ initialUsername, onFinish, onCancel, cancellable = false, requireVerify = false, email = "", only }: {
  initialUsername: string;
  onFinish: (result: VaultSetupResult) => void;
  onCancel?: () => void;
  cancellable?: boolean;
  requireVerify?: boolean;
  email?: string;
  only?: "username" | "password";
}) {
  const [step, setStep] = useState<"username" | "password">(only === "password" ? "password" : "username");
  const [username, setUsername] = useState(initialUsername);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("complex");
  const [generated, setGenerated] = useState(() => generateComplexPassword());
  const [customPassword, setCustomPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyMode, setVerifyMode] = useState<VerifyMode>("password");
  const [oldPassword, setOldPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [usernameChanged, setUsernameChanged] = useState(false);

  useEffect(() => {
    apiRequest<{ publicKey?: string; data?: { publicKey?: string } }>(API_PATHS.auth.publicKey, { auth: false })
      .then((result) => setPublicKey(String(result.publicKey || result.data?.publicKey || "")))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const chooseMode = (mode: PasswordMode) => {
    setPasswordMode(mode);
    if (mode === "complex") setGenerated(generateComplexPassword());
    if (mode === "simple") setGenerated(generateSimplePassword());
    setMessage("");
  };

  async function submitUsername(event: FormEvent) {
    event.preventDefault();
    const value = username.trim();
    if (value.length < 2 || value.length > 20) return setMessage("用户名长度必须为 2-20 位");
    setBusy(true); setMessage("");
    try {
      if (value !== initialUsername) {
        await setVaultUsername(value);
        setUsernameChanged(true);
      }
      if (only === "username") return onFinish({ username: value });
      setStep("password");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "用户名设置失败");
    } finally { setBusy(false); }
  }

  async function requestChangeCode() {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return setMessage("当前账号未绑定可用邮箱，请改用原密码验证");
    setEmailSending(true); setMessage("");
    try {
      await sendEmailCode(value, "otp-change");
      setCountdown(60); setMessage("验证码已发送，请在 5 分钟内完成验证");
    } catch (error) { setMessage(error instanceof Error ? error.message : "验证码发送失败"); }
    finally { setEmailSending(false); }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    let plain = "";
    if (passwordMode === "complex" || passwordMode === "simple") plain = generated;
    if (passwordMode === "custom") {
      if (customPassword.length < 5 || customPassword.length > 20) return setMessage("密码长度必须为 5-20 位");
      if (customPassword !== confirmPassword) return setMessage("两次输入的密码不一致");
      plain = customPassword;
    }
    if (!plain) {
      // 跳过：仅注册引导允许；设置页没有跳过项
      return onFinish({ username: usernameChanged ? username.trim() : undefined, passwordSkipped: true });
    }
    if (requireVerify && verifyMode === "password" && !oldPassword) return setMessage("请输入原密码");
    if (requireVerify && verifyMode === "email" && !/^\d{6}$/.test(emailCode.trim())) return setMessage("请输入 6 位邮箱验证码");
    if (!publicKey) return setMessage("安全加密尚未准备完成，请稍后重试");
    setBusy(true); setMessage("");
    try {
      const { JSEncrypt } = await import("jsencrypt");
      const encryptor = new JSEncrypt();
      encryptor.setPublicKey(publicKey);
      const encrypted = encryptor.encrypt(plain);
      if (!encrypted) throw new Error("密码加密失败");
      let encryptedOld: string | undefined;
      if (requireVerify && verifyMode === "password") {
        encryptedOld = encryptor.encrypt(oldPassword) || undefined;
        if (!encryptedOld) throw new Error("原密码加密失败");
      }
      await setVaultPassword(encrypted, {
        setup: !requireVerify,
        oldPassword: encryptedOld,
        emailCode: requireVerify && verifyMode === "email" ? emailCode.trim() : undefined,
      });
      onFinish({ username: usernameChanged ? username.trim() : undefined, passwordSet: true, plainPassword: plain });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "密码设置失败");
    } finally { setBusy(false); }
  }

  return <div className="otp-setup">
    <ol className="otp-setup-steps" aria-label="账号设置进度" hidden={Boolean(only)}>
      <li className={step === "username" ? "is-active" : step === "password" ? "is-done" : ""}><span><User size={13} /></span>用户名</li>
      <li className={step === "password" ? "is-active" : ""}><span><KeyRound size={13} /></span>登录密码</li>
    </ol>

    {step === "username" ? <form className="otp-setup-step" onSubmit={submitUsername}>
      <header><span className="otp-setup-step-icon"><User size={17} /></span><div><b>{only === "username" || requireVerify ? "用户名" : "设置用户名"}</b><small>{only === "username" || requireVerify ? "用于登录和被搜索到" : "不改就用邮箱 @ 前的默认名称"}</small></div></header>
      <label><span>用户名</span><div><User size={16} /><input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={20} autoComplete="username" placeholder="2-20 位用户名" /></div></label>
      <p className="otp-setup-hint">用户名用于账号密码登录和分享时搜索你；随时可以在设置中修改。</p>
      {message ? <p className="otp-setup-message" role="status">{message}</p> : null}
      <div className="otp-setup-actions">
        {cancellable && onCancel ? <button type="button" className="otp-setup-ghost" onClick={onCancel}>取消</button> : null}
        <button className="otp-setup-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}下一步</button>
      </div>
    </form> : null}

    {step === "password" ? <form className="otp-setup-step" onSubmit={submitPassword}>
      <header><span className="otp-setup-step-icon"><KeyRound size={17} /></span><div><b>{requireVerify ? "更新登录密码" : "设置登录密码"}</b><small>{requireVerify ? "选择新密码，并完成身份验证" : "也可以跳过，之后只用邮箱验证码登录"}</small></div></header>
      <div className="otp-setup-options">
        {([["complex", "随机复杂密码", "16 位，大小写 + 数字 + 符号"], ["simple", "随机简单密码", "8 位小写字母 + 数字"], ["custom", "自定义密码", "5-20 位，自己输入"], ...(!requireVerify ? [["skip", "跳过", "之后只能邮箱验证码登录"] as const] : [])] as const).map(([key, title, detail]) => <button type="button" className={passwordMode === key ? "is-selected" : ""} onClick={() => chooseMode(key)} key={key}><span className="otp-setup-option-radio" /><span><b>{title}</b><small>{detail}</small></span>{passwordMode === key ? <Check size={15} /> : null}</button>)}
      </div>

      {passwordMode === "complex" || passwordMode === "simple" ? <div className="otp-setup-generated">
        <label><span>生成的密码</span><div><input readOnly value={generated} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => void copyToClipboard(generated).then((ok) => setMessage(ok ? "密码已复制，请妥善保存" : "复制失败，请手动复制"))} aria-label="复制密码"><Copy size={15} /></button><button type="button" onClick={() => setGenerated(passwordMode === "complex" ? generateComplexPassword() : generateSimplePassword())} aria-label="重新生成"><RefreshCw size={15} /></button></div></label>
        <p className="otp-setup-hint"><ShieldAlert size={13} />请立即复制保存，之后无法再次查看明文。</p>
      </div> : null}

      {passwordMode === "custom" ? <div className="otp-setup-custom">
        <label><span>密码</span><div><KeyRound size={16} /><input type="password" value={customPassword} onChange={(event) => setCustomPassword(event.target.value)} maxLength={20} autoComplete="new-password" placeholder="5-20 位密码" /></div></label>
        <label><span>确认密码</span><div><KeyRound size={16} /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} maxLength={20} autoComplete="new-password" placeholder="再次输入密码" /></div></label>
      </div> : null}

      {passwordMode === "skip" ? <p className="otp-setup-warning"><ShieldAlert size={15} /><span><b>跳过后将无法使用账号密码登录</b><small>下次登录只能通过邮箱验证码；之后想设置密码，可在保险库「设置 → 账号安全」中补设。</small></span></p> : null}

      {requireVerify && passwordMode !== "skip" ? <div className="otp-setup-verify">
        <div className="otp-setup-verify-tabs"><button type="button" className={verifyMode === "password" ? "is-active" : ""} onClick={() => { setVerifyMode("password"); setMessage(""); }}>原密码</button><button type="button" className={verifyMode === "email" ? "is-active" : ""} onClick={() => { setVerifyMode("email"); setMessage(""); }}>邮箱验证码</button></div>
        {verifyMode === "password" ? <label><span>原密码</span><div><KeyRound size={16} /><input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} maxLength={20} autoComplete="current-password" placeholder="当前登录密码" /></div></label> : <label><span>邮箱验证码</span><div className="otp-email-code"><ShieldCheck size={16} /><input inputMode="numeric" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} autoComplete="one-time-code" placeholder={email ? `发送到 ${email}` : "6 位验证码"} /><button type="button" disabled={emailSending || countdown > 0} onClick={() => void requestChangeCode()}>{emailSending ? "发送中" : countdown > 0 ? `${countdown}s` : "获取验证码"}</button></div></label>}
        <p className="otp-setup-hint">注册时跳过密码的账号没有原密码，请用邮箱验证码。</p>
      </div> : null}

      {message ? <p className="otp-setup-message" role="status">{message}</p> : null}
      <div className="otp-setup-actions">
        {only === "password" ? (cancellable && onCancel ? <button type="button" className="otp-setup-ghost" onClick={onCancel}>取消</button> : null) : <button type="button" className="otp-setup-ghost" disabled={busy} onClick={() => { setStep("username"); setMessage(""); }}><ArrowLeft size={16} />上一步</button>}
        <button className={passwordMode === "skip" ? "otp-setup-ghost" : "otp-setup-primary"} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : passwordMode === "skip" ? null : <Sparkles size={16} />}{passwordMode === "skip" ? "跳过并完成" : "完成设置"}</button>
      </div>
    </form> : null}
  </div>;
}

/** 注册成功后的全屏引导页：复用登录页视觉，两步补全用户名与密码 */
export function VaultOnboardingPage({ username, onDone }: { username: string; onDone: (result: VaultSetupResult) => void }) {
  return <main className="otp-auth-page"><div className="otp-auth-app">
    <section className="otp-auth-hero">
      <span className="otp-auth-mark"><ShieldCheck size={25} /></span>
      <div className="otp-auth-brand"><small>WELCOME</small><h1>注册成功</h1><p>先花 20 秒完善你的账号</p></div>
      <div className="otp-auth-signal"><ShieldCheck size={14} />已自动登录 · 独立登录状态</div>
    </section>
    <section className="otp-auth-card">
      <span className="otp-auth-handle" aria-hidden="true" />
      <div className="otp-auth-copy"><h2>完善账号信息</h2><p>设置用户名和登录密码，让下次登录更方便。</p></div>
      <VaultAccountSetup initialUsername={username} onFinish={onDone} />
    </section>
  </div></main>;
}
