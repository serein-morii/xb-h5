import { useEffect } from "react";
import { ArrowLeft, BookOpen, ChevronRight, History, KeyRound } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import { applyThemePreference } from "../../lib/theme";
import { OTP_VAULT_VERSION } from "./otpVersion";
import "./otp-vault.css";

const changelog = [
  {
    date: "2026-09-07",
    title: "凭据、设置和授权体验",
    groups: [
      {
        name: "凭据和设置",
        items: [
          "同一系统和账号可以重复添加，例如两台设备各自的验证码；保存前会确认",
          "“我的”改为入口列表，账号与安全、外观和显示、关于各自进入二级页",
        ],
      },
      {
        name: "授权",
        items: [
          "回到保险库时，如果剪贴板里是授权链接，会询问是否转存；空剪贴板或普通文字不会弹出",
          "带访问码的链接第二次打开会直接进入内容，不再卡在验证授权",
        ],
      },
      {
        name: "指南和通知",
        items: [
          "更新日志单独成页，使用指南里不再夹带日志；日志页可进入使用指南",
          "站内信弹窗和详情里，Markdown 保留标题、段落和列表间距",
          "通知中心超过 20 条出现分页；分类标签固定一行，多了可以横滑",
        ],
      },
    ],
  },
  {
    date: "2026-09-06",
    title: "授权转存和日常使用",
    groups: [
      {
        name: "日常使用",
        items: [
          "登录页和保险库会提示添加到桌面，之后可以像 App 一样打开",
          "iOS 按 Safari 分享按钮、Android 可直接安装；Chrome 和 Safari 的入口位置分开说明",
          "设备时间偏差较大时会提示打开自动时间，避免验证码一直错",
          "复制验证码约 30 秒后会清空剪贴板；已经贴走或剪贴板被改过时不会误清",
          "启用离线应急后，登录以及增删改凭据会自动更新本机副本",
        ],
      },
      {
        name: "授权和转存",
        items: [
          "授权页分成“我发出的”和“我收到的”",
          "单次最多授权 50 条凭据",
          "登录后可以把别人的分享链接转存到“我收到的”，不转存也能继续打开原链接",
          "已转存过的链接会提示无需再次转存",
          "收到的授权卡片可以查看下一组验证码；转存列表可收起",
          "分享者可以在转存列表里移除或禁止某人；移除后对方可再转并存会收到通知，禁止后不能再转且不通知",
          "创建授权时可以一键禁止所有人转存",
          "分享者修改、撤销或删除授权时，已转存的人会收到通知",
        ],
      },
    ],
  },
  {
    date: "2026-09-02",
    title: "安全和授权页打磨",
    groups: [
      {
        name: "保险库",
        items: [
          "紧凑模式、授权列表和窄屏布局一起调整，手机上更好点、更好看",
          "显示偏好和分享交接更顺：打开授权链接后更容易回到保险库继续用",
        ],
      },
      {
        name: "公开授权页",
        items: [
          "对方打开的授权页凭据卡片更清楚，有效期和可查看内容一眼能看完",
        ],
      },
    ],
  },
  {
    date: "2026-09-01",
    title: "使用指南、主题和账号",
    groups: [
      {
        name: "指南和授权",
        items: [
          "公开使用指南上线，登录前后都可以阅读",
          "创建授权时可以起名字，会出现在列表、授权页和分享文案第一行",
        ],
      },
      {
        name: "账号和外观",
        items: [
          "深色 / 浅色主题、账号设置和分享同步可用",
          "改密码、换邮箱等敏感操作需要再次确认",
          "验证码默认直接显示，需要时再在外观里打开隐藏",
          "系统分享入口只在手机上出现，避免电脑上误触",
        ],
      },
    ],
  },
  {
    date: "2026-08-31",
    title: "安全中心和授权有效期",
    groups: [
      {
        name: "安全",
        items: [
          "独立安全中心：Passkey 登录、加密备份、离线应急和设备管理",
          "敏感操作会再次验证身份",
        ],
      },
      {
        name: "授权",
        items: [
          "授权有效期可以用更直观的时长选择，不再只填天数",
          "公开授权页用圆环显示剩余有效时间",
          "打开授权链接后的验证和浏览更适合手机",
        ],
      },
    ],
  },
  {
    date: "2026-08-25",
    title: "首次上线",
    groups: [
      {
        name: "凭据",
        items: [
          "OTP Vault 上线：邮箱验证码、账号密码登录和注册",
          "扫码、手动填写或导入文本添加动态口令",
          "卡片查看当前验证码，支持复制、收藏、搜索和按系统筛选",
        ],
      },
      {
        name: "授权",
        items: [
          "可以创建临时授权：链接分享或指定用户",
          "可设置访问码、有效期、可见字段和是否允许复制",
          "授权可以随时撤销，删除凭据不影响已经发出的授权快照",
        ],
      },
    ],
  },
] as const;

export default function OtpVaultChangelogPage() {
  useEffect(() => { applyThemePreference(); }, []);

  return <main className="vault-page vault-changelog-page">
    <section className="vault-head">
      <div className="vault-brand">
        <span className="vault-brand-mark"><History size={20} /></span>
        <div>
          <a className="vault-settings-back" href={APP_ROUTES.otp}><ArrowLeft size={15} />返回保险库</a>
          <h1>更新日志</h1>
          <p>当前版本 {OTP_VAULT_VERSION} · 从首次上线到现在</p>
        </div>
      </div>
      <div className="vault-head-actions">
        <a className="vault-ghost vault-guide-action" href={APP_ROUTES.otpGuide} aria-label="打开使用指南"><BookOpen size={18} /><span>指南</span></a>
        <a className="vault-primary" href={APP_ROUTES.otp}><KeyRound size={16} /><span>打开</span></a>
      </div>
    </section>

    <section className="vault-settings" aria-label="更新记录">
      {changelog.map((entry, index) => <article className="vault-settings-group" key={entry.date}>
        <header>
          <div>
            <small><time dateTime={entry.date}>{entry.date}</time></small>
            <b>{entry.title}</b>
          </div>
          {index === 0 ? <span>版本 {OTP_VAULT_VERSION}</span> : null}
        </header>
        {entry.groups.map((group) => <div className="vault-settings-block" key={group.name}>
          <div className="vault-settings-block-title"><b>{group.name}</b></div>
          <ul className="vault-changelog-list">{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>)}
      </article>)}

      <div className="vault-settings-group">
        <a className="vault-account-link" href={APP_ROUTES.otpGuide}>
          <span className="vault-setting-icon is-violet"><BookOpen size={17} /></span>
          <span className="vault-setting-copy"><b>查看使用指南</b><small>添加、使用、授权和备份的操作说明</small></span>
          <ChevronRight size={15} />
        </a>
      </div>
    </section>
  </main>;
}
