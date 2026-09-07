export const SHARE_ITEM_LIMIT = 50;
export const PENDING_SAVE_KEY = "otp-vault-pending-save";
export const SHARE_NAME_MAX = 40;
export const DEFAULT_SHARE_DAYS = 30;
export const DEFAULT_SHARE_SECONDS = DEFAULT_SHARE_DAYS * 86400;

/** 未手动命名时：单平台「昵称的平台临时凭据授权」，多平台「昵称的临时凭据授权」。 */
export function defaultShareName(nick: string, issuers: string[], max = SHARE_NAME_MAX) {
  const who = nick.trim() || "我";
  const unique = [...new Set(issuers.map((name) => name.trim()).filter(Boolean))];
  const raw = unique.length === 1 ? `${who}的${unique[0]}临时凭据授权` : `${who}的临时凭据授权`;
  return raw.slice(0, max);
}
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

export type ReceivedGroupMeta = {
  label: string;
  title: string;
  subtitle: string;
  sharedBy: string;
  shareName: string;
  /** 头像用 1～2 个字，优先取昵称/用户名开头 */
  avatar: string;
};

/** 「我收到的」分组文案：主标题是授权名，副标题是来自谁。 */
export function receivedGroupMeta(item: { shareName?: string; sharedBy?: string; shareId?: number }): ReceivedGroupMeta {
  const by = item.sharedBy?.trim() || "未知用户";
  const name = item.shareName?.trim() || "";
  const title = name || "未命名授权";
  const subtitle = `来自 ${by}`;
  return {
    label: name ? `${name} · ${subtitle}` : subtitle,
    title,
    subtitle,
    sharedBy: by,
    shareName: name,
    avatar: receivedAvatarText(by),
  };
}

export function receivedGroupLabel(item: { shareName?: string; sharedBy?: string; shareId?: number }) {
  return receivedGroupMeta(item).label;
}

