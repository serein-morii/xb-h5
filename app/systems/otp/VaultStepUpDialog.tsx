import { KeyRound, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, sendEmailCode } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";
import { setOtpStepUpToken, verifyVaultSecurity } from "./vaultApi";

type Waiter = { resolve: () => void; reject: (reason?: unknown) => void };

export default function VaultStepUpDialog({ email }: { email: string }) {
  const [waiter, setWaiter] = useState<Waiter | null>(null);
  const [mode, setMode] = useState<"email" | "password">("email");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const open = (event: Event) => { setWaiter((event as CustomEvent<Waiter>).detail); setValue(""); setMessage(""); };
    window.addEventListener("otp-step-up-required", open);
    return () => window.removeEventListener("otp-step-up-required", open);
  }, []);
  useEffect(() => { if (!countdown) return; const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [countdown]);
  useEffect(() => {
    if (!waiter) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [waiter]);

  const cancel = () => { waiter?.reject(new Error("已取消安全验证")); setWaiter(null); };
  const send = async () => {
    if (!email) return setMessage("当前账号没有绑定邮箱，请改用登录密码验证");
    setSending(true); setMessage("");
    try { await sendEmailCode(email, "otp-security"); setCountdown(60); setMessage("验证码已发送到绑定邮箱"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "验证码发送失败"); }
    finally { setSending(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!value.trim()) return;
    setBusy(true); setMessage("");
    try {
      let body: { password?: string; emailCode?: string } = { emailCode: value.trim() };
      if (mode === "password") {
        const publicKeyResult = await apiRequest<{ publicKey: string }>(API_PATHS.auth.publicKey, { auth: false });
        const { JSEncrypt } = await import("jsencrypt");
        const encryptor = new JSEncrypt(); encryptor.setPublicKey(publicKeyResult.publicKey);
        const password = encryptor.encrypt(value);
        if (!password) throw new Error("密码加密失败");
        body = { password };
      }
      const result = await verifyVaultSecurity(body);
      setOtpStepUpToken(result.data.token);
      waiter?.resolve(); setWaiter(null); setValue("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "身份验证失败"); }
    finally { setBusy(false); }
  };

  if (!waiter) return null;
  return <div className="vault-modal-mask vault-step-up-mask"><form className="vault-modal small vault-step-up" onSubmit={submit}>
    <header><div><small>SECURITY CHECK</small><h2>确认是你本人</h2><p>敏感操作前需要再次验证身份</p></div><button type="button" onClick={cancel} aria-label="关闭"><X size={18} /></button></header>
    <div className="vault-step-up-icon"><ShieldCheck size={24} /></div>
    <div className="vault-share-mode"><button type="button" className={mode === "email" ? "is-active" : ""} onClick={() => { setMode("email"); setValue(""); setMessage(""); }}><ShieldCheck size={15} /><span><b>邮箱验证码</b><small>{email || "未绑定邮箱"}</small></span></button><button type="button" className={mode === "password" ? "is-active" : ""} onClick={() => { setMode("password"); setValue(""); setMessage(""); }}><KeyRound size={15} /><span><b>登录密码</b><small>使用当前账号密码</small></span></button></div>
    <label><span>{mode === "email" ? "6 位邮箱验证码" : "登录密码"}</span><div className="vault-step-up-input"><input autoFocus type={mode === "password" ? "password" : "text"} inputMode={mode === "email" ? "numeric" : "text"} value={value} onChange={(event) => setValue(mode === "email" ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value)} autoComplete={mode === "password" ? "current-password" : "one-time-code"} />{mode === "email" ? <button type="button" disabled={sending || countdown > 0} onClick={() => void send()}>{sending ? "发送中" : countdown ? `${countdown}s` : "获取验证码"}</button> : null}</div></label>
    {message ? <p className="vault-modal-note">{message}</p> : null}
    <footer><button type="button" className="vault-ghost" onClick={cancel}>取消</button><button className="vault-primary" disabled={busy || !value.trim()}>{busy ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}{busy ? "验证中" : "解锁保险库"}</button></footer>
  </form></div>;
}
