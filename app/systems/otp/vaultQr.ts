import QRCode from "qrcode";
import type { VaultTransferItem } from "./vaultApi";

const bytes = (value: string) => new TextEncoder().encode(value);
const varint = (value: number) => { const out: number[] = []; let next = Math.max(0, value); do { let part = next & 127; next = Math.floor(next / 128); if (next) part |= 128; out.push(part); } while (next); return out; };
const fieldVarint = (field: number, value: number) => [...varint(field * 8), ...varint(value)];
const fieldBytes = (field: number, value: Uint8Array) => [...varint(field * 8 + 2), ...varint(value.length), ...value];

function base32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0, buffer = 0;
  const out: number[] = [];
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("OTP Secret 不是有效的 Base32 数据");
    buffer = (buffer << 5) | index; bits += 5;
    if (bits >= 8) { bits -= 8; out.push((buffer >>> bits) & 255); buffer &= (1 << bits) - 1; }
  }
  return new Uint8Array(out);
}

function migrationEntry(item: VaultTransferItem) {
  if (!item.otpSecret) throw new Error(`${item.issuer} / ${item.accountName} 没有 OTP Secret`);
  const algorithm = item.algorithm === "SHA256" ? 2 : item.algorithm === "SHA512" ? 3 : 1;
  const type = item.otpType === "HOTP" ? 1 : 2;
  return new Uint8Array([
    ...fieldBytes(1, base32(item.otpSecret)), ...fieldBytes(2, bytes(item.accountName)), ...fieldBytes(3, bytes(item.issuer)),
    ...fieldVarint(4, algorithm), ...fieldVarint(5, item.digits === 8 ? 2 : 1), ...fieldVarint(6, type),
    ...(type === 1 ? fieldVarint(7, item.hotpCounter || 0) : []),
  ]);
}

export async function buildMigrationQrs(items: VaultTransferItem[]) {
  const supported = items.filter((item) => item.otpSecret && item.otpType !== "STEAM");
  if (!supported.length) throw new Error("没有可导出的 Google Authenticator 凭据");
  const groups = Array.from({ length: Math.ceil(supported.length / 10) }, (_, index) => supported.slice(index * 10, index * 10 + 10));
  const batchId = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
  return Promise.all(groups.map(async (group, batchIndex) => {
    const payload = new Uint8Array([
      ...group.flatMap((item) => fieldBytes(1, migrationEntry(item))), ...fieldVarint(2, 1),
      ...fieldVarint(3, groups.length), ...fieldVarint(4, batchIndex), ...fieldVarint(5, batchId),
    ]);
    const data = btoa(String.fromCharCode(...payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const uri = `otpauth-migration://offline?data=${encodeURIComponent(data)}`;
    return { index: batchIndex + 1, total: groups.length, image: await QRCode.toDataURL(uri, { width: 360, margin: 2, errorCorrectionLevel: "M" }) };
  }));
}
