import { Fingerprint, LoaderCircle, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";
import { createPasskey, getPasskey } from "../../lib/passkey";
import {
  finishVaultPasskeyRegistration, getVaultPasskeyRegistrationOptions, getVaultStepUpPasskeyOptions,
  listVaultPasskeys, saveVaultScreenLock, unlockVaultScreenLock, type VaultPrefs,
} from "./vaultApi";
import VaultToastMessage from "./VaultToastMessage";

type LockType = "pin4" | "pin6" | "complex";

type Props = {
  prefs: VaultPrefs;
  locked: boolean;
  setupOpen: boolean;
  onUnlocked: () => void;
  onSetupClose: () => void;
  onSetupDone: () => void;
  onSaved: (patch: Partial<VaultPrefs>) => Promise<void>;
};

const HINT = "以后可在「我的 → 安全中心」修改锁屏密码、Passkey 和自动锁屏。";

export default function VaultScreenLock({ prefs, locked, setupOpen, onUnlocked, onSetupClose, onSetupDone, onSaved }: Props) {
  if (setupOpen) return <SetupForm prefs={prefs} onClose={onSetupClose} onDone={onSetupDone} onSaved={onSaved} />;
  if (locked) return <UnlockForm prefs={prefs} onUnlocked={onUnlocked} />;
  return null;
}

function SetupForm({ prefs, onClose, onDone, onSaved }: { prefs: VaultPrefs; onClose: () => void; onDone: () => void; onSaved: (patch: Partial<VaultPrefs>) => Promise<void> }) {
  const changing = Boolean(prefs.screenLockSet);
  const [type, setType] = useState<LockType>(prefs.screenLockType === "pin4" || prefs.screenLockType === "complex" ? prefs.screenLockType : "pin6");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(changing);
  const [passkeyReady, setPasskeyReady] = useState(false);

  useEffect(() => {
    listVaultPasskeys().then((result) => setPasskeyReady((result.data || []).length > 0)).catch(() => setPasskeyReady(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const error = validateLockPassword(type, password, confirm);
    if (error) return setMessage(error);
    if (changing && !currentPassword) return setMessage("请输入当前锁屏密码");
    setBusy("save"); setMessage("");
    try {
      const encrypted = await encryptSecret(password);
      const current = changing ? await encryptSecret(currentPassword) : undefined;
      const result = await saveVaultScreenLock({ password: encrypted, type, currentPassword: current });
      await onSaved({
        screenLockSet: true,
        screenLockType: result.data.screenLockType || type,
        screenLockPasskeyEnabled: result.data.screenLockPasskeyEnabled,
        autoScreenLockMinutes: result.data.autoScreenLockMinutes,
      });
      setSaved(true);
      setMessage(changing ? "锁屏密码已更新" : "锁屏密码已保存，可继续添加 Passkey，或直接完成并锁定");
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(""); }
  };

  const enablePasskey = async () => {
    setBusy("passkey"); setMessage("");
    try {
      if (!passkeyReady) {
        const options = await getVaultPasskeyRegistrationOptions();
        await finishVaultPasskeyRegistration(options.data.requestId, await createPasskey(options.data.publicKey), devicePasskeyName());
        setPasskeyReady(true);
      }
      await onSaved({ screenLockPasskeyEnabled: true });
      setMessage("已开启 Passkey 解锁。锁屏密码仍可在 Passkey 不可用时打开保险库。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Passkey 设置失败"); }
    finally { setBusy(""); }
  };

  return <div className="vault-modal-mask vault-screen-lock-mask"><form className="vault-modal small vault-screen-lock" onSubmit={submit}>
    <header><div><small>APP LOCK</small><h2>{changing ? "修改锁屏密码" : "设置锁屏密码"}</h2><p>{changing ? "先验证当前密码，再设置新的数字或复杂密码。" : "先设数字或复杂密码，保存后才能添加 Passkey。"}</p></div><button type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header>
    <div className="vault-screen-lock-types">{([["pin6", "6 位数字"], ["pin4", "4 位数字"], ["complex", "复杂密码"]] as const).map(([value, label]) =>
      <button type="button" className={type === value ? "is-active" : ""} key={value} onClick={() => { setType(value); setPassword(""); setConfirm(""); setMessage(""); }}>{label}</button>)}</div>
    {changing ? <LockPasswordField label="当前锁屏密码" lockType="complex" value={currentPassword} onChange={setCurrentPassword} placeholder="输入当前锁屏密码" /> : null}
    <LockPasswordField autoFocus label={type === "complex" ? "新复杂密码" : `${type === "pin4" ? "4" : "6"} 位数字`} lockType={type} value={password} onChange={setPassword} placeholder={type === "complex" ? "8-20 位，字母加数字" : type === "pin4" ? "4 位数字" : "6 位数字"} />
    <LockPasswordField label="再输入一次" lockType={type} value={confirm} onChange={setConfirm} placeholder={type === "complex" ? "再次输入复杂密码" : "再次输入"} />
    {saved ? <div className="vault-screen-lock-passkey"><Fingerprint size={18} /><span><b>Passkey 解锁</b><small>Passkey 不可用时，仍可用锁屏密码打开。</small></span><button type="button" disabled={busy !== ""} onClick={() => void enablePasskey()}>{busy === "passkey" ? "等待设备" : prefs.screenLockPasskeyEnabled ? "已开启" : "开启"}</button></div> : <p className="vault-screen-lock-hint">以后可在「我的 → 安全中心」修改锁屏方式和自动锁屏。</p>}
    <VaultToastMessage message={message} onDismiss={() => setMessage("")} />
    <footer><button type="button" className="vault-ghost" onClick={onClose}>取消</button>{saved ? <button type="button" className="vault-primary" onClick={changing ? onClose : onDone}><LockKeyhole size={15} />{changing ? "完成" : "完成并锁定"}</button> : <button className="vault-primary" disabled={busy !== ""}>{busy === "save" ? <LoaderCircle className="spin" size={15} /> : <LockKeyhole size={15} />}{busy === "save" ? "保存中" : "保存密码"}</button>}</footer>
  </form></div>;
}

function UnlockForm({ prefs, onUnlocked }: { prefs: VaultPrefs; onUnlocked: () => void }) {
  const type = (prefs.screenLockType === "pin4" || prefs.screenLockType === "complex" ? prefs.screenLockType : "pin6") as LockType;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const passkeyEnabled = Boolean(prefs.screenLockPasskeyEnabled);
  const [usePassword, setUsePassword] = useState(!passkeyEnabled);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!usePassword) {
      setKeyboardInset(0);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      setKeyboardInset(inset > 80 ? inset : 0);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("focusin", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("focusin", sync);
    };
  }, [usePassword]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!usePassword) {
      void unlockPasskey();
      return;
    }
    if (!password) return setMessage(type === "complex" ? "请输入锁屏密码" : "请输入锁屏数字");
    setBusy("password"); setMessage("");
    try {
      await unlockVaultScreenLock({ password: await encryptSecret(password) });
      onUnlocked();
    } catch (error) { setMessage(error instanceof Error ? error.message : "解锁失败"); }
    finally { setBusy(""); }
  };

  const unlockPasskey = async () => {
    setBusy("passkey"); setMessage("");
    try {
      const options = await getVaultStepUpPasskeyOptions();
      await unlockVaultScreenLock({ requestId: options.data.requestId, credential: await getPasskey(options.data.publicKey) });
      onUnlocked();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Passkey 解锁失败"); }
    finally { setBusy(""); }
  };

  return <div className={`vault-modal-mask vault-screen-lock-mask is-locked${keyboardInset ? " is-keyboard" : ""}`} style={keyboardInset ? { paddingBottom: keyboardInset } : undefined}><form className="vault-screen-lock vault-screen-lock-gate" onSubmit={submit}>
    <div className="vault-screen-lock-hero">
      <span className="vault-screen-lock-emblem" aria-hidden="true"><LockKeyhole size={28} /></span>
      <small>OTP VAULT</small>
      <h2>保险库已锁定</h2>
      <p>{usePassword ? "输入锁屏密码继续" : "用 Passkey 解锁，也可改用锁定密码"}</p>
    </div>
    {usePassword ? <LockPasswordField autoFocus label={type === "complex" ? "复杂密码" : `${type === "pin4" ? "4" : "6"} 位数字`} lockType={type} value={password} onChange={setPassword} placeholder={type === "complex" ? "输入复杂密码" : "输入锁屏数字"} /> : <button type="button" className="vault-primary vault-screen-lock-passkey-btn" disabled={busy !== ""} onClick={() => void unlockPasskey()}>{busy === "passkey" ? <LoaderCircle className="spin" size={16} /> : <Fingerprint size={16} />}{busy === "passkey" ? "等待设备" : "使用 Passkey 解锁"}</button>}
    {passkeyEnabled && !usePassword ? <button type="button" className="vault-screen-lock-password-link" onClick={() => { setUsePassword(true); setMessage(""); }}>用锁定密码解锁</button> : null}
    {passkeyEnabled && usePassword ? <button type="button" className="vault-screen-lock-password-link" onClick={() => { setUsePassword(false); setPassword(""); setMessage(""); }}>使用 Passkey 解锁</button> : null}
    <VaultToastMessage message={message} onDismiss={() => setMessage("")} />
    {usePassword ? <button className="vault-primary vault-screen-lock-unlock-btn" disabled={busy !== ""}>{busy === "password" ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}{busy === "password" ? "解锁中" : "解锁"}</button> : null}
  </form></div>;
}

function LockPasswordField({ label, lockType, value, onChange, autoFocus, placeholder }: {
  label: string;
  lockType: LockType;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pinLen = lockType === "pin4" ? 4 : lockType === "pin6" ? 6 : 0;
  if (pinLen) {
    return (
      <label className="vault-screen-lock-pin">
        <div className="vault-screen-lock-pins" data-count={pinLen} onClick={() => inputRef.current?.focus()}>
          {Array.from({ length: pinLen }, (_, index) => (
            <i key={index} className={index < value.length ? "is-filled" : index === value.length ? "is-current" : ""} />
          ))}
          <input
            ref={inputRef}
            autoFocus={autoFocus}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={value}
            maxLength={pinLen}
            aria-label={label}
            placeholder={placeholder}
            onChange={(event) => onChange(sanitizeLockInput(lockType, event.target.value))}
          />
        </div>
        <span className="vault-screen-lock-pin-caption">{label}</span>
      </label>
    );
  }
  return (
    <label className="vault-screen-lock-complex">
      <span>{label}</span>
      <div className="vault-screen-lock-field is-complex">
        <em><LockKeyhole size={15} /></em>
        <input
          autoFocus={autoFocus}
          type="password"
          inputMode="text"
          value={value}
          onChange={(event) => onChange(sanitizeLockInput(lockType, event.target.value))}
          autoComplete="off"
          placeholder={placeholder}
        />
        {value ? <small>{value.length}/20</small> : null}
      </div>
    </label>
  );
}

export function validateLockPassword(type: LockType, password: string, confirm: string) {
  if (password !== confirm) return "两次输入不一致";
  if (type === "pin4") return /^\d{4}$/.test(password) ? "" : "请输入 4 位数字";
  if (type === "pin6") return /^\d{6}$/.test(password) ? "" : "请输入 6 位数字";
  if (password.length < 8 || password.length > 20) return "复杂密码为 8-20 位";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "复杂密码需同时包含字母和数字";
  return "";
}

function sanitizeLockInput(type: LockType, value: string) {
  if (type === "pin4") return value.replace(/\D/g, "").slice(0, 4);
  if (type === "pin6") return value.replace(/\D/g, "").slice(0, 6);
  return value.slice(0, 20);
}

async function encryptSecret(value: string) {
  const publicKeyResult = await apiRequest<{ publicKey: string }>(API_PATHS.auth.publicKey, { auth: false });
  const { JSEncrypt } = await import("jsencrypt");
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(publicKeyResult.publicKey);
  const encrypted = encryptor.encrypt(value);
  if (!encrypted) throw new Error("密码加密失败");
  return encrypted;
}

function devicePasskeyName() {
  const platform = navigator.userAgent.includes("iPhone") ? "iPhone" : navigator.userAgent.includes("Android") ? "Android" : navigator.userAgent.includes("Mac") ? "Mac" : navigator.userAgent.includes("Windows") ? "Windows" : "此设备";
  return `${platform} Passkey`;
}
