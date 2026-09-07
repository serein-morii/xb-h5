import { useEffect } from "react";
import {
  AlertTriangle, ArrowLeft, Check, Clock3, Download, Fingerprint,
  Link2, LockKeyhole, Mail, Settings2, Smartphone, UserCheck,
} from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import { applyThemePreference } from "../../lib/theme";
import "./otp-guide.css";

const chapters = [
  ["quick-start", "01", "快速开始"],
  ["add", "02", "添加凭据"],
  ["use", "03", "查看和使用"],
  ["share", "04", "临时授权"],
  ["security", "05", "安全与备份"],
  ["faq", "06", "常见问题"],
] as const;

const loginWays = [
  [Mail, "邮箱验证码", "已注册邮箱可直接收取 6 位验证码"],
  [LockKeyhole, "账号密码", "使用账号和密码登录保险库"],
  [Fingerprint, "Passkey", "用本机指纹、面容或系统 PIN 快速登录"],
] as const;

const shareParts = [
  ["授权名称", "出现在列表、授权页和分享文案第一行"],
  ["授权链接", "仅发给需要访问的人"],
  ["访问码", "建议与链接分开发送"],
  ["有效期", "到期后链接立即失效"],
] as const;

export default function OtpVaultGuidePage() {
  useEffect(() => { applyThemePreference(); }, []);

  return <main className="otp-guide-page">
    <header className="otp-guide-bar">
      <a className="otp-guide-bar-back" href={APP_ROUTES.otp}><ArrowLeft size={16} /><span>返回</span></a>
      <b>使用指南</b>
      <a className="otp-guide-bar-open" href={APP_ROUTES.otp}>打开</a>
    </header>

    <article className="otp-guide-doc">
      <header className="otp-guide-lead">
        <p>按使用顺序阅读，从添加第一条凭据开始。大约 5 分钟。<a href={APP_ROUTES.otpChangelog}>更新日志</a></p>
      </header>

      <nav className="otp-guide-toc" aria-label="章节目录">
        {chapters.map(([id, no, label]) => <a href={`#${id}`} key={id}><em>{no}</em>{label}</a>)}
      </nav>

      <section id="quick-start" className="otp-guide-chapter">
        <header><em>01</em><div><h2>快速开始</h2><p>先登录，再按顺序完成录入、使用和备份。</p></div></header>
        <div className="otp-guide-prose">
          <h3>登录方式</h3>
          <div className="otp-guide-methods">{loginWays.map(([Icon, title, text]) => <section key={title}><Icon size={16} /><b>{title}</b><p>{text}</p></section>)}</div>
          <ol className="otp-guide-steps">
            <li><b>添加凭据</b><p>扫描服务方二维码，或手动填写 Secret。</p></li>
            <li><b>使用验证码</b><p>打开卡片查看当前口令和剩余时间。</p></li>
            <li><b>按需分享</b><p>先命名授权，再限制时间和可见字段。</p></li>
            <li><b>做好备份</b><p>下载加密备份，并与恢复密码分开保管。</p></li>
          </ol>
          <div className="otp-guide-copy-block"><b>邮箱还没有注册</b><p>验证码校验完成后，页面会询问是否创建账号。确认后会保留邮箱，并转到注册流程重新获取注册验证码。</p></div>
          <div className="otp-guide-copy-block"><b>添加到桌面</b><p>登录页和保险库会出现安装提示。Chrome 可直接点“安装”；苹果浏览器按系统版本从分享菜单选择“添加到桌面”。已经是独立窗口，或关掉过提示，就不会再出现。</p></div>
          <aside className="otp-guide-note"><Clock3 size={16} /><div><b>先校准设备时间</b><p>打开保险库会和服务器对时。偏差达到约 2 秒会提示“请打开自动时间”。请开启系统的自动日期、自动时间和自动时区。“保持登录 15 天”只建议在自己的设备上开启。</p></div></aside>
        </div>
      </section>

      <section id="add" className="otp-guide-chapter">
        <header><em>02</em><div><h2>添加凭据</h2><p>优先扫描二维码，无法扫码时再手动录入或导入文本。</p></div></header>
        <div className="otp-guide-prose">
          <h3>扫描二维码</h3>
          <ol>
            <li>进入“全部”，点击顶部“导入”。</li>
            <li>选择“单条录入”，再选择扫码并允许相机权限。</li>
            <li>将二维码完整放入识别区域。</li>
            <li>核对系统名称和账号后保存；多条迁移请选择“批量导入”。</li>
          </ol>
          <p>支持标准 OTP 二维码和 Google Authenticator 导出二维码。</p>
          <h3>手动录入</h3>
          <p>填写系统名称、账号和服务方提供的 Base32 Secret。多数服务使用 TOTP、SHA1、6 位、30 秒，无明确说明时不用修改。</p>
          <h3>导入文本</h3>
          <p>如果已有包含 <code>otpauth://</code> 地址的文本，可在首页点击“导入”。导入前先确认文件来源可信。</p>
          <h3>重复添加</h3>
          <p>同一系统和账号可以重复添加，例如两台设备各自的验证码。保存或批量导入时如果已经有相同系统和账号，会先确认，确认后仍可保存。</p>
          <aside className="otp-guide-callout"><AlertTriangle size={16} /><div><b>Secret 不是普通登录密码</b><p>它可以持续生成验证码，只能从服务方的双重验证设置页面获取，不要截图或明文转发。</p></div></aside>
        </div>
      </section>

      <section id="use" className="otp-guide-chapter">
        <header><em>03</em><div><h2>查看和使用</h2><p>卡片自动刷新 TOTP，HOTP 则需要手动推进计数器。</p></div></header>
        <div className="otp-guide-prose">
          <h3>日常使用</h3>
          <ul>
            <li>点击复制按钮，将当前验证码粘贴到登录页面。约 30 秒后会清空剪贴板；已经贴走或剪贴板被改过时不会误清。</li>
            <li>点击卡片查看账号、密码、登录地址和备注。</li>
            <li>常用凭据可以收藏；系统较多时开启按系统分组。</li>
            <li>紧凑模式适合电脑大屏或凭据数量较多的场景。</li>
            <li>显示和排序开关在“我的”页的“外观和显示”里。</li>
          </ul>
          <h3>验证码不正确</h3>
          <p>先检查设备时间和时区，再核对 Secret、算法、位数和周期。HOTP 还要确保计数器与服务方一致。</p>
        </div>
      </section>

      <section id="share" className="otp-guide-chapter">
        <header><em>04</em><div><h2>临时授权</h2><p>先给授权起名，只开放对方真正需要的内容，并设置尽可能短的有效期。</p></div></header>
        <div className="otp-guide-prose">
          <ol className="otp-guide-steps">
            <li><b>选择凭据</b><p>勾选要分享的项目，单次最多 50 条。</p></li>
            <li><b>命名授权</b><p>例如“给同事的临时访问”，不填则为“临时凭据授权”。</p></li>
            <li><b>设置权限</b><p>选择可见字段、复制权限、有效期和访问次数。</p></li>
            <li><b>发送或授权</b><p>用链接分享，或指定用户登录后查看。</p></li>
          </ol>
          <div className="otp-guide-share-types">
            <section><span><Link2 size={18} /></span><h3>链接分享</h3><p>接收方无需登录。可以设置访问码、有效期、一次性访问和最大访问次数。</p><small>建议通过不同渠道分别发送链接和访问码。</small></section>
            <section><span><UserCheck size={18} /></span><h3>指定用户</h3><p>搜索接收账号，对方登录后会在“全部”和“我收到的”中看到共享凭据。</p><small>最高敏感等级的凭据只能使用此方式。</small></section>
          </div>
          <div className="otp-guide-copy-block"><b>给授权起个名字</b><p>创建时可填写授权名称，例如“给同事的临时访问”。不填时默认为“临时凭据授权”。名称会出现在你的授权列表、对方打开的授权页，以及复制出来的分享文案第一行。</p></div>
          <div className="otp-guide-copy-block"><b>我发出的和我收到的</b><p>授权页分成两个标签。“我发出的”是你创建的授权，可以编辑、撤销和查看转存列表；“我收到的”是别人指定给你的授权，以及你从链接转存进来的。</p></div>
          <div className="otp-guide-copy-block"><b>转存到我收到的</b><p>登录后打开别人的分享链接，可以转存到自己的“我收到的”。不转存也能继续查看原链接。已经转存过会提示无需再次转存。回到保险库时，如果剪贴板里正好是授权链接，也会询问是否转存；空剪贴板或普通文字不会弹出。</p></div>
          <div className="otp-guide-copy-block"><b>转存列表</b><p>链接分享的详情里可以看到谁转存了。移除后对方可再转存，并会收到通知；禁止后对方不能自行转存，且不会通知。创建授权时也可以打开“禁止转存”，一键禁止所有人。分享者修改、撤销或删除授权时，已转存的人同样会收到通知。</p></div>
          <div className="otp-guide-anatomy" aria-label="分享文案包含的字段">
            <b>复制按钮会带出这些信息</b>
            <ol>{shareParts.map(([title, text]) => <li key={title}><span>{title}</span><small>{text}</small></li>)}</ol>
          </div>
          <div className="otp-guide-permissions"><b>可单独控制的权限</b><div>{["账号", "登录密码", "动态口令", "登录地址", "备注", "允许复制"].map((item) => <span key={item}><Check size={12} />{item}</span>)}</div></div>
          <aside className="otp-guide-note"><Settings2 size={16} /><div><b>有效授权可以继续编辑</b><p>可以调整名称、凭据、剩余有效期、可见字段、复制权限和访问次数。原链接、访问码、分享方式和接收人不会变化。</p></div></aside>
        </div>
      </section>

      <section id="security" className="otp-guide-chapter">
        <header><em>05</em><div><h2>安全与备份</h2><p>安全功能按需开启，但加密备份应尽早准备。</p></div></header>
        <div className="otp-guide-prose">
          <div className="otp-guide-security-grid">
            <section><Fingerprint size={18} /><h3>敏感操作验证</h3><p>默认关闭。开启后可用邮箱、密码或 Passkey 验证；更新登录密码也支持 Passkey。</p></section>
            <section><LockKeyhole size={18} /><h3>零知识保护</h3><p>敏感字段在浏览器加密。忘记保护密码无法恢复，并且零知识凭据不能创建服务器分享快照。</p></section>
            <section><Download size={18} /><h3>加密备份</h3><p>下载 .xbvault 文件，将文件和恢复密码分开保存。恢复前可以先校验和预览内容。</p></section>
            <section><Smartphone size={18} /><h3>离线应急</h3><p>可信设备可以保存加密只读副本。启用后，登录以及增删改、导入凭据会自动更新本机副本。</p></section>
          </div>
          <ol className="otp-guide-steps">
            <li><b>下载备份</b><p>在安全页导出加密的 .xbvault 文件。</p></li>
            <li><b>分开保管密码</b><p>恢复密码不要和备份文件放在一起。</p></li>
            <li><b>新设备校验恢复</b><p>登录后先校验，再导入。</p></li>
          </ol>
          <div className="otp-guide-copy-block"><b>设备与回收站</b><p>在“安全”里可以查看登录设备、撤销陌生会话，以及从回收站恢复误删凭据。永久删除后只能靠加密备份找回。</p></div>
        </div>
      </section>

      <section id="faq" className="otp-guide-chapter">
        <header><em>06</em><div><h2>常见问题</h2><p>先按对应检查项排查，通常不需要重新创建账号。</p></div></header>
        <div className="otp-guide-faq">
          <details><summary>扫描不到二维码怎么办？</summary><p>确认相机权限、镜头清洁和画面无反光。仍无法识别时，使用二维码图片识别或手动填写 Secret。</p></details>
          <details><summary>验证码一直不正确怎么办？</summary><p>先开启设备的自动日期、自动时间和自动时区，再核对 Secret、算法、位数和周期是否与服务方一致。</p></details>
          <details><summary>分享链接打不开怎么办？</summary><p>请发送方检查授权是否已到期、撤销、达到访问上限，以及访问码是否正确。</p></details>
          <details><summary>授权名称对方能看到吗？</summary><p>能。名称会显示在授权页标题和分享文案第一行，请不要写入敏感信息。</p></details>
          <details><summary>误删凭据还能恢复吗？</summary><p>进入“安全”中的回收站恢复。永久删除后只能从加密备份重新导入。</p></details>
          <details><summary>更换手机怎么迁移？</summary><p>在旧设备创建 .xbvault 加密备份，在新设备登录后校验并恢复。也可以生成迁移二维码导入兼容应用。</p></details>
          <details><summary>没有原密码还能修改登录密码吗？</summary><p>可以使用绑定邮箱验证码，或选择已绑定的 Passkey，通过指纹、面容或设备 PIN 验证后修改。</p></details>
          <details><summary>发现陌生设备或来源 IP 怎么办？</summary><p>立即在“安全”中撤销设备、退出其他会话并修改登录密码，同时检查最近安全活动。</p></details>
          <details><summary>为什么提示已存在相同系统和账号？</summary><p>同一系统和账号可以重复添加。这是确认，不是拦截。确认后仍会保存，适合两台设备各自的验证码。</p></details>
          <details><summary>访问码链接第二次打开为什么会卡住？</summary><p>现在第二次打开会直接复用已有会话，不再停在“验证授权”。如果仍卡住，请硬刷新后再试。</p></details>
        </div>
      </section>
    </article>
  </main>;
}
