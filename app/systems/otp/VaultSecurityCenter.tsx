import {
  ArchiveRestore, BellRing, Check, Clock3, Download, FileCheck2, FileKey, Fingerprint, KeyRound, Laptop,
  LoaderCircle, LockKeyhole, Pencil, QrCode, RefreshCw, RotateCw, ShieldCheck, Trash2, Upload, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  commitVaultImport, deleteVaultPasskey, exportVaultBackup, finishVaultPasskeyRegistration, getVaultPasskeyRegistrationOptions,
  getVaultSecurityStatus, listDeletedVaultCredentials, listVaultActivities, listVaultPasskeys, listVaultSessions,
  lockVaultSecurity, previewVaultImport, purgeVaultCredential, recordVaultRecoveryCheck, renameVaultPasskey,
  restoreVaultCredential, revokeOtherVaultSessions, revokeVaultDevice, rotateVaultKey, updateVaultDevice,
  type VaultActivity, type VaultCredential, type VaultPasskey, type VaultPrefs, type VaultSecurityStatus,
  type VaultSession, type VaultTransferItem,
} from "./vaultApi";
import {
  createZeroKnowledgeKey, decryptVaultBackup, decryptZeroKnowledgeValue, encryptVaultBackup,
  encryptZeroKnowledgeValue, hasOfflineVault, removeOfflineVault, saveOfflineVault, unlockZeroKnowledgeKey,
} from "./vaultCrypto";
import { createVaultPasskey } from "./vaultPasskey";
import { buildMigrationQrs } from "./vaultQr";

type Props = {
  prefs: VaultPrefs;
  updatePrefs: (prefs: VaultPrefs) => Promise<void>;
  zeroKnowledgeKey: CryptoKey | null;
  onZeroKnowledgeKey: (key: CryptoKey | null) => void;
};

