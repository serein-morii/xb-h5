export type FreightRow = {
  orderNo?: string;
  store?: string;
  name: string;
  spec: string;
  address: string;
  company: string;
};

export type FreightCompany = "京东" | "顺丰" | "邮政";

export const KNOWN_PROVINCES = [
  "湖南", "广东", "江苏", "上海", "浙江", "湖北", "江西", "北京", "河北", "四川", "新疆", "西藏", "天津", "山东", "山西", "河南", "安徽", "福建", "重庆", "贵州", "广西", "云南", "黑龙江", "吉林", "辽宁", "内蒙古", "宁夏", "青海", "海南", "陕西", "甘肃",
];

const CITY_GROUPS: Record<string, string> = {
  湖南: "长沙,株洲,湘潭,衡阳,邵阳,岳阳,常德,张家界,益阳,郴州,永州,怀化,娄底,湘西土家族苗族自治州,湘西自治州,湘西州",
  广东: "广州,韶关,深圳,珠海,汕头,佛山,江门,湛江,茂名,肇庆,惠州,梅州,汕尾,河源,阳江,清远,东莞,中山,潮州,揭阳,云浮",
  江苏: "南京,无锡,徐州,常州,苏州,南通,连云港,淮安,盐城,扬州,镇江,泰州,宿迁",
  浙江: "杭州,宁波,温州,嘉兴,湖州,绍兴,金华,衢州,舟山,台州,丽水",
  湖北: "武汉,黄石,十堰,宜昌,襄阳,鄂州,荆门,孝感,荆州,黄冈,咸宁,随州,恩施土家族苗族自治州,恩施州,仙桃,潜江,天门",
  江西: "南昌,景德镇,萍乡,九江,新余,鹰潭,赣州,吉安,宜春,抚州,上饶",
  河北: "石家庄,唐山,秦皇岛,邯郸,邢台,保定,张家口,承德,沧州,廊坊,衡水",
  四川: "成都,自贡,攀枝花,泸州,德阳,绵阳,广元,遂宁,内江,乐山,南充,眉山,宜宾,广安,达州,雅安,巴中,资阳,阿坝藏族羌族自治州,阿坝州,甘孜藏族自治州,甘孜州,凉山彝族自治州,凉山州",
  新疆: "乌鲁木齐,克拉玛依,吐鲁番,哈密,昌吉回族自治州,昌吉州,博尔塔拉蒙古自治州,博州,巴音郭楞蒙古自治州,巴州,阿克苏地区,克孜勒苏柯尔克孜自治州,克州,喀什地区,和田地区,伊犁哈萨克自治州,伊犁州,塔城地区,阿勒泰地区,石河子,阿拉尔,图木舒克,五家渠,北屯,铁门关,双河,可克达拉,昆玉,胡杨河,新星,白杨",
  西藏: "拉萨,日喀则,昌都,林芝,山南,那曲,阿里地区",
  山东: "济南,青岛,淄博,枣庄,东营,烟台,潍坊,济宁,泰安,威海,日照,临沂,德州,聊城,滨州,菏泽",
  山西: "太原,大同,阳泉,长治,晋城,朔州,晋中,运城,忻州,临汾,吕梁",
  河南: "郑州,开封,洛阳,平顶山,安阳,鹤壁,新乡,焦作,濮阳,许昌,漯河,三门峡,南阳,商丘,信阳,周口,驻马店,济源",
  安徽: "合肥,芜湖,蚌埠,淮南,马鞍山,淮北,铜陵,安庆,黄山,滁州,阜阳,宿州,六安,亳州,池州,宣城",
  福建: "福州,厦门,莆田,三明,泉州,漳州,南平,龙岩,宁德",
  贵州: "贵阳,六盘水,遵义,安顺,毕节,铜仁,黔西南布依族苗族自治州,黔西南州,黔东南苗族侗族自治州,黔东南州,黔南布依族苗族自治州,黔南州",
  广西: "南宁,柳州,桂林,梧州,北海,防城港,钦州,贵港,玉林,百色,贺州,河池,来宾,崇左",
  云南: "昆明,曲靖,玉溪,保山,昭通,丽江,普洱,临沧,楚雄彝族自治州,楚雄州,红河哈尼族彝族自治州,红河州,文山壮族苗族自治州,文山州,西双版纳傣族自治州,西双版纳州,大理白族自治州,大理州,德宏傣族景颇族自治州,德宏州,怒江傈僳族自治州,怒江州,迪庆藏族自治州,迪庆州",
  黑龙江: "哈尔滨,齐齐哈尔,鸡西,鹤岗,双鸭山,大庆,伊春,佳木斯,七台河,牡丹江,黑河,绥化,大兴安岭地区",
  吉林: "长春,吉林,四平,辽源,通化,白山,松原,白城,延边朝鲜族自治州,延边州",
  辽宁: "沈阳,大连,鞍山,抚顺,本溪,丹东,锦州,营口,阜新,辽阳,盘锦,铁岭,朝阳,葫芦岛",
  内蒙古: "呼和浩特,包头,乌海,赤峰,通辽,鄂尔多斯,呼伦贝尔,巴彦淖尔,乌兰察布,兴安盟,锡林郭勒盟,阿拉善盟",
  宁夏: "银川,石嘴山,吴忠,固原,中卫",
  青海: "西宁,海东,海北藏族自治州,海北州,黄南藏族自治州,黄南州,海南藏族自治州,海南州,果洛藏族自治州,果洛州,玉树藏族自治州,玉树州,海西蒙古族藏族自治州,海西州",
  海南: "海口,三亚,三沙,儋州,五指山,琼海,文昌,万宁,东方",
  陕西: "西安,铜川,宝鸡,咸阳,渭南,延安,汉中,榆林,安康,商洛",
  甘肃: "兰州,嘉峪关,金昌,白银,天水,武威,张掖,平凉,酒泉,庆阳,定西,陇南,临夏回族自治州,临夏州,甘南藏族自治州,甘南州",
};

