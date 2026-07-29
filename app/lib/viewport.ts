/**
 * 锁定移动端页面缩放。
 *
 * 部分 iOS Safari 版本会忽略 viewport 的 user-scalable=no，
 * 因此同时拦截 Safari gesture 事件和多指 touchmove。
 */
export function installViewportZoomLock(): () => void {
  if (typeof document === "undefined") return () => undefined;

  const preventGesture = (event: Event) => {
    event.preventDefault();
  };
  const preventMultiTouch = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };
  const listenerOptions: AddEventListenerOptions = { passive: false };

  document.addEventListener("gesturestart", preventGesture, listenerOptions);
  document.addEventListener("gesturechange", preventGesture, listenerOptions);
  document.addEventListener("gestureend", preventGesture, listenerOptions);
  document.addEventListener("touchmove", preventMultiTouch, listenerOptions);

  return () => {
    document.removeEventListener("gesturestart", preventGesture);
    document.removeEventListener("gesturechange", preventGesture);
    document.removeEventListener("gestureend", preventGesture);
    document.removeEventListener("touchmove", preventMultiTouch);
  };
}
