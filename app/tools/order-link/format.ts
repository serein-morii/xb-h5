/**
 * 买家专属下单链接的构造 + 复制文案
 */
export function buildOrderLink(shortId: string | number | null | undefined): string {
  const id = String(shortId || "").trim();
  return id ? `${window.location.origin}/tools/order/${encodeURIComponent(id)}` : "";
}

export function formatOrderLinkCopy(purchaserName: string | null | undefined, link: string): string {
  const name = purchaserName || "买家";
  return `${name}的专属下单链接：\n${link}\n\n点击链接即可下单，也可以查询订单进度。`;
}
