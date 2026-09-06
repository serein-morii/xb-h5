export const SHARE_ITEM_LIMIT = 50;
export const PENDING_SAVE_KEY = "otp-vault-pending-save";
const SHARE_CODE_PREFIX = "otp-vault-share-code:";
const SHARE_RETURN = /^\/s\/[A-Za-z0-9_-]{5,16}(?:#k=[A-Za-z0-9]{4,12})?$/;

export type CredentialTab = "all" | "favorite" | "received";
export type ShareTab = "sent" | "received";

export function receivedShareSourceLabel(source?: string, shareMode?: string) {
  return source === "DIRECT" || shareMode === "DIRECT" ? "指定授权" : "链接转存";
}

export function selectShareItems(ids: number[], limit = SHARE_ITEM_LIMIT) {
  return ids.slice(0, limit);
}

export function toggleShareSelection(selected: number[], id: number, limit = SHARE_ITEM_LIMIT) {
  if (selected.includes(id)) return { selected: selected.filter((value) => value !== id), limited: false };
  if (selected.length >= limit) return { selected, limited: true };
  return { selected: [...selected, id], limited: false };
}

export function matchesCredentialTab(item: { shared?: boolean; favorite?: boolean }, tab: CredentialTab, showShared: boolean) {
  if (tab === "favorite") return Boolean(item.favorite);
  if (tab === "received") return Boolean(item.shared);
  return showShared || !item.shared;
}

export function shareAccessCodeKey(token: string) {
  return `${SHARE_CODE_PREFIX}${token}`;
}

export function rememberShareAccessCode(token: string, accessCode: string) {
  const code = accessCode.trim().toUpperCase();
  if (code) sessionStorage.setItem(shareAccessCodeKey(token), code);
}

export function readShareAccessCode(token: string) {
  return sessionStorage.getItem(shareAccessCodeKey(token)) || "";
}

export function shareLoginNext(token: string, accessCode = "") {
  const code = accessCode.trim().toUpperCase();
  const path = code ? `/s/${token}#k=${code}` : `/s/${token}`;
  return `/otp?next=${encodeURIComponent(path)}`;
}

export function shareReturnPath(next: string) {
  return SHARE_RETURN.test(next) ? next : "";
}
