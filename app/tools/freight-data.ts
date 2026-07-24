export type FreightRow = {
  name: string;
  spec: string;
  address: string;
  company: string;
};

export type FreightCompany = "京东" | "顺丰" | "邮政";

export const KNOWN_PROVINCES = [
  "湖南", "广东", "江苏", "上海", "浙江", "湖北", "江西", "北京", "河北", "四川", "新疆", "西藏", "天津", "山东", "山西", "河南", "安徽", "福建", "重庆", "贵州", "广西", "云南", "黑龙江", "吉林", "辽宁", "内蒙古", "宁夏", "青海", "海南", "陕西", "甘肃",
];

/**
 * 2026 黄桃寄递运费（始发株洲）。
 * 档位：small = 3KG 以内，large = 6KG（顺丰/京东）/ 6.5KG（邮政）以内。
 * 顺丰有续重单价（超过 6KG 后每 KG）；京东/邮政表里未给续重，超过按线性外推。
 *
 * spec 文本映射：
 *   5斤 ≈ 2.5KG -> small 档
 *   10斤 ≈ 5KG  -> large 档（顺丰 5KG 仍在 3.1-6KG 档内）
 */
type Tier = { small: number; large: number; renew?: number };

const TIER_SPEC_MAP: Record<string, "small" | "large"> = {
  "5斤": "small", "小果": "small", "小": "small", "3kg": "small", "3KG": "small",
  "10斤": "large", "大果": "large", "大": "large", "6kg": "large", "6KG": "large",
};

function tierFor(company: FreightCompany, province: string): Tier | undefined {
  switch (company) {
    case "京东": {
      const map: Record<string, Tier> = {
        湖南: { small: 9, large: 12 }, 广东: { small: 13, large: 19 },
        上海: { small: 16, large: 22 }, 江苏: { small: 16, large: 22 }, 浙江: { small: 16, large: 22 },
        湖北: { small: 16, large: 22 }, 江西: { small: 16, large: 22 },
        新疆: { small: 35, large: 53 }, 西藏: { small: 35, large: 53 },
      };
      return map[province] || { small: 23, large: 32 };
    }
    case "顺丰": {
      const map: Record<string, Tier> = {
        湖南: { small: 10, large: 13, renew: 2 }, 广东: { small: 14, large: 21, renew: 4 },
        上海: { small: 18, large: 25, renew: 4 }, 江苏: { small: 18, large: 25, renew: 4 },
        浙江: { small: 18, large: 25, renew: 4 }, 湖北: { small: 18, large: 25, renew: 4 },
        江西: { small: 18, large: 25, renew: 4 },
        新疆: { small: 34, large: 48, renew: 6 }, 西藏: { small: 34, large: 48, renew: 6 },
      };
      return map[province] || { small: 24, large: 35, renew: 6 };
    }
    case "邮政": {
      const map: Record<string, Tier> = {
        湖南: { small: 7, large: 9 }, 广东: { small: 10, large: 14 },
      };
      // 邮政表里列出的其他省市统一 13/20；新疆/西藏/东北未列出
      const listed = ["福建", "江苏", "浙江", "安徽", "上海", "湖北", "江西", "北京", "天津", "云南", "重庆", "广西", "四川", "河南", "贵州", "山东", "河北", "陕西", "山西", "海南"];
      if (map[province]) return map[province];
      if (listed.includes(province)) return { small: 13, large: 20 };
      return undefined; // 新疆/西藏/东北等未列出
    }
  }
}

export function extractProvince(address: string) {
  const special: Record<string, string> = {
    广西壮族自治区: "广西", 新疆维吾尔自治区: "新疆", 西藏自治区: "西藏", 内蒙古自治区: "内蒙古", 宁夏回族自治区: "宁夏", 香港特别行政区: "香港", 澳门特别行政区: "澳门",
  };
  for (const [fullName, shortName] of Object.entries(special)) if (address.includes(fullName)) return shortName;
  for (const province of KNOWN_PROVINCES) if (address.includes(province)) return province;
  const guessed = address.match(/(.{2,3})省|(.{2,3})市/);
  return guessed ? (guessed[1] || guessed[2]) : "未知";
}

export function parsePastedRows(text: string): FreightRow[] {
  const value = text.trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as { rows?: Array<Record<string, unknown>> };
    if (Array.isArray(parsed.rows)) return parsed.rows.map((row) => ({
      name: String(row.customer || "").trim(), spec: String(row.orderTypeDesc || "").trim(), address: String(row.address || "").trim(), company: String(row.expComDesc || "京东").trim() || "京东",
    }));
  } catch { /* continue with tab-separated text */ }

  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split("\t").map((item) => item.trim());
  const hasHeader = headers.includes("商品规格") && headers.includes("地址");
  const index = Object.fromEntries(headers.map((name, position) => [name, position]));
  return lines.flatMap((line, lineIndex) => {
    if (lineIndex === 0 && hasHeader) return [];
    const cols = line.split("\t");
    const spec = (hasHeader ? cols[index["商品规格"]] : cols[0])?.trim() || "";
    const name = (hasHeader ? cols[index["收件人"]] : cols[1])?.trim() || "";
    const address = (hasHeader ? cols[index["地址"]] : cols[3])?.trim() || "";
    const company = (hasHeader ? cols[index["快递公司"]] : cols[4])?.trim() || "京东";
    return spec && address ? [{ name, spec, address, company }] : [];
  });
}

/**
 * 按快递公司 + 省份 + 规格（5斤/10斤等文本）算运费。
 * 顺丰支持续重（超过 6KG），但目前 spec 只映射到 small/large 两档，续重暂不触发。
 */
export function priceFor(company: string, province: string, spec: string) {
  const tier = tierFor(company as FreightCompany, province);
  if (!tier) return undefined;
  const which = TIER_SPEC_MAP[spec.trim()];
  if (which === "small") return tier.small;
  if (which === "large") return tier.large;
  // 兜底：spec 没匹配上，默认按 small 档（最常见 5斤）
  return tier.small;
}

