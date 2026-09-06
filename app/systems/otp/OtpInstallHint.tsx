import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  dismissInstallHint,
  installCoachCopy,
  installCoachKind,
  iosVersionFromUa,
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
  const kind = typeof navigator === "undefined" ? "browser" : installCoachKind();
  const iosVersion = typeof navigator === "undefined" ? null : iosVersionFromUa();
  const copy = installCoachCopy(kind, iosVersion);
  const safariModern = kind === "ios" && (iosVersion ?? 0) >= 26;
  const [open, setOpen] = useState(kind === "wechat");
  const [spotlight, setSpotlight] = useState(false);

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
      : kind === "wechat"
        ? <button type="button" className="otp-install-hint-action" onClick={() => setOpen((value) => !value)}>{open ? "收起" : "怎么添加"}</button>
        : <button type="button" className="otp-install-hint-action" onClick={() => setSpotlight(true)}><Share size={13} />指出分享按钮</button>}
    <button type="button" className="otp-install-hint-close" onClick={close} aria-label="关闭"><X size={14} /></button>
    {open ? <ol className="otp-install-steps">{copy.steps.map((step, index) => <li key={step}><em>{index + 1}</em><span>{step}</span></li>)}</ol> : null}
    {spotlight ? <div className={`otp-install-spotlight is-${kind === "ios" ? safariModern ? "br" : "bc" : "tr"}`} role="dialog" aria-label="指出分享按钮" onClick={() => setSpotlight(false)}>
      <div className="otp-install-spotlight-card" onClick={(event) => event.stopPropagation()}>
        <b>{kind === "ios" ? safariModern ? "点右下角三个点" : "点底栏中间分享" : "点右上角分享"}</b>
        <p>{kind === "ios" ? safariModern ? "iOS 26 及以上：右下角三个点打开分享，再选「添加到桌面」。" : "iOS 26 以下：底栏正中间就是分享，点开后选「添加到主屏幕」。" : "谷歌浏览器在右上角分享里，选「添加到桌面」。"}</p>
        <button type="button" onClick={() => setSpotlight(false)}>知道了</button>
      </div>
      <span className="otp-install-spotlight-arrow" aria-hidden="true" />
    </div> : null}
  </aside>;
}
