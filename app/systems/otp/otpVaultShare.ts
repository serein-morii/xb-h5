export const SHARE_ITEM_LIMIT = 50;
export const PENDING_SAVE_KEY = "otp-vault-pending-save";
const SHARE_CODE_PREFIX = "otp-vault-share-code:";
const SHARE_RETURN = /^\/s\/[A-Za-z0-9_-]{5,16}(?:#k=[A-Za-z0-9]{4,12})?$/;
const SHARE_LINK = /(?:https?:\/\/[^\s]+)?\/s\/([A-Za-z0-9_-]{5,16})(?:#k=([A-Za-z0-9]{4,12}))?/i;
const SHARE_CODE_LINE = /访问码[:：]\s*([A-Za-z0-9]{4,12})/;

export type ParsedShareLink = { token: string; accessCode: string };

export function clipboardReadBlocked(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "NotAllowedError" || name === "SecurityError" || /not allowed|permission|denied|not focused/i.test(message);
}

export function parseShareClipboard(text: string): ParsedShareLink | null {
  const source = text.replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\u00a0/g, " ").trim();
  if (!source) return null;
  const match = source.match(SHARE_LINK);
  if (!match) return null;
  const fromHash = match[2] || "";
  const fromLine = source.match(SHARE_CODE_LINE)?.[1] || "";
  return { token: match[1], accessCode: (fromHash || fromLine).toUpperCase() };
}

export function shouldOfferClipboardShare(parsed: ParsedShareLink | null, ignoredTokens: Iterable<string> = [], viewingToken = "") {
  if (!parsed?.token) return false;
  if (viewingToken && viewingToken === parsed.token) return false;
  for (const token of ignoredTokens) if (token === parsed.token) return false;
  return true;
}

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

export function shouldShowShareHandoff(hasAccessCode: boolean, hasExistingSession: boolean) {
  return Boolean(hasAccessCode) && !hasExistingSession;
}

export function shareHandoffAfterRestore(contentLoaded: boolean): "show-content" | "reopen" {
  return contentLoaded ? "show-content" : "reopen";
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
