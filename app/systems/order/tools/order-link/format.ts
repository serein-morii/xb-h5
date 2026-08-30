/**
 * 买家专属下单链接的构造 + 复制文案
 */
export function buildOrderLink(shortId: string | number | null | undefined): string {
  const id = String(shortId || "").trim();
  return id ? `${window.location.origin}/tools/order/${encodeURIComponent(id)}` : "";
}

export function formatOrderLinkCopy(purchaserName: string | null | undefined, link: string, pwd?: string | null): string {
  const name = purchaserName || "买家";
  let text = `${name}的专属下单链接：\n${link}`;
  if (pwd) text += `\n\n下单码：${pwd}\n（4-6 位数字，微信付款后用此码录单）`;
  text += "\n\n点击链接即可下单，也可以查询订单进度。";
  return text;
}