const CITY_TO_PROVINCE = Object.entries(CITY_GROUPS).flatMap(([province, cities]) =>
  cities.split(",").map((city) => ({ city, province })),
);

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
  "5斤": "small", "小果": "small", "小": "small", "3": "small", "3kg": "small", "3KG": "small",
  "10斤": "large", "大果": "large", "大": "large", "6": "large", "6kg": "large", "6KG": "large",
};

const HEADER_ALIASES = {
  orderNo: ["订单号", "订单编号", "订单ID", "单号", "商家订单号", "客户订单号", "外部订单号", "orderNo", "orderCode"],
  store: ["发货门店", "发货店铺", "门店", "店铺", "发货仓库", "仓库"],
  name: ["收件人", "收货人", "收件人姓名", "收货人姓名", "收件姓名", "收货姓名", "customer"],
  weightSpec: [
    "商品规格", "规格", "货物规格", "产品规格", "规格型号", "商品型号", "包装规格",
    "商品重量(kg)", "商品重量", "重量(kg)", "实际重量", "计费重量", "重量KG",
    "orderTypeDesc",
  ],
  address: ["收件详细地址", "收货详细地址", "收件人地址", "收货人地址", "收件地址", "收货地址", "详细地址", "地址", "address"],
  company: ["快递公司", "快递", "快递名称", "快递方式", "物流公司", "物流方式", "承运商", "配送方式", "expComDesc"],
} as const;

/** 清理 Excel 常见的空格、换行、全角括号、必填标记和英文大小写差异。 */
export function normalizeFreightHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\(必填\)/g, "")
    .replace(/[＊*]/g, "")
    .toLowerCase();
}

function findRecordValue(row: Record<string, unknown>, aliases: readonly string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const normalizedAlias = normalizeFreightHeader(alias);
    const entry = entries.find(([header]) => normalizeFreightHeader(header) === normalizedAlias);
    if (entry && String(entry[1] ?? "").trim()) return String(entry[1]).trim();
  }
  return "";
}

function normalizeWeightSpec(value: string) {
  if (!value) return "";
  // “商品重量(kg)”的纯数字值明确按公斤解释，避免将 5kg 错当成原来的 5斤。
  return /^\d+(?:\.\d+)?$/.test(value) ? `${value}kg` : value;
}

