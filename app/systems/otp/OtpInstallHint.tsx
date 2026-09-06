import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  dismissInstallHint,
  iosInstallHint,
  isIosDevice,
  isStandaloneDisplay,
  readInstallDismissed,
  shouldShowInstallHint,
} from "./otpDailyUse";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

export default function OtpInstallHint() {
  const [visible, setVisible] = useState(() => shouldShowInstallHint({
    standalone: typeof window !== "undefined" && isStandaloneDisplay(),
    dismissed: typeof window !== "undefined" && readInstallDismissed(),
  }));
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const ios = typeof navigator !== "undefined" && isIosDevice();

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

  return <aside className="otp-install-hint" role="status">
    <span className="otp-install-hint-icon"><Smartphone size={16} /></span>
    <div>
      <b>添加到主屏幕</b>
      <small>{ios ? iosInstallHint : installEvent ? "安装后可像 App 一样直接打开保险库" : "用浏览器菜单把 OTP Vault 加到主屏幕，打开更快"}</small>
    </div>
    {installEvent ? <button type="button" className="otp-install-hint-action" onClick={() => void install()}><Share size={13} />安装</button> : null}
    <button type="button" className="otp-install-hint-close" onClick={close} aria-label="关闭"><X size={14} /></button>
  </aside>;
}