/** 安全中心只展示可核验状态；浏览器密钥始终只保留在当前页面内存中。 */
export default function VaultSecurityCenter({ prefs, updatePrefs, zeroKnowledgeKey, onZeroKnowledgeKey }: Props) {
  const [sessions, setSessions] = useState<VaultSession[]>([]);
  const [trash, setTrash] = useState<VaultCredential[]>([]);
  const [activities, setActivities] = useState<VaultActivity[]>([]);
  const [status, setStatus] = useState<VaultSecurityStatus | null>(null);
  const [passkeys, setPasskeys] = useState<VaultPasskey[]>([]);
  const [backupPassword, setBackupPassword] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const [restoreItems, setRestoreItems] = useState<VaultTransferItem[]>([]);
  const [preview, setPreview] = useState<Array<{ issuer: string; accountName: string; status: "NEW" | "DUPLICATE" | "CONFLICT" }>>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [qrs, setQrs] = useState<Array<{ index: number; total: number; image: string }>>([]);
  const [offlineEnabled, setOfflineEnabled] = useState(hasOfflineVault());
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<"protect" | "backup" | "activity">("protect");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [editingDevice, setEditingDevice] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [editingPasskey, setEditingPasskey] = useState<number | null>(null);
  const [passkeyName, setPasskeyName] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [zkPassword, setZkPassword] = useState("");
  const [zkConfirm, setZkConfirm] = useState("");

  const load = async () => {
    // 会话接口会登记本次设备，先完成它再读取汇总状态，避免并发首次登记同一设备。
    const sessionResult = await listVaultSessions();
    const [trashResult, activityResult, statusResult, passkeyResult] = await Promise.all([
      listDeletedVaultCredentials(), listVaultActivities(), getVaultSecurityStatus(), listVaultPasskeys(),
    ]);
    setSessions(sessionResult.data || []); setTrash(trashResult.data || []); setActivities(activityResult.data || []);
    setStatus(statusResult.data); setPasskeys(passkeyResult.data || []);
  };
  useEffect(() => { void load().catch(() => undefined); }, []);

  const run = async (name: string, task: () => Promise<void>) => {
    setBusy(name); setMessage("");
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(""); }
  };

  const materializeItems = async (items: VaultTransferItem[]) => Promise.all(items.map(async (item) => {
    if (!item.clientPasswordCiphertext && !item.clientOtpSecretCiphertext) return item;
    if (!zeroKnowledgeKey) throw new Error("请先解锁零知识保护再导出");
    return {
      ...item,
      password: item.clientPasswordCiphertext ? await decryptZeroKnowledgeValue(item.clientPasswordCiphertext, zeroKnowledgeKey) : item.password,
      otpSecret: item.clientOtpSecretCiphertext ? await decryptZeroKnowledgeValue(item.clientOtpSecretCiphertext, zeroKnowledgeKey) : item.otpSecret,
      clientPasswordCiphertext: undefined, clientOtpSecretCiphertext: undefined,
    };
  }));

  const protectImportItems = async (items: VaultTransferItem[]) => {
    if (!prefs.zeroKnowledgeEnabled) return items;
    if (!zeroKnowledgeKey) throw new Error("请先解锁零知识保护再恢复");
    return Promise.all(items.map(async (item) => ({
      ...item,
      clientPasswordCiphertext: item.password ? await encryptZeroKnowledgeValue(item.password, zeroKnowledgeKey) : item.clientPasswordCiphertext,
      clientOtpSecretCiphertext: item.otpSecret ? await encryptZeroKnowledgeValue(item.otpSecret, zeroKnowledgeKey) : item.clientOtpSecretCiphertext,
      password: undefined, otpSecret: undefined,
    })));
  };

  const createEncrypted = async () => {
    const result = await exportVaultBackup();
    return encryptVaultBackup({ ...result.data, items: await materializeItems(result.data.items) }, backupPassword);
  };
  const downloadBackup = () => run("backup", async () => {
    const encrypted = await createEncrypted();
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([encrypted], { type: "application/json" }));
    link.download = `otp-vault-${new Date().toISOString().slice(0, 10)}.xbvault`; link.click(); URL.revokeObjectURL(link.href);
    setMessage("加密恢复包已下载，请与恢复密码分开保存"); await load();
  });
  const enableOffline = () => run("offline", async () => {
    saveOfflineVault(await createEncrypted()); setOfflineEnabled(true);
    setMessage("离线应急保险库已更新，仅能使用当前恢复密码解锁");
  });
  const readRestoreFile = async (file?: File) => { if (file) { setRestoreText(await file.text()); setRestoreItems([]); setPreview([]); } };
  const verifyRecovery = () => run("verify-recovery", async () => {
    const backup = await decryptVaultBackup(restoreText, restorePassword);
    await recordVaultRecoveryCheck(backup.items.length, backup.createdAt);
    setMessage(`恢复包完整性通过：${backup.items.length} 项，未写入任何数据`); await load();
  });
  const previewRestore = () => run("preview", async () => {
    const backup = await decryptVaultBackup(restoreText, restorePassword);
    const protectedItems = await protectImportItems(backup.items);
    const result = await previewVaultImport(protectedItems); setRestoreItems(protectedItems); setPreview(result.data.items || []);
    setMessage(`已解析 ${backup.items.length} 项，请确认冲突处理方式`);
  });
  const commitRestore = () => run("restore", async () => {
    const result = await commitVaultImport(restoreItems, replaceExisting);
    setMessage(`恢复完成：新增 ${result.data.created}，更新 ${result.data.updated}，跳过 ${result.data.skipped}`);
    setRestoreText(""); setRestoreItems([]); setPreview([]); await load();
  });
  const exportQr = () => run("qr", async () => {
    const result = await exportVaultBackup(); setQrs(await buildMigrationQrs(await materializeItems(result.data.items)));
    setMessage("迁移二维码已在本机生成，未上传到第三方服务");
  });
  const addPasskey = () => run("passkey", async () => {
    const options = await getVaultPasskeyRegistrationOptions();
    await finishVaultPasskeyRegistration(options.data.requestId, await createVaultPasskey(options.data.publicKey), devicePasskeyName());
    setMessage("Passkey 已绑定，可在登录页直接使用"); await load();
  });
  const enableZeroKnowledge = () => run("zk-enable", async () => {
    if (zkPassword.length < 10) throw new Error("零知识保护密码至少 10 位");
    if (zkPassword !== zkConfirm) throw new Error("两次输入的保护密码不一致");
    const created = await createZeroKnowledgeKey(zkPassword);
    await updatePrefs({ ...prefs, zeroKnowledgeEnabled: true, zeroKnowledgeSalt: created.salt, zeroKnowledgeVerifier: created.verifier });
    onZeroKnowledgeKey(created.key); setZkPassword(""); setZkConfirm("");
    setMessage("零知识保护已启用；之后新保存的敏感值只在浏览器中加密"); await load();
  });
  const unlockZeroKnowledge = () => run("zk-unlock", async () => {
    if (!prefs.zeroKnowledgeSalt || !prefs.zeroKnowledgeVerifier) throw new Error("零知识保护配置不完整");
    onZeroKnowledgeKey(await unlockZeroKnowledgeKey(zkPassword, prefs.zeroKnowledgeSalt, prefs.zeroKnowledgeVerifier));
    setZkPassword(""); setMessage("零知识保险库已在当前页面解锁");
  });

  return <div className="vault-security-center">
    <header className="vault-security-hero"><span><ShieldCheck size={23} /></span><div><small>PROTECTION & RECOVERY</small><h2>安全中心</h2><p>保护状态、恢复能力和登录设备集中管理</p></div><span className="vault-security-running"><ShieldCheck size={13} />{status?.unlocked ? `已解锁 ${status.stepUpExpiresIn}s` : "保护运行中"}</span><button type="button" onClick={() => void run("lock", async () => { await lockVaultSecurity(); onZeroKnowledgeKey(null); setMessage("敏感操作授权已结束"); await load(); })}><LockKeyhole size={14} />重新保护</button><p className="vault-security-lock-help">不会退出账号，只结束敏感操作授权并清除当前页面内存中的零知识密钥。</p></header>
    <nav className="vault-security-tabs" aria-label="安全中心分类">{([['protect', ShieldCheck, '安全保护'], ['backup', FileKey, '备份恢复'], ['activity', Laptop, '设备与记录']] as const).map(([key, Icon, label]) => <button type="button" className={section === key ? "is-active" : ""} onClick={() => setSection(key)} key={key}><Icon size={15} /><span>{label}</span>{key === "activity" && sessions.length ? <em>{sessions.length}</em> : null}</button>)}</nav>

    {section === "protect" ? <div className="vault-security-layout is-protect">
      <section className="vault-settings-group vault-security-facts"><header><div><b>实时保护状态</b><small>数据来自当前密钥、会话与安全记录</small></div><span>{status?.encryption || "读取中"}</span></header><div className="vault-security-grid">
        <article><ShieldCheck size={17} /><div><b>{status?.keyId ? `加密密钥 ${status.keyId}` : "加密状态读取中"}</b><small>{status?.keyRotationNeeded ? `${status.keyRotationNeeded} 项等待轮换` : "当前密钥版本一致"}</small></div></article>
        <article><LockKeyhole size={17} /><div><b>{status?.unlocked ? "敏感操作已验证" : "敏感操作已保护"}</b><small>{status?.unlocked ? `${status.stepUpExpiresIn} 秒后自动结束` : "查看、编辑和导出时再次验证"}</small></div></article>
        <article><Clock3 size={17} /><div><b>{status?.failedVerifications24h || 0} 次验证失败</b><small>最近 24 小时 · {status?.deviceCount || 0} 个设备</small></div></article>
        <article><FileCheck2 size={17} /><div><b>{status?.lastRecoveryCheckTime ? "恢复包已验证" : "尚未验证恢复包"}</b><small>{status?.lastRecoveryCheckTime ? formatTime(status.lastRecoveryCheckTime) : "建议下载后执行一次完整性检查"}</small></div></article>
      </div><div className="vault-security-actions"><button type="button" disabled={busy !== "" || !status?.keyRotationNeeded} onClick={() => void run("rotate", async () => { const result = await rotateVaultKey(); setMessage(`轮换完成：${result.data.credentials + result.data.shares + result.data.shareItems} 项`); await load(); })}><RotateCw size={14} />{busy === "rotate" ? "轮换中" : status?.keyRotationNeeded ? "轮换到当前密钥" : "无需轮换"}</button></div></section>
      <section className="vault-settings-group"><header><div><b>Passkey</b><small>使用设备生物识别或系统 PIN 登录</small></div><span>{passkeys.length} 个</span></header><div className="vault-passkey-list">{passkeys.map((item) => <article key={item.id}><Fingerprint size={18} /><div>{editingPasskey === item.id ? <input className="vault-device-name-input" value={passkeyName} maxLength={40} autoFocus onChange={(event) => setPasskeyName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditingPasskey(null); if (event.key === "Enter") event.currentTarget.blur(); }} onBlur={() => void run(`passkey-name-${item.id}`, async () => { if (passkeyName.trim() && passkeyName.trim() !== item.displayName) await renameVaultPasskey(item.id, passkeyName.trim()); setEditingPasskey(null); await load(); })} /> : <b>{item.displayName}</b>}<small>{item.backedUp ? "已同步到设备云钥匙串" : item.backupEligible ? "支持备份" : "仅此安全设备"}{item.lastUsedTime ? ` · ${formatTime(item.lastUsedTime)}` : ""}</small></div><button type="button" onClick={() => { setEditingPasskey(item.id); setPasskeyName(item.displayName); }} aria-label="重命名"><Pencil size={13} /></button><button type="button" className="is-danger" onClick={() => { const key = `passkey-${item.id}`; if (confirmAction !== key) return setConfirmAction(key); void run(`passkey-delete-${item.id}`, async () => { await deleteVaultPasskey(item.id); setConfirmAction(""); await load(); setMessage("Passkey 已移除"); }); }} aria-label={confirmAction === `passkey-${item.id}` ? "确认移除" : "移除"}>{confirmAction === `passkey-${item.id}` ? "确认" : <Trash2 size={13} />}</button></article>)}</div><div className="vault-security-actions"><button type="button" disabled={busy !== ""} onClick={() => void addPasskey()}><Fingerprint size={14} />{busy === "passkey" ? "等待设备确认" : "添加 Passkey"}</button></div></section>
      <section className="vault-settings-group"><header><div><b>零知识保护</b><small>可选；保护密码和明文只存在当前浏览器内存</small></div><span>{prefs.zeroKnowledgeEnabled ? zeroKnowledgeKey ? "已解锁" : "已启用" : "未启用"}</span></header><p className="vault-transparency-note">启用后，新保存的密码与 OTP Secret 由 Web Crypto 在浏览器中加密。服务器只能保存密文；忘记保护密码将无法恢复这些数据。</p><div className="vault-zero-knowledge-form"><label className="vault-security-field"><span>零知识保护密码</span><input type="password" value={zkPassword} onChange={(event) => setZkPassword(event.target.value)} autoComplete="off" placeholder={prefs.zeroKnowledgeEnabled ? "输入保护密码解锁" : "至少 10 位，不能通过邮箱找回"} /></label>{!prefs.zeroKnowledgeEnabled ? <label className="vault-security-field"><span>再次输入</span><input type="password" value={zkConfirm} onChange={(event) => setZkConfirm(event.target.value)} autoComplete="off" /></label> : null}</div><div className="vault-security-actions"><button type="button" disabled={busy !== "" || !zkPassword} onClick={() => void (prefs.zeroKnowledgeEnabled ? unlockZeroKnowledge() : enableZeroKnowledge())}><KeyRound size={14} />{prefs.zeroKnowledgeEnabled ? zeroKnowledgeKey ? "重新解锁" : "解锁零知识保险库" : "启用零知识保护"}</button>{zeroKnowledgeKey ? <button type="button" onClick={() => { onZeroKnowledgeKey(null); setMessage("零知识密钥已从当前页面内存清除"); }}><LockKeyhole size={14} />锁定</button> : null}</div></section>
      <section className="vault-settings-group"><header><div><b>自动保护与提醒</b><small>离开一段时间后结束二次验证</small></div><span>{prefs.autoLockMinutes} 分钟</span></header><label className="vault-security-field"><span>无操作多久后重新验证</span><select value={prefs.autoLockMinutes} onChange={(event) => void updatePrefs({ ...prefs, autoLockMinutes: Number(event.target.value) })}><option value={1}>1 分钟</option><option value={5}>5 分钟</option><option value={15}>15 分钟</option><option value={30}>30 分钟</option><option value={60}>60 分钟</option></select></label><label className="vault-setting-row"><span className="vault-setting-copy"><b>安全事件邮件提醒</b><small>连续验证失败、导出、设备退出和密钥轮换时提醒</small></span><input type="checkbox" checked={prefs.securityAlerts} onChange={(event) => void updatePrefs({ ...prefs, securityAlerts: event.target.checked })} /><i /></label></section>
    </div> : null}

    {section === "backup" ? <div className="vault-security-layout is-backup">
      <section className="vault-settings-group"><header><div><b>加密备份与离线应急</b><small>浏览器本机加密，恢复密码不会上传</small></div><span>{offlineEnabled ? "已启用" : status?.lastBackupTime ? "已有备份" : "未备份"}</span></header><label className="vault-security-field"><span>恢复密码</span><input type="password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} autoComplete="new-password" placeholder="至少 8 位，与备份文件分开保存" /></label><div className="vault-security-actions"><button type="button" disabled={busy !== "" || backupPassword.length < 8} onClick={() => void downloadBackup()}><Download size={14} />{busy === "backup" ? "生成中" : "下载恢复包"}</button><button type="button" disabled={busy !== "" || backupPassword.length < 8} onClick={() => void enableOffline()}><RefreshCw size={14} />{offlineEnabled ? "更新离线副本" : "启用离线应急"}</button>{offlineEnabled ? <button type="button" className="is-danger" onClick={() => { removeOfflineVault(); setOfflineEnabled(false); setMessage("本机离线副本已删除"); }}><X size={14} />关闭离线</button> : null}</div></section>
      <section className="vault-settings-group"><header><div><b>迁移到验证器 App</b><small>在当前浏览器生成批量迁移二维码</small></div><span>{qrs.length ? `${qrs.length} 张` : "本机生成"}</span></header><div className="vault-security-actions"><button type="button" disabled={busy !== ""} onClick={() => void exportQr()}><QrCode size={14} />{busy === "qr" ? "生成中" : "生成迁移二维码"}</button></div>{qrs.length ? <div className="vault-qr-list">{qrs.map((qr) => <article key={qr.index}><img src={qr.image} alt={`迁移二维码 ${qr.index}/${qr.total}`} /><b>{qr.index} / {qr.total}</b><small>请使用验证器 App 扫描</small></article>)}</div> : null}</section>
      <section className="vault-settings-group vault-backup-restore"><header><div><b>验证或恢复保险库</b><small>可以只验证完整性，不会写入任何数据</small></div><span>{preview.length ? `${preview.length} 项` : "等待文件"}</span></header><div className="vault-restore-grid"><label className="vault-security-file"><Upload size={17} /><span>{restoreText ? "恢复包已读取" : "选择 .xbvault 恢复包"}</span><input type="file" accept=".xbvault,application/json" onChange={(event) => void readRestoreFile(event.target.files?.[0])} /></label><label className="vault-security-field"><span>恢复密码</span><input type="password" value={restorePassword} onChange={(event) => setRestorePassword(event.target.value)} /></label></div>{preview.length ? <div className="vault-restore-preview">{preview.slice(0, 30).map((item, index) => <article key={`${item.issuer}-${item.accountName}-${index}`}><span className={`is-${item.status.toLowerCase()}`}>{item.status === "NEW" ? "新增" : item.status === "DUPLICATE" ? "重复" : "冲突"}</span><div><b>{item.issuer}</b><small>{item.accountName}</small></div></article>)}</div> : null}<label className="vault-check"><input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} /><span><b>冲突时覆盖现有凭据</b><small>只影响同系统、同账号且内容不同的项目</small></span></label><div className="vault-security-actions"><button type="button" disabled={!restoreText || restorePassword.length < 8 || busy !== ""} onClick={() => void verifyRecovery()}><FileCheck2 size={14} />{busy === "verify-recovery" ? "验证中" : "仅验证完整性"}</button><button type="button" disabled={!restoreText || restorePassword.length < 8 || busy !== ""} onClick={() => void previewRestore()}>{busy === "preview" ? <LoaderCircle className="spin" size={14} /> : <ArchiveRestore size={14} />}预览恢复</button>{restoreItems.length ? <button type="button" disabled={busy !== ""} onClick={() => void commitRestore()}><Check size={14} />确认恢复</button> : null}</div></section>
    </div> : null}

    {section === "activity" ? <div className="vault-security-layout is-activity">
      <section className="vault-settings-group"><header><div><b>登录设备</b><small>同浏览器、系统和 IP 的会话会合并显示</small></div><span>{sessions.length} 个设备</span></header><div className="vault-security-actions"><button type="button" disabled={busy !== "" || sessions.length < 2} onClick={() => void run("revoke-others", async () => { const result = await revokeOtherVaultSessions(); setMessage(`已退出 ${result.data.revoked} 个其他会话`); await load(); })}>退出其他设备</button></div><div className="vault-session-list">{sessions.slice(0, showAllSessions ? sessions.length : 4).map((session) => <article key={session.deviceKey}><Laptop size={17} /><div>{editingDevice === session.deviceKey ? <input className="vault-device-name-input" value={deviceName} maxLength={40} autoFocus onChange={(event) => setDeviceName(event.target.value)} onBlur={() => void run(`device-name-${session.deviceKey}`, async () => { await updateVaultDevice(session.deviceKey, { displayName: deviceName }); setEditingDevice(""); await load(); })} /> : <b>{session.displayName}{session.current ? "（当前设备）" : ""}</b>}<small>{session.ipAddress || "未知 IP"} · {session.location || "未知位置"} · {session.sessionCount} 个会话</small></div><button type="button" onClick={() => { setEditingDevice(session.deviceKey); setDeviceName(session.displayName); }} aria-label="修改设备名称"><Pencil size={13} /></button><button type="button" className={session.trusted ? "is-trusted" : ""} onClick={() => void run(`device-trust-${session.deviceKey}`, async () => { await updateVaultDevice(session.deviceKey, { trusted: !session.trusted }); await load(); })}>{session.trusted ? "已信任" : "信任"}</button>{!session.current ? <button type="button" onClick={() => void run(`session-${session.deviceKey}`, async () => { await revokeVaultDevice(session.deviceKey); await load(); setMessage("设备会话已退出"); })}>退出</button> : null}</article>)}</div>{sessions.length > 4 ? <button type="button" className="vault-security-more" onClick={() => setShowAllSessions(!showAllSessions)}>{showAllSessions ? "收起设备" : `查看另外 ${sessions.length - 4} 个设备`}</button> : null}</section>
      <section className="vault-settings-group"><header><div><b>回收站</b><small>误删的凭据可以恢复，也可以永久清除</small></div><span>{trash.length} 项</span></header><div className="vault-session-list">{trash.length ? trash.map((item) => <article key={item.id}><Trash2 size={17} /><div><b>{item.issuer}</b><small>{item.accountName}</small></div><button type="button" onClick={() => void run(`restore-${item.id}`, async () => { await restoreVaultCredential(item.id); await load(); setMessage("凭据已恢复"); })}>恢复</button><button type="button" className="is-danger" onClick={() => { const key = `purge-${item.id}`; if (confirmAction !== key) return setConfirmAction(key); void run(key, async () => { await purgeVaultCredential(item.id); setConfirmAction(""); await load(); setMessage("凭据已永久删除"); }); }}>{confirmAction === `purge-${item.id}` ? "确认清除" : "清除"}</button></article>) : <p className="vault-security-empty">回收站是空的</p>}</div></section>
      <section className="vault-settings-group"><header><div><b>最近安全活动</b><small>关键操作、设备和来源 IP</small></div><span>{activities.length} 条</span></header><div className="vault-activity-list">{activities.slice(0, 30).map((item) => <article key={item.id}><span><KeyRound size={14} /></span><div><b>{activityLabel(item.action)}</b><small>{item.detail || item.targetType || "保险库"} · {item.ipAddress || "未知 IP"}</small></div><time>{formatTime(item.createTime)}</time></article>)}</div></section>
    </div> : null}
    {message ? <div className="vault-security-message"><BellRing size={14} />{message}</div> : null}
  </div>;
}

