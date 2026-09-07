import { ArrowRight, BookOpen, History, KeyRound, ShieldCheck } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import { OTP_VAULT_VERSION } from "./otpVersion";
import "./otp-guide.css";

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
          "分享者可以在转存列表里移除或禁止某人；移除后对方可再转并存会收到通知，禁止后不能再转且不通知",
          "创建授权时可以一键禁止所有人转存",
          "分享者修改、撤销或删除授权时，已转存的人会收到通知",
        ],
      },
    ],
  },
] as const;

export default function OtpVaultChangelogPage() {
  return <main className="otp-guide-page otp-changelog-page">
    <header className="otp-guide-header">
      <a className="otp-guide-brand" href={APP_ROUTES.otp}><span><KeyRound size={20} /></span><div><b>OTP Vault</b><small>更新日志</small></div></a>
      <nav aria-label="更新日志导航"><a href={APP_ROUTES.otpGuide}>使用指南</a></nav>
      <a className="otp-guide-open" href={APP_ROUTES.otp}>打开保险库<ArrowRight size={15} /></a>
    </header>

    <section className="otp-guide-hero">
      <div>
        <h1>更新日志</h1>
        <p>按时间节点查看最近功能。当前版本 {OTP_VAULT_VERSION}。</p>
        <div className="otp-guide-actions"><a href={APP_ROUTES.otpGuide}>查看使用指南</a><a href={APP_ROUTES.otp}>打开 OTP Vault</a></div>
      </div>
    </section>

    <div className="otp-guide-layout">
      <article className="otp-guide-content">
        <section className="otp-guide-section">
          <header><span><History size={21} /></span><div><h2>时间节点</h2><p>从最近一次更新往前看。</p></div></header>
          <ol className="otp-guide-timeline otp-guide-changelog" aria-label="更新时间节点">
            {changelog.map((entry, index) => <li className="otp-guide-timeline-node" key={entry.date}>
              <span className="otp-guide-timeline-mark" aria-hidden="true" />
              <article>
                <header><time dateTime={entry.date}>{entry.date}</time>{index === 0 ? <small>版本 {OTP_VAULT_VERSION}</small> : null}<b>{entry.title}</b></header>
                {entry.groups.map((group) => <section key={group.name}>
                  <h3>{group.name}</h3>
                  <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>)}
              </article>
            </li>)}
          </ol>
        </section>
        <section className="otp-guide-section">
          <header><span><BookOpen size={21} /></span><div><h2>使用指南</h2><p>需要操作说明时，打开独立的使用指南。</p></div></header>
          <div className="otp-guide-actions"><a href={APP_ROUTES.otpGuide}>打开使用指南<ArrowRight size={15} /></a></div>
        </section>
      </article>
    </div>

    <footer className="otp-guide-footer"><span><ShieldCheck size={15} />安全使用从最小权限和可靠备份开始</span><a href={APP_ROUTES.otpGuide}>查看使用指南<ArrowRight size={14} /></a></footer>
  </main>;
}
