export const SHARE_ITEM_LIMIT = 50;
export const PENDING_SAVE_KEY = "otp-vault-pending-save";

export type CredentialTab = "all" | "favorite" | "received";

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

export function shareLoginNext(token: string) {
  return `/otp?next=${encodeURIComponent(`/s/${token}`)}`;
}
