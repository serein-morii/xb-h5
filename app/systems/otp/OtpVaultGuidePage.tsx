import {
  AlertTriangle, ArrowRight, BookOpen, Check, Clock3, Copy, Download, Fingerprint,
  KeyRound, Link2, LockKeyhole, QrCode, ScanLine, Settings2, ShieldCheck, Smartphone, UserCheck,
} from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import "./otp-guide.css";

const navigation = [
  ["quick-start", "快速开始"],
  ["add", "添加凭据"],
  ["use", "查看和使用"],
  ["share", "临时授权"],
  ["security", "安全与备份"],
  ["faq", "常见问题"],
] as const;

const quickSteps = [
  [QrCode, "添加凭据", "扫描服务方二维码，或手动填写 Secret"],
  [Clock3, "使用验证码", "打开卡片查看当前口令和剩余时间"],
  [Link2, "按需分享", "限制时间、字段、复制权限和访问次数"],
  [ShieldCheck, "做好备份", "下载加密备份，并与恢复密码分开保管"],
] as const;

export default function OtpVaultGuidePage() {
  return <main className="otp-guide-page">
    <header className="otp-guide-header">
      <a className="otp-guide-brand" href={APP_ROUTES.otp}><span><KeyRound size={20} /></span><div><b>OTP Vault</b><small>使用指南</small></div></a>
      <nav aria-label="指南快捷导航"><a href="#share">分享说明</a><a href="#faq">问题排查</a></nav>
      <a className="otp-guide-open" href={APP_ROUTES.otp}>打开保险库<ArrowRight size={15} /></a>
    </header>

    <section className="otp-guide-hero">
      <div>
        <span className="otp-guide-eyebrow"><BookOpen size={14} />OTP VAULT GUIDE</span>
        <h1>从第一条验证码开始，安全使用 OTP Vault</h1>
        <p>无需登录即可阅读。跟着图解完成添加、临时授权、备份恢复和安全检查。</p>
        <div className="otp-guide-actions"><a href="#quick-start">从快速开始阅读</a><a href={APP_ROUTES.otp}>登录或注册</a></div>
      </div>
      <figure className="otp-guide-hero-visual" aria-label="OTP Vault 使用流程图">
        <div className="otp-guide-vault-mark"><KeyRound size={30} /></div>
        <div className="otp-guide-route"><span><QrCode size={17} />录入</span><ArrowRight size={15} /><span><Clock3 size={17} />使用</span><ArrowRight size={15} /><span><ShieldCheck size={17} />保护</span></div>
        <figcaption>凭据全流程都在 OTP Vault 内完成</figcaption>
      </figure>
    </section>

    <div className="otp-guide-layout">
      <aside><b>本页目录</b><nav>{navigation.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav><p><ShieldCheck size={14} />不要向任何人发送 OTP Secret、登录密码或恢复密码。</p></aside>

      <article className="otp-guide-content">
        <section id="quick-start" className="otp-guide-section">
          <header><span><Smartphone size={21} /></span><div><h2>快速开始</h2><p>第一次使用时，按下面四步完成基本配置。</p></div></header>
          <ol className="otp-guide-steps">{quickSteps.map(([Icon, title, text], index) => <li key={title}><span>{index + 1}</span><Icon size={20} /><div><b>{title}</b><p>{text}</p></div></li>)}</ol>
          <div className="otp-guide-note"><Clock3 size={17} /><p><b>先校准设备时间</b>动态验证码依赖准确时间。请开启系统的自动日期、自动时间和自动时区。</p></div>
        </section>

        <section id="add" className="otp-guide-section">
          <header><span><ScanLine size={21} /></span><div><h2>添加第一条凭据</h2><p>优先扫描二维码，无法扫码时再手动录入。</p></div></header>
          <div className="otp-guide-split">
            <div className="otp-guide-copy">
              <h3>扫描二维码</h3>
              <ol><li>进入“全部”，点击右上角“添加”。</li><li>选择扫码并允许相机权限。</li><li>将二维码完整放入识别区域。</li><li>核对系统名称和账号后保存。</li></ol>
              <h3>手动录入</h3>
              <p>填写系统名称、账号和服务方提供的 Base32 Secret。多数服务使用 TOTP、SHA1、6 位、30 秒，无明确说明时不用修改。</p>
            </div>
            <figure className="otp-guide-scan-visual">
              <div className="otp-guide-scan-frame"><span /><QrCode size={58} /><span /></div>
              <div className="otp-guide-scan-result"><Check size={17} /><div><b>识别成功</b><small>GitHub · user@example.com</small></div></div>
              <figcaption>支持标准 OTP 二维码和 Google Authenticator 导出二维码</figcaption>
            </figure>
          </div>
          <div className="otp-guide-callout"><AlertTriangle size={18} /><div><b>Secret 不是普通登录密码</b><p>它可以持续生成验证码，只能从服务方的双重验证设置页面获取，不要截图或明文转发。</p></div></div>
        </section>

        <section id="use" className="otp-guide-section">
          <header><span><Clock3 size={21} /></span><div><h2>查看和使用动态口令</h2><p>卡片自动刷新 TOTP，HOTP 则需要手动推进计数器。</p></div></header>
          <div className="otp-guide-split is-reverse">
            <figure className="otp-guide-code-card">
              <div className="otp-guide-code-head"><span>GH</span><div><b>GitHub</b><small>user@example.com</small></div></div>
              <small>动态验证码</small>
              <div className="otp-guide-code"><b>821 443</b><button type="button" aria-label="复制示例验证码"><Copy size={17} /></button></div>
              <div className="otp-guide-code-time"><i /><span><Clock3 size={13} />18 秒后刷新</span></div>
              <figcaption>示例卡片，仅用于说明页面结构</figcaption>
            </figure>
            <div className="otp-guide-copy">
              <h3>日常使用</h3>
              <ul><li>点击复制按钮，将当前验证码粘贴到登录页面。</li><li>点击卡片查看账号、密码、登录地址和备注。</li><li>常用凭据可以收藏，系统较多时开启按系统分组。</li><li>紧凑模式适合电脑大屏或凭据数量较多的场景。</li></ul>
              <h3>验证码不正确</h3>
              <p>先检查设备时间和时区，再核对 Secret、算法、位数和周期。HOTP 还要确保计数器与服务方一致。</p>
            </div>
          </div>
        </section>

        <section id="share" className="otp-guide-section">
          <header><span><Link2 size={21} /></span><div><h2>创建和管理临时授权</h2><p>只开放对方真正需要的内容，并设置尽可能短的有效期。</p></div></header>
          <div className="otp-guide-share-flow" aria-label="临时授权流程图">
            <span>选择凭据</span><ArrowRight size={16} /><span>选择接收方式</span><ArrowRight size={16} /><span>设置权限</span><ArrowRight size={16} /><span>发送或授权</span>
          </div>
          <div className="otp-guide-share-types">
            <section><span><Link2 size={20} /></span><h3>链接分享</h3><p>接收方无需登录。可以设置访问码、有效期、一次性访问和最大访问次数。</p><small>建议通过不同渠道分别发送链接和访问码。</small></section>
            <section><span><UserCheck size={20} /></span><h3>指定用户</h3><p>搜索接收账号，对方登录后会在“全部”中看到共享凭据。</p><small>最高敏感等级的凭据只能使用此方式。</small></section>
          </div>
          <div className="otp-guide-permissions"><b>可单独控制的权限</b><div>{["账号", "登录密码", "动态口令", "登录地址", "备注", "允许复制"].map((item) => <span key={item}><Check size={13} />{item}</span>)}</div></div>
          <div className="otp-guide-note"><Settings2 size={17} /><p><b>有效授权可以继续编辑</b>可以调整凭据、剩余有效期、可见字段、复制权限和访问次数。原链接、访问码、分享方式和接收人不会变化。</p></div>
          <div className="otp-guide-copy-block"><b>复制分享信息时</b><p>允许自动填充访问码时，链接会携带 <code>#k=访问码</code>。关闭自动填充后，链接不携带该片段，访问码仍会单独列出。</p></div>
        </section>

        <section id="security" className="otp-guide-section">
          <header><span><ShieldCheck size={21} /></span><div><h2>安全设置与备份恢复</h2><p>安全功能按需开启，但加密备份应尽早准备。</p></div></header>
          <div className="otp-guide-security-grid">
            <section><Fingerprint size={22} /><h3>敏感操作验证</h3><p>默认关闭。多人共用设备或安全要求较高时建议开启，关键操作前会再次验证身份。</p></section>
            <section><LockKeyhole size={22} /><h3>零知识保护</h3><p>敏感字段在浏览器加密。忘记保护密码无法恢复，并且零知识凭据不能创建服务器分享快照。</p></section>
            <section><Download size={22} /><h3>加密备份</h3><p>下载 .xbvault 文件，将文件和恢复密码分开保存。恢复前可以先校验和预览内容。</p></section>
            <section><Smartphone size={22} /><h3>离线应急</h3><p>可信设备可以保存加密只读副本。凭据发生变化后需要重新更新离线副本。</p></section>
          </div>
          <div className="otp-guide-backup-flow"><span><Download size={17} />下载备份</span><ArrowRight size={15} /><span><LockKeyhole size={17} />分开保管密码</span><ArrowRight size={15} /><span><ShieldCheck size={17} />新设备校验恢复</span></div>
        </section>

        <section id="faq" className="otp-guide-section">
          <header><span><BookOpen size={21} /></span><div><h2>常见问题</h2><p>先按对应检查项排查，通常不需要重新创建账号。</p></div></header>
          <div className="otp-guide-faq">
            <details><summary>扫描不到二维码怎么办？</summary><p>确认相机权限、镜头清洁和画面无反光。仍无法识别时，使用二维码图片识别或手动填写 Secret。</p></details>
            <details><summary>分享链接打不开怎么办？</summary><p>请发送方检查授权是否已到期、撤销、达到访问上限，以及访问码是否正确。</p></details>
            <details><summary>误删凭据还能恢复吗？</summary><p>进入“安全”中的回收站恢复。永久删除后只能从加密备份重新导入。</p></details>
            <details><summary>更换手机怎么迁移？</summary><p>在旧设备创建 .xbvault 加密备份，在新设备登录后校验并恢复。也可以生成迁移二维码导入兼容应用。</p></details>
            <details><summary>发现陌生设备或来源 IP 怎么办？</summary><p>立即在“安全”中撤销设备、退出其他会话并修改登录密码，同时检查最近安全活动。</p></details>
          </div>
        </section>
      </article>
    </div>

    <footer className="otp-guide-footer"><span><ShieldCheck size={15} />安全使用从最小权限和可靠备份开始</span><a href={APP_ROUTES.otp}>进入 OTP Vault<ArrowRight size={14} /></a></footer>
  </main>;
}
