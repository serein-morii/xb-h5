import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  dismissInstallHint,
  installCoachCopy,
  installCoachKind,
  iosVersionFromUa,
  isMobileLikeDevice,
  isStandaloneDisplay,
  readInstallDismissed,
  shouldShowInstallHint,
} from "./otpDailyUse";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

export default function OtpInstallHint() {
  const [visible, setVisible] = useState(() => shouldShowInstallHint({
    standalone: typeof window !== "undefined" && isStandaloneDisplay(),
    dismissed: typeof window !== "undefined" && readInstallDismissed(),
    mobile: typeof navigator === "undefined" ? false : isMobileLikeDevice(),
  }));
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const kind = typeof navigator === "undefined" ? "browser" : installCoachKind();
  const iosVersion = typeof navigator === "undefined" ? null : iosVersionFromUa();
  const copy = installCoachCopy(kind, iosVersion);
  const [open, setOpen] = useState(kind === "ios" || kind === "wechat");

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;
  const close = () => { dismissInstallHint(); setVisible(false); };
  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
    close();
  };
  const nativeInstall = Boolean(installEvent) && kind === "browser";

  return <aside className={`otp-install-hint${open ? " is-open" : ""}`} role="dialog" aria-label="添加到桌面">
    <span className="otp-install-hint-icon"><Smartphone size={18} /></span>
    <div>
      <b>{copy.title}</b>
      <small>{copy.detail}</small>
    </div>
    {nativeInstall
      ? <button type="button" className="otp-install-hint-action" onClick={() => void install()}><Share size={13} />立即安装</button>
      : <button type="button" className="otp-install-hint-action" onClick={() => setOpen((value) => !value)}>{open ? "收起" : "怎么添加"}</button>}
    <button type="button" className="otp-install-hint-close" onClick={close} aria-label="关闭"><X size={14} /></button>
    {open ? <ol className="otp-install-steps">{copy.steps.map((step, index) => <li key={step}><em>{index + 1}</em><span>{step}</span></li>)}</ol> : null}
  </aside>;
}
