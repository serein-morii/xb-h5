const BRANDS: Array<[string[], string]> = [
  [["github"], "#24292f"],
  [["gitlab"], "#fc6d26"],
  [["google", "gmail", "youtube"], "#4285f4"],
  [["microsoft", "outlook", "office", "azure", "onedrive"], "#00a4ef"],
  [["apple", "icloud"], "#111111"],
  [["amazon", "aws"], "#ff9900"],
  [["steam"], "#1b2838"],
  [["discord"], "#5865f2"],
  [["telegram"], "#229ed9"],
  [["slack"], "#4a154b"],
  [["notion"], "#111111"],
  [["cloudflare"], "#f38020"],
  [["dropbox"], "#0061ff"],
  [["facebook", "meta"], "#1877f2"],
  [["instagram"], "#e4405f"],
  [["twitter", "x.com"], "#111111"],
  [["linkedin"], "#0a66c2"],
  [["reddit"], "#ff4500"],
  [["twitch"], "#9146ff"],
  [["spotify"], "#1db954"],
  [["netflix"], "#e50914"],
  [["paypal"], "#003087"],
  [["stripe"], "#635bff"],
  [["adobe"], "#ff0000"],
  [["docker"], "#2496ed"],
  [["npm"], "#cb3837"],
  [["openai", "chatgpt"], "#10a37f"],
  [["anthropic", "claude"], "#d97757"],
  [["binance"], "#f0b90b"],
  [["coinbase"], "#0052ff"],
  [["digitalocean"], "#0080ff"],
  [["zoom"], "#0b5cff"],
  [["wechat", "weixin", "微信"], "#07c160"],
  [["alipay", "支付宝"], "#1677ff"],
  [["dingtalk", "钉钉"], "#007fff"],
  [["taobao", "淘宝"], "#ff5000"],
  [["jd", "jingdong", "京东"], "#e1251b"],
  [["bilibili", "哔哩"], "#fb7299"],
  [["baidu", "百度"], "#2932e1"],
  [["tencent", "qq", "腾讯"], "#12b7f5"],
  [["aliyun", "alibaba", "阿里"], "#ff6a00"],
  [["huawei", "华为"], "#cf0a2c"],
  [["xiaomi", "小米"], "#ff6900"],
];

function hostFrom(loginUrl: string) {
  try { return new URL(loginUrl).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function hashColor(text: string) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 38% 36%)`;
}

function letters(issuer: string) {
  const trimmed = issuer.trim();
  if (!trimmed) return "?";
  if (/^[一-鿿]/.test(trimmed)) return trimmed.slice(0, 1);
  const ascii = trimmed.replace(/[^A-Za-z0-9]/g, "");
  return (ascii || trimmed).slice(0, 2).toUpperCase();
}

export function issuerStyle(issuer: string, loginUrl = "") {
  const blob = `${issuer} ${hostFrom(loginUrl)}`.toLowerCase();
  const match = BRANDS.find(([keys]) => keys.some((key) => blob.includes(key)));
  return { letters: letters(issuer), background: match ? match[1] : hashColor(issuer || "vault") };
}
