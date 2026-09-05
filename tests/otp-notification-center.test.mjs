import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("OTP secrets and codes never reach logs; no default secret", async () => {
  const utils = await source("../xb/src/main/java/com/xb/shared/utils/OtpUtils.java");
  assert.doesNotMatch(utils, /log\.(info|warn)/);
  assert.doesNotMatch(utils, /IOC2WIIBQER7SMFAGP62YMTGZCUYLH3E/);
  assert.doesNotMatch(utils, /替换成你的谷歌令牌的密钥/);
});

test("backend OtpUtils drops log leakage and hardcoded secret", async () => {
  const utils = await source("../xb/src/main/java/com/xb/shared/utils/OtpUtils.java");
  assert.doesNotMatch(utils, /log\.(info|warn)/);
  assert.doesNotMatch(utils, /IOC2WIIBQER7SMFAGP62YMTGZCUYLH3E/);
  assert.match(utils, /OtpTotpService/);
});

test("email code verification is constant-time and brute-force locked", async () => {
  const service = await source("../xb/src/main/java/com/xb/modules/administration/service/impl/DefaultEmailService.java");
  assert.match(service, /MessageDigest\.isEqual/);
  // 验证码比对不得再走大小写不敏感的普通字符串比较
  assert.doesNotMatch(service, /cached\.equalsIgnoreCase\(code\)/);
  assert.match(service, /EMAIL_CODE_FAIL_KEY/);
  assert.match(service, /MAX_VERIFY_FAILURES/);
  assert.match(service, /验证码错误次数过多已失效/);
});

test("send-code endpoint returns expiresIn and resendAfter", async () => {
  const controller = await source("../xb/src/main/java/com/xb/modules/identity/api/AuthenticationController.java");
  assert.match(controller, /put\("expiresIn", EmailService\.CODE_TTL_SECONDS\)/);
  assert.match(controller, /put\("resendAfter", EmailService\.RESEND_INTERVAL_SECONDS\)/);
});

test("frontend countdown follows backend code policy", async () => {
  const [authScreen, setup, stepUp] = await Promise.all([
    source("app/systems/otp/OtpAuthScreen.tsx"),
    source("app/systems/otp/VaultAccountSetup.tsx"),
    source("app/systems/otp/VaultStepUpDialog.tsx"),
  ]);
  assert.match(authScreen, /resendAfter/);
  assert.match(authScreen, /expiresIn/);
  assert.match(setup, /resendAfter/);
  assert.match(stepUp, /resendAfter/);
});

test("vault login token persists in localStorage (15-day session) and step-up stays in sessionStorage", async () => {
  const api = await source("app/systems/otp/vaultApi.ts");
  assert.match(api, /localStorage\.setItem\(OTP_TOKEN_KEY, token\)/);
  assert.match(api, /sessionStorage\.removeItem\(OTP_TOKEN_KEY\)/);
  assert.match(api, /sessionStorage\.getItem\(OTP_STEP_UP_KEY\)/);
  assert.match(api, /shared\/\$\{-id\}/);
});

test("shared credential has its own semantic route", async () => {
  const [controller, service] = await Promise.all([
    source("../xb/src/main/java/com/xb/modules/otp/api/OtpVaultController.java"),
    source("../xb/src/main/java/com/xb/modules/otp/service/OtpVaultService.java"),
  ]);
  assert.match(controller, /@GetMapping\("\/shared\/\{itemId\}"\)/);
  assert.match(service, /getSharedCredential\(Long itemId\)/);
});

test("credentials list endpoint is rate limited", async () => {
  const controller = await source("../xb/src/main/java/com/xb/modules/otp/api/OtpVaultController.java");
  assert.match(controller, /@GetMapping\("\/credentials"\)\s*\n\s*@RateLimiter\(time = 60, count = 30, limitType = LimitType\.IP\)/);
});

test("in-site message module: typed categories, rich content, unread count", async () => {
  const [service, , controller, sql] = await Promise.all([
    source("../xb/src/main/java/com/xb/modules/message/service/MessageService.java"),
    source("../xb/src/main/java/com/xb/modules/message/service/impl/DefaultMessageService.java"),
    source("../xb/src/main/java/com/xb/modules/message/api/UserMessageController.java"),
    source("../xb/sql/20260905_user_message.sql"),
  ]);
  assert.match(service, /CATEGORY_OTP = "OTP"/);
  assert.match(service, /CATEGORY_SYSTEM = "SYSTEM"/);
  assert.match(service, /CONTENT_MARKDOWN = "markdown"/);
  assert.match(service, /CONTENT_HTML = "html"/);
  assert.match(controller, /unread-count/);
  assert.match(controller, /read-all/);
  assert.match(controller, /broadcast/);
  assert.match(controller, /SecurityUtils\.isAdmin/);
  assert.match(sql, /content_type/);
  assert.match(sql, /sys_user_message/);
});

test("share-open events notify the owner in-site", async () => {
  const [alertService, vaultService] = await Promise.all([
    source("../xb/src/main/java/com/xb/modules/otp/service/OtpVaultSecurityAlertService.java"),
    source("../xb/src/main/java/com/xb/modules/otp/service/impl/DefaultOtpVaultService.java"),
  ]);
  assert.match(alertService, /notifyShareOpened/);
  assert.match(alertService, /MessageService\.CATEGORY_OTP/);
  assert.match(vaultService, /alertService\.notifyShareOpened\(share, IpUtils\.getIpAddr\(request\)\)/);
});

