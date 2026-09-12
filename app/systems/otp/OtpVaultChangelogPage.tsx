import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import { applyThemePreference } from "../../lib/theme";
import { OTP_VAULT_VERSION } from "./otpVersion";
import "./otp-guide.css";

const changelog = [
  {
    date: "2026-09-15",
    title: "标签、导入和浏览器推送",
    items: [
      "凭据可加最多 8 个标签，编辑时以标签 chips 展示，列表可按标签筛选",
      "批量导入支持 otpauth 文本以及未加密的 Aegis / andOTP JSON，会先预览新增、重复和冲突，再选择跳过或覆盖",
      "读取和准备大批量导入时显示进度，不再长时间无反馈",
      "开启零知识时导入只上传客户端密文，明文不会离开浏览器",
      "通知增加浏览器推送，可与邮件、Bark 一起按事件勾选；通知页会核对本机与服务器订阅状态",
      "补充 iPhone 主屏幕安装和桌面浏览器授权说明，密钥轮换后会提示重新订阅",
      "更换通知邮箱需要验证码；注销账号会清掉推送订阅",
    ],
  },
  {
    date: "2026-09-14",
    title: "通知和设置入口",
    items: [
      "「我的」入口改为账号、通知、显示、安全、关于",
      "通知总开关关闭后，邮件和 Bark 立即停发；站内信仍会送达",
      "按事件勾选改成账号安全、备份导出、发出/收到的授权四组",
      "通知页可发送测试通知，用来确认邮箱和 Bark 是否通",
      "按事件的邮件 / Bark 开关开启时显示对勾，关闭时不再看起来一直亮着",
    ],
  },
  {
    date: "2026-09-09",
    title: "锁屏",
    items: [
      "顶栏皮肤切换右侧增加小锁，可手动锁定保险库",
      "未设置锁屏密码时，点锁先进入设置；已设置后即使未开自动锁屏也能手动锁",
      "锁屏密码支持 6 位或 4 位数字，以及字母加数字的复杂密码",
      "Passkey 解锁必须先设置锁屏密码，避免设备验证不可用时打不开",
      "可在安全中心设置 1 / 5 / 15 / 30 分钟无操作自动锁屏，关闭后仍可手动锁",
      "设置页提示以后到「我的 → 安全」修改",
    ],
  },
  {
    date: "2026-09-07",
    title: "凭据、设置和授权体验",
    items: [
      "同一系统和账号可以重复添加，例如两台设备各自的验证码；保存前会确认",
      "“我的”改为入口列表，账号与安全、外观和显示、关于各自进入二级页",
      "回到保险库时，如果剪贴板里是授权链接，会询问是否转存；空剪贴板或普通文字不会弹出",
      "带访问码的链接第二次打开会直接进入内容，不再卡在验证授权",
      "更新日志单独成页，使用指南里不再夹带日志；日志页可进入使用指南",
      "站内信弹窗和详情里，Markdown 保留标题、段落和列表间距",
      "通知中心超过 20 条出现分页；分类标签固定一行，多了可以横滑",
      "公告弹窗打开时锁住背后页面，不能再滑动或点击",
      "使用指南在手机上缩小字号和间距，并补上操作流程图",
      "凭据和授权页的筛选标签改到标题右侧，靠右对齐",
      "安全中心从底栏挪到「我的」，底栏改为凭据、授权、我的；「账号与安全」改名为「账号」",
      "「我的」入口顺序：账号、外观和显示、安全中心、关于",
      "凭据「添加」和授权「创建授权」改为页面内浮钮；电脑贴内容区右下，不再贴窗口边",
      "使用指南和更新日志的返回回到上一页",
    ],
  },
  {
    date: "2026-09-06",
    title: "授权转存和日常使用",
    items: [
      "登录页和保险库会提示添加到桌面，之后可以像 App 一样打开",
      "iOS 按 Safari 分享按钮、Android 可直接安装；Chrome 和 Safari 的入口位置分开说明",
      "设备时间偏差较大时会提示打开自动时间，避免验证码一直错",
      "复制验证码约 30 秒后会清空剪贴板；已经贴走或剪贴板被改过时不会误清",
      "启用离线应急后，登录以及增删改凭据会自动更新本机副本",
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
  {
    date: "2026-09-02",
    title: "安全和授权页打磨",
    items: [
      "紧凑模式、授权列表和窄屏布局一起调整，手机上更好点、更好看",
      "显示偏好和分享交接更顺：打开授权链接后更容易回到保险库继续用",
      "对方打开的授权页凭据卡片更清楚，有效期和可查看内容一眼能看完",
    ],
  },
  {
    date: "2026-09-01",
    title: "使用指南、主题和账号",
    items: [
      "公开使用指南上线，登录前后都可以阅读",
      "创建授权时可以起名字，会出现在列表、授权页和分享文案第一行",
      "深色 / 浅色主题、账号设置和分享同步可用",
      "改密码、换邮箱等敏感操作需要再次确认",
      "验证码默认直接显示，需要时再在外观里打开隐藏",
      "系统分享入口只在手机上出现，避免电脑上误触",
    ],
  },
  {
    date: "2026-08-31",
    title: "安全中心和授权有效期",
    items: [
      "独立安全中心：Passkey 登录、加密备份、离线应急和设备管理",
      "敏感操作会再次验证身份",
      "授权有效期可以用更直观的时长选择，不再只填天数",
      "公开授权页用圆环显示剩余有效时间",
      "打开授权链接后的验证和浏览更适合手机",
    ],
  },
  {
    date: "2026-08-25",
    title: "首次上线",
    items: [
      "OTP Vault 上线：邮箱验证码、账号密码登录和注册",
      "扫码、手动填写或导入文本添加动态口令",
      "卡片查看当前验证码，支持复制、收藏、搜索和按系统筛选",
      "可以创建临时授权：链接分享或指定用户",
      "可设置访问码、有效期、可见字段和是否允许复制",
      "授权可以随时撤销，删除凭据不影响已经发出的授权快照",
    ],
  },
] as const;

function backToPrevious(event: { preventDefault: () => void }) {
  event.preventDefault();
  try {
    if (document.referrer && new URL(document.referrer).origin === location.origin) {
      history.back();
      return;
    }
  } catch {
    // 没有同源上一页时回到保险库
  }
  location.assign(APP_ROUTES.otp);
}

export default function OtpVaultChangelogPage() {
  useEffect(() => { applyThemePreference(); }, []);

  return <main className="otp-guide-page otp-changelog-page">
    <header className="otp-guide-bar">
      <a className="otp-guide-bar-back" href={APP_ROUTES.otp} onClick={backToPrevious}><ArrowLeft size={16} /><span>返回</span></a>
      <b>更新日志</b>
      <a className="otp-guide-bar-open" href={APP_ROUTES.otp}>打开</a>
    </header>

    <article className="otp-changelog-doc" aria-label="更新记录">
      <p className="otp-changelog-lead">当前版本 {OTP_VAULT_VERSION} · <a href={APP_ROUTES.otpGuide}>使用指南</a></p>
      <div className="otp-changelog-timeline">
        {changelog.map((entry) => <section className="otp-changelog-entry" key={entry.date}>
          <header>
            <time dateTime={entry.date}>{entry.date}</time>
            <h2>{entry.title}</h2>
          </header>
          <ul>{entry.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>)}
      </div>
    </article>
  </main>;
}