export function receivedAvatarText(sharedBy: string) {
  const text = sharedBy.trim() || "?";
  // 中文取末 1～2 字更像称呼；英文取首字母。
  if (/[\u4e00-\u9fff]/.test(text)) return text.slice(-2);
  const parts = text.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

/** 「来自」筛选项：空=全部，SELF=自己的凭据，其它=分享者用户名。 */
export const SHARED_BY_SELF = "SELF";

export function matchesSharedByFilter(item: { shared?: boolean; sharedBy?: string }, sharedBy: string) {
  if (!sharedBy) return true;
  if (sharedBy === SHARED_BY_SELF) return !item.shared;
  return Boolean(item.shared) && (item.sharedBy?.trim() || "未知用户") === sharedBy;
}

export function listSharedByOptions(items: Array<{ shared?: boolean; sharedBy?: string }>) {
  const names = new Set<string>();
  for (const item of items) {
    if (!item.shared) continue;
    names.add(item.sharedBy?.trim() || "未知用户");
  }
  return [...names].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function sharedByFilterLabel(sharedBy: string) {
  if (!sharedBy) return "";
  if (sharedBy === SHARED_BY_SELF) return "我的";
  return sharedBy;
}

export type CredentialGroup<T> = {
  key: string;
  label: string;
  title?: string;
  subtitle?: string;
  sharedBy?: string;
  sharedByAccount?: string;
  shareName?: string;
  avatar?: string;
  items: T[];
};

/** 「我收到的」按人分组后的一级区块；组内再按授权批次拆成 batches。 */
export type CredentialSourceSection<T> = {
  key: string;
  sharedBy: string;
  sharedByAccount?: string;
  avatar: string;
  label: string;
  items: T[];
  batches: CredentialGroup<T>[];
};

export function sharerKey(item: { sharedBy?: string; sharedByAccount?: string }) {
  return item.sharedByAccount?.trim() || item.sharedBy?.trim() || "未知用户";
}

/** 分组/来自文案：有独立账号时显示「昵称 · 账号」。 */
export function sharerDisplay(item: { sharedBy?: string; sharedByAccount?: string }) {
  const nick = item.sharedBy?.trim() || "";
  const account = item.sharedByAccount?.trim() || "";
  if (nick && account && nick !== account) return `${nick} · ${account}`;
  return nick || account || "未知用户";
}

export type ShareDetailCredential = { id: number; issuer: string; accountName: string };

/** 发出的授权详情：用当前保险库条目还原分享时勾选的凭据。 */
export function shareDetailCredentials(
  credentialIds: number[] | undefined,
  own: Array<{ id: number; issuer: string; accountName: string }>,
): ShareDetailCredential[] {
  if (!credentialIds?.length) return [];
  const byId = new Map(own.map((item) => [item.id, item]));
  return credentialIds.map((id) => {
    const item = byId.get(id);
    return { id, issuer: item?.issuer || "已移除的凭据", accountName: item?.accountName || `#${id}` };
  });
}

export function groupShareBatches<T extends { issuer: string; shareId?: number; shareName?: string; sharedBy?: string }>(
  items: T[],
): CredentialGroup<T>[] {
  const order: string[] = [];
  const buckets = new Map<string, CredentialGroup<T>>();
  for (const item of items) {
    const key = item.shareId != null ? `share:${item.shareId}` : `lone:${item.issuer}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      const meta = receivedGroupMeta(item);
      bucket = {
        key,
        label: meta.label,
        title: meta.title,
        subtitle: meta.subtitle,
        sharedBy: meta.sharedBy,
        shareName: meta.shareName,
        avatar: meta.avatar,
        items: [],
      };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.items.push(item);
  }
  return order.map((key) => buckets.get(key)!);
}

/** 按分享者分组，每人下面再挂授权批次。同一账号用昵称展示。 */
export function groupReceivedBySource<T extends { issuer: string; shareId?: number; shareName?: string; sharedBy?: string; sharedByAccount?: string }>(
  items: T[],
): CredentialSourceSection<T>[] {
  const order: string[] = [];
  const sections = new Map<string, T[]>();
  for (const item of items) {
    const key = sharerKey(item);
    if (!sections.has(key)) {
      sections.set(key, []);
      order.push(key);
    }
    sections.get(key)!.push(item);
  }
  return order.map((key) => {
    const rows = sections.get(key)!;
    const batches = groupShareBatches(rows);
    const nick = rows[0]?.sharedBy?.trim() || key;
    const account = rows[0]?.sharedByAccount?.trim() || "";
    return {
      key: `source:${key}`,
      sharedBy: nick,
      sharedByAccount: account,
      avatar: receivedAvatarText(nick),
      label: `来自 ${sharerDisplay({ sharedBy: nick, sharedByAccount: account })}`,
      items: rows,
      batches,
    };
  });
}

/**
 * 凭据列表分组。
 * - 「我收到的」默认按授权批次；UI 外层再用 groupReceivedBySource 按人。
 * - 其它 Tab 在 grouped 开启时按系统名分组
 */
export function groupCredentials<T extends { issuer: string; shareId?: number; shareName?: string; sharedBy?: string }>(
  items: T[],
  tab: CredentialTab,
  grouped: boolean,
  groupBySource = true,
): CredentialGroup<T>[] {
  if (tab === "received") {
    if (!groupBySource) {
      if (!grouped) return [{ key: "all", label: "", items }];
      return groupShareBatches(items);
    }
    // 按人时，外层用 sections 渲染；这里返回扁平批次仅作兼容计数。
    return groupShareBatches(items);
  }
  if (!grouped) return [{ key: "all", label: "", items }];
  const names = [...new Set(items.map((item) => item.issuer))];
  return names.map((name) => ({ key: `issuer:${name}`, label: name, title: name, items: items.filter((item) => item.issuer === name) }));
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
