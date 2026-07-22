export type FreightRow = {
  name: string;
  spec: string;
  address: string;
  company: string;
};

export type FreightCompany = "京东" | "顺丰" | "邮政";
type Rate = Record<string, Record<string, number>>;

export const KNOWN_PROVINCES = [
  "湖南", "广东", "江苏", "上海", "浙江", "湖北", "江西", "北京", "河北", "四川", "新疆", "西藏", "天津", "山东", "山西", "河南", "安徽", "福建", "重庆", "贵州", "广西", "云南", "黑龙江", "吉林", "辽宁", "内蒙古", "宁夏", "青海", "海南", "陕西", "甘肃",
];

function makeRates(defaultRate: [number, number] | null, overrides: Record<string, [number, number]>): Rate {
  const result: Rate = {};
  KNOWN_PROVINCES.forEach((province) => {
    const rate = overrides[province] || defaultRate;
    if (rate) result[province] = { "5斤": rate[0], "10斤": rate[1] };
  });
  return result;
}

export const PRICE_TABLE: Record<FreightCompany, Rate> = {
  京东: makeRates([24, 33], {
    湖南: [9, 12], 广东: [13, 19], 上海: [15, 21], 江苏: [15, 21], 浙江: [15, 21], 湖北: [15, 21], 江西: [15, 21], 北京: [15, 21], 新疆: [35, 53], 西藏: [35, 53],
  }),
  顺丰: makeRates([24, 35], {
    湖南: [10, 13], 广东: [14, 21], 上海: [18, 25], 江苏: [18, 25], 浙江: [18, 25], 湖北: [18, 25], 江西: [18, 25], 新疆: [34, 48], 西藏: [34, 48],
  }),
  邮政: makeRates(null, {
    湖南: [7, 9], 广东: [10, 14], 天津: [13, 20], 河北: [13, 20], 山东: [13, 20], 山西: [13, 20], 河南: [13, 20], 安徽: [13, 20], 福建: [13, 20], 江西: [13, 20], 湖北: [13, 20], 上海: [13, 20], 江苏: [13, 20], 浙江: [13, 20], 北京: [13, 20], 四川: [13, 20], 重庆: [13, 20], 贵州: [13, 20], 广西: [13, 20], 云南: [13, 20], 黑龙江: [13, 20], 吉林: [13, 20], 辽宁: [13, 20], 内蒙古: [13, 20], 宁夏: [13, 20], 青海: [13, 20], 海南: [13, 20], 陕西: [13, 20], 甘肃: [13, 20],
  }),
};

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

export function priceFor(company: string, province: string, spec: string) {
  return PRICE_TABLE[company as FreightCompany]?.[province]?.[spec];
}