export function freightRowFromRecord(row: Record<string, unknown>): FreightRow | undefined {
  const spec = normalizeWeightSpec(findRecordValue(row, HEADER_ALIASES.weightSpec));
  const address = findRecordValue(row, HEADER_ALIASES.address);
  if (!spec || !address) return undefined;
  return {
    orderNo: findRecordValue(row, HEADER_ALIASES.orderNo) || undefined,
    store: findRecordValue(row, HEADER_ALIASES.store) || undefined,
    name: findRecordValue(row, HEADER_ALIASES.name),
    spec,
    address,
    company: findRecordValue(row, HEADER_ALIASES.company),
  };
}

function hasAliasedHeader(headers: string[], aliases: readonly string[]) {
  const normalizedHeaders = new Set(headers.map(normalizeFreightHeader));
  return aliases.some((alias) => normalizedHeaders.has(normalizeFreightHeader(alias)));
}

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
  const normalizedAddress = address.replace(/\s+/g, "");
  const special: Record<string, string> = {
    广西壮族自治区: "广西", 新疆维吾尔自治区: "新疆", 西藏自治区: "西藏", 内蒙古自治区: "内蒙古", 宁夏回族自治区: "宁夏", 香港特别行政区: "香港", 澳门特别行政区: "澳门",
  };
  for (const [fullName, shortName] of Object.entries(special)) if (normalizedAddress.includes(fullName)) return shortName;
  for (const province of KNOWN_PROVINCES) if (normalizedAddress.includes(province)) return province;
  for (const { city, province } of CITY_TO_PROVINCE) {
    const hasAdministrativeSuffix = /(?:市|州|盟|地区)$/.test(city);
    if (normalizedAddress.includes(hasAdministrativeSuffix ? city : `${city}市`)) return province;
  }
  const guessed = normalizedAddress.match(/(.{2,3})省|(.{2,3})市/);
  return guessed ? (guessed[1] || guessed[2]) : "未知";
}

export function parsePastedRows(text: string): FreightRow[] {
  const value = text.trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as { rows?: Array<Record<string, unknown>> };
    if (Array.isArray(parsed.rows)) return parsed.rows.flatMap((row) => {
      const parsedRow = freightRowFromRecord(row);
      return parsedRow ? [parsedRow] : [];
    });
  } catch { /* continue with tab-separated text */ }

  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split("\t").map((item) => item.trim());
  const hasHeader =
    hasAliasedHeader(headers, HEADER_ALIASES.weightSpec)
    && hasAliasedHeader(headers, HEADER_ALIASES.address);
  return lines.flatMap((line, lineIndex) => {
    if (lineIndex === 0 && hasHeader) return [];
    const cols = line.split("\t");
    if (hasHeader) {
      const record = Object.fromEntries(headers.map((header, position) => [header, cols[position] ?? ""]));
      const parsedRow = freightRowFromRecord(record);
      return parsedRow ? [parsedRow] : [];
    }
    const spec = cols[0]?.trim() || "";
    const address = cols[3]?.trim() || "";
    return spec && address ? [{
      name: cols[1]?.trim() || "",
      spec,
      address,
      company: cols[4]?.trim() || "",
    }] : [];
  });
}

/**
 * 按快递公司 + 省份 + 规格（5斤/10斤等文本）算运费。
 * 顺丰支持续重（超过 6KG），但目前 spec 只映射到 small/large 两档，续重暂不触发。
 */
export function priceFor(company: string, province: string, spec: string) {
  const tier = tierFor(company as FreightCompany, province);
  if (!tier) return undefined;
  const normalizedSpec = spec.trim();
  let which = TIER_SPEC_MAP[normalizedSpec];
  if (!which) {
    const weightMatch = normalizedSpec.match(/(\d+(?:\.\d+)?)\s*(kg|公斤|斤)/i);
    if (weightMatch) {
      const value = Number(weightMatch[1]);
      const kilograms = weightMatch[2] === "斤" ? value / 2 : value;
      which = kilograms <= 3 ? "small" : "large";
    }
  }
  if (which === "small") return tier.small;
  if (which === "large") return tier.large;
  // 兜底：spec 没匹配上，默认按 small 档（最常见 5斤）
  return tier.small;
}

