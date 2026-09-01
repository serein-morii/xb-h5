import { Check, ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";

const ERROR_TEXT = /失败|错误|不正确|请输入|请先|请使用|请改用|不能|无法|不存在|无效|取消|尚未|未绑定|没有绑定|不一致|过期|失效|拒绝/;

/** OTP 临时反馈统一使用底部浮层，避免提示块挤压页面布局。 */
export default function VaultToastMessage({ message, onDismiss, duration = 3200 }: {
  message: string;
  onDismiss: () => void;
  duration?: number;
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => dismissRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message]);

  if (!message) return null;
  const error = ERROR_TEXT.test(message);
  return <div className={`vault-toast${error ? " is-error" : ""}`} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
    {error ? <ShieldAlert size={15} /> : <Check size={15} />}<span>{message}</span>
  </div>;
}