function devicePasskeyName() {
  const platform = navigator.userAgent.includes("iPhone") ? "iPhone" : navigator.userAgent.includes("Android") ? "Android" : navigator.userAgent.includes("Mac") ? "Mac" : navigator.userAgent.includes("Windows") ? "Windows" : "此设备";
  return `${platform} Passkey`;
}

function formatTime(value: string) {
  return new Date(value.replace(" ", "T")).toLocaleString("zh-CN", { hour12: false });
}

function activityLabel(action: string) {
  return ({ UNLOCK: "完成二次身份验证", UNLOCK_FAILED: "二次身份验证失败", LOCK: "结束敏感操作授权", VIEW: "查看敏感凭据", CREATE: "新增凭据", UPDATE: "更新凭据", DELETE: "删除凭据", RESTORE: "恢复凭据", PURGE: "永久清除凭据", EXPORT: "导出恢复包", IMPORT: "恢复保险库", SHARE_CREATE: "创建授权", SHARE_REVOKE: "撤销授权", HOTP_NEXT: "推进 HOTP 计数器", KEY_ROTATE: "完成密钥轮换", RECOVERY_CHECK: "验证恢复包", PASSKEY_ADD: "添加 Passkey", PASSKEY_DELETE: "移除 Passkey", SESSION_REVOKE: "退出设备会话", SESSION_REVOKE_OTHERS: "退出其他设备", DEVICE_UPDATE: "更新设备设置" } as Record<string, string>)[action] || action;
}