test("richText renderer escapes by default and sanitizes html", async () => {
  const richText = await source("app/lib/richText.ts");
  assert.match(richText, /escapeHtml/);
  assert.match(richText, /ALLOWED_TAGS/);
  assert.match(richText, /name\.startsWith\("on"\)/);
  assert.match(richText, /javascript:/);
  assert.match(richText, /SAFE_URL/);
});

test("notification center: thumbnail list + detail views and compact actions", async () => {
  const component = await source("app/components/NotificationCenter.tsx");
  assert.match(component, /DEFAULT_MESSAGE_CATEGORIES/);
  assert.match(component, /OTP 安全/);
  assert.match(component, /useMessageUnread/);
  assert.match(component, /renderRichText\(selected\.content, selected\.contentType\)/);
  assert.match(component, /notif-bell-badge/);
  assert.match(component, /notif-item-actions/);
  assert.match(component, /notif-back/);
  assert.match(component, /openDetail/);
});

test("order admin shell mounts floating bell and notification center", async () => {
  const shell = await source("app/systems/order/admin/shell.tsx");
  assert.match(shell, /NotificationBellButton/);
  assert.match(shell, /NotificationCenter/);
  assert.match(shell, /useMessageUnread\(apiRequest/);
});

test("otp workspace mounts notification center defaulting to OTP category", async () => {
  const workspace = await source("app/systems/otp/OtpVaultWorkspace.tsx");
  assert.match(workspace, /NotificationCenter/);
  assert.match(workspace, /defaultCategory="OTP"/);
  assert.match(workspace, /vault-notif-badge/);
});

test("step-up dialog prefers passkey when registered", async () => {
  const dialog = await source("app/systems/otp/VaultStepUpDialog.tsx");
  assert.match(dialog, /listVaultPasskeys/);
  assert.match(dialog, /registered \? "passkey" : "email"/);
});

test("offline code generation supports configured digits", async () => {
  const crypto = await source("app/systems/otp/vaultCrypto.ts");
  assert.match(crypto, /Math\.min\(8, Math\.max\(6, item\.digits \|\| 6\)\)/);
});

test("popup announcements: ack on confirm, re-pop when dismissed", async () => {
  const component = await source("app/components/NotificationCenter.tsx");
  assert.match(component, /MessagePopupHost/);
  assert.match(component, /\/popup/);
  assert.match(component, /POPUP_ACK_KEY/);
  assert.match(component, /下次再说/);
  assert.match(component, /确认/);

  const broadcast = await source("app/systems/system/MessageBroadcast.tsx");
  assert.match(broadcast, /popup/);
  assert.match(broadcast, /打开页面时弹窗展示/);

  const [entity, sql, controller] = await Promise.all([
    source("../xb/src/main/java/com/xb/modules/message/domain/entity/UserMessage.java"),
    source("../xb/sql/20260905_user_message_popup.sql"),
    source("../xb/src/main/java/com/xb/modules/message/api/UserMessageController.java"),
  ]);
  assert.match(entity, /private Boolean popup;/);
  assert.match(sql, /`popup`/);
  assert.match(controller, /@GetMapping\("\/popup"\)/);
  assert.match(controller, /Boolean\.parseBoolean\(body\.get\("popup"\)\)/);
});

test("broadcast targets business systems (ORDER/OTP/ADMIN), records editable", async () => {
  const [form, service, controller, mapper, sql] = await Promise.all([
    source("app/systems/system/MessageBroadcast.tsx"),
    source("../xb/src/main/java/com/xb/modules/message/service/impl/DefaultMessageService.java"),
    source("../xb/src/main/java/com/xb/modules/message/api/UserMessageController.java"),
    source("../xb/src/main/java/com/xb/modules/message/mapper/UserMessageMapper.java"),
    source("../xb/sql/20260905_user_message_broadcast.sql"),
  ]);
  assert.match(form, /投递范围/);
  assert.match(form, /订单系统/);
  assert.match(form, /OTP 系统/);
  assert.match(form, /target: "ALL"/);
  assert.match(form, /投递记录/);
  assert.match(form, /broadcast\/list/);
  assert.match(service, /resolveTargets/);
  assert.match(service, /case "ORDER" -> mapper\.selectOrderSystemUserIds/);
  assert.match(service, /case "OTP" -> mapper\.selectUserIdsByRoleKey\("otp_user"\)/);
  assert.match(controller, /body\.get\("target"\)/);
  assert.match(controller, /@GetMapping\("\/broadcast\/list"\)/);
  assert.match(controller, /@PutMapping\("\/broadcast\/\{groupKey\}"\)/);
  assert.match(controller, /@DeleteMapping\("\/broadcast\/\{groupKey\}"\)/);
  assert.match(mapper, /selectOrderSystemUserIds/);
  assert.match(mapper, /selectAdminUserIds/);
  assert.match(mapper, /updateBroadcastGroup/);
  assert.match(sql, /target_role/);
  assert.match(sql, /group_key/);
});

test("html messages keep inline styles via sanitized allowlist", async () => {
  const richText = await source("app/lib/richText.ts");
  assert.match(richText, /SAFE_STYLE_PROPERTIES/);
  assert.match(richText, /sanitizeStyleAttr/);
  assert.match(richText, /UNSAFE_STYLE_VALUE/);
  assert.doesNotMatch(richText, /name === "style"\s*\|\|/);
});

test("bell badge refreshes immediately via message-changed event", async () => {
  const component = await source("app/components/NotificationCenter.tsx");
  assert.match(component, /MESSAGE_CHANGED_EVENT/);
  assert.match(component, /addEventListener\(MESSAGE_CHANGED_EVENT/);
  assert.equal((component.match(/dispatchEvent\(new Event\(MESSAGE_CHANGED_EVENT\)\)/g) || []).length >= 4, true);
});
