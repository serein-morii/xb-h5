export type IpInfo = {
  ip?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  isp?: string;
  organization?: string;
  asn?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
};

function distinct(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

export function ipLocationLabel(info?: IpInfo) {
  const parts = distinct([info?.country, info?.region, info?.city]);
  return parts.length ? parts.join(" · ") : "未知位置";
}

export function ipNetworkLabel(info?: IpInfo) {
  const parts = distinct([info?.isp, info?.organization, info?.asn]);
  return parts.length ? parts.join(" · ") : "未知网络";
}

export function ipDetailLabel(info?: IpInfo) {
  const location = ipLocationLabel(info);
  const network = ipNetworkLabel(info);
  return distinct([location, network === "未知网络" ? undefined : network, info?.timezone]).join(" · ");
}

export function ipCoordinateLabel(info?: IpInfo) {
  if (typeof info?.latitude !== "number" || typeof info?.longitude !== "number") return "未知坐标";
  return `${info.latitude.toFixed(4)}, ${info.longitude.toFixed(4)}`;
}
