import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, Clock3, Download, Fingerprint,
  Link2, List, LockKeyhole, Mail, Settings2, Smartphone, UserCheck, X,
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

type FlowNode =
  | { type: "start" | "end" | "step"; text: string; note?: string }
  | { type: "choice"; text: string; yes: string; no: string; yesLabel?: string; noLabel?: string };

function GuideFlow({ label, nodes }: { label: string; nodes: FlowNode[] }) {
  return <div className="otp-guide-flow" role="img" aria-label={label}>
    <div className="otp-guide-flow-caption">{label}</div>
    {nodes.map((node, index) => <Fragment key={`${label}-${index}`}>
      {index ? nodes[index - 1].type === "choice"
        ? <i className="otp-guide-flow-merge" aria-hidden="true"><svg viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M25 0 V8 H50 V20 M75 0 V8 H50" /></svg></i>
        : <i className="otp-guide-flow-arrow" aria-hidden="true" />
      : null}
      {node.type === "choice" ? <div className="otp-guide-flow-choice">
        <div className="otp-guide-flow-diamond"><span>{node.text}</span></div>
        <i className="otp-guide-flow-arrow" aria-hidden="true" />
        <div className="otp-guide-flow-fork">
          <svg viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0 V8 H25 V16 M50 8 H75 V16" /></svg>
          <div><small>{node.yesLabel || "是"}</small><div className="otp-guide-flow-node">{node.yes}</div></div>
          <div><small>{node.noLabel || "否"}</small><div className="otp-guide-flow-node">{node.no}</div></div>
        </div>
      </div> : <div className={`otp-guide-flow-node is-${node.type}`}>
        {node.note ? <><b>{node.text}</b><p>{node.note}</p></> : node.text}
      </div>}
    </Fragment>)}
  </div>;
}

function GuideToc() {
  const [open, setOpen] = useState(false);
  return <div className={`otp-guide-toc${open ? " is-open" : ""}`}>
    {open ? <button type="button" className="otp-guide-toc-mask" aria-label="关闭目录" onClick={() => setOpen(false)} /> : null}
    {open ? <nav aria-label="章节目录">{chapters.map(([id, no, label]) => <a href={`#${id}`} key={id} onClick={() => setOpen(false)}><em>{no}</em>{label}</a>)}</nav> : null}
    <button type="button" className="otp-guide-toc-toggle" aria-expanded={open} aria-label="章节目录" onClick={() => setOpen((value) => !value)}>
      {open ? <X size={15} /> : <List size={15} />}
      <span>{open ? "关闭" : "目录"}</span>
    </button>
  </div>;
}

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

export default function OtpVaultGuidePage() {
  useEffect(() => { applyThemePreference(); }, []);

  return <main className="otp-guide-page">
    <header className="otp-guide-bar">
      <a className="otp-guide-bar-back" href={APP_ROUTES.otp} onClick={backToPrevious}><ArrowLeft size={16} /><span>返回</span></a>
      <b>使用指南</b>
      <a className="otp-guide-bar-open" href={APP_ROUTES.otp}>打开</a>
    </header>

    <article className="otp-guide-doc">
      <header className="otp-guide-lead">
        <p>按使用顺序阅读，从添加第一条凭据开始。大约 5 分钟。<a href={APP_ROUTES.otpChangelog}>更新日志</a></p>
      </header>

      <GuideToc />

      <section id="quick-start" className="otp-guide-chapter">
        <header><em>01</em><div><h2>快速开始</h2><p>先登录，再按顺序完成录入、使用和备份。</p></div></header>
        <div className="otp-guide-prose">
          <h3>登录方式</h3>
          <div className="otp-guide-methods">{loginWays.map(([Icon, title, text]) => <section key={title}><Icon size={14} /><b>{title}</b><p>{text}</p></section>)}</div>
          <GuideFlow label="日常路径" nodes={[
            { type: "start", text: "打开 OTP Vault" },
            { type: "step", text: "登录或注册", note: "邮箱验证码、账号密码或 Passkey" },
            { type: "step", text: "点添加按钮" },
            { type: "step", text: "复制验证码去登录" },
            { type: "choice", text: "要分享吗", yes: "创建临时授权", no: "只自己用" },
            { type: "step", text: "下载加密备份" },
            { type: "end", text: "可以日常使用" },
          ]} />
          <div className="otp-guide-copy-block"><b>邮箱还没有注册</b><p>验证码校验完成后，页面会询问是否创建账号。确认后会保留邮箱，并转到注册流程重新获取注册验证码。</p></div>
          <GuideFlow label="添加到桌面" nodes={[
            { type: "start", text: "打开登录页或保险库" },
            { type: "choice", text: "有安装提示", yes: "按提示安装", no: "已是独立窗口或关过" },
            { type: "step", text: "Chrome 点安装；苹果从分享菜单选添加到桌面" },
            { type: "end", text: "之后像 App 打开" },
          ]} />
          <aside className="otp-guide-note"><Clock3 size={14} /><div><b>先校准设备时间</b><p>打开保险库会和服务器对时。偏差达到约 2 秒会提示“请打开自动时间”。请开启系统的自动日期、自动时间和自动时区。“保持登录 15 天”只建议在自己的设备上开启。</p></div></aside>
        </div>
      </section>

      <section id="add" className="otp-guide-chapter">
        <header><em>02</em><div><h2>添加凭据</h2><p>优先扫描二维码，无法扫码时再手动录入或导入文本。</p></div></header>
        <div className="otp-guide-prose">
          <GuideFlow label="添加凭据" nodes={[
            { type: "start", text: "进入凭据页" },
            { type: "step", text: "点添加" },
            { type: "choice", text: "有二维码吗", yes: "允许相机并扫描", no: "手动填或导入文本", yesLabel: "有", noLabel: "没有" },
            { type: "choice", text: "账号已存在", yes: "确认后仍保存", no: "直接保存" },
            { type: "end", text: "首页出现卡片" },
          ]} />
          <h3>扫描二维码</h3>
          <ol>
            <li>进入凭据页，点添加。</li>
            <li>选择扫码，并允许相机权限；多条迁移选“批量导入”。</li>
            <li>将二维码完整放入识别区域。</li>
            <li>核对系统名称和账号后保存。</li>
          </ol>
          <p>支持标准 OTP 二维码和 Google Authenticator 导出二维码。</p>
          <h3>手动录入</h3>
          <p>填写系统名称、账号和服务方提供的 Base32 Secret。多数服务使用 TOTP、SHA1、6 位、30 秒，无明确说明时不用修改。</p>
          <h3>导入文本</h3>
          <p>如果已有包含 <code>otpauth://</code> 地址的文本，点添加后选择导入。导入前先确认文件来源可信。</p>
          <h3>重复添加</h3>
          <p>同一系统和账号可以重复添加，例如两台设备各自的验证码。保存或批量导入时如果已经有相同系统和账号，会先确认，确认后仍可保存。</p>
          <aside className="otp-guide-callout"><AlertTriangle size={14} /><div><b>Secret 不是普通登录密码</b><p>它可以持续生成验证码，只能从服务方的双重验证设置页面获取，不要截图或明文转发。</p></div></aside>
        </div>
      </section>

      <section id="use" className="otp-guide-chapter">
        <header><em>03</em><div><h2>查看和使用</h2><p>卡片自动刷新 TOTP，HOTP 则需要手动推进计数器。</p></div></header>
        <div className="otp-guide-prose">
          <GuideFlow label="使用验证码" nodes={[
            { type: "start", text: "打开凭据卡片" },
            { type: "step", text: "点复制", note: "也可点卡片看账号、密码和备注" },
            { type: "step", text: "粘贴到登录页" },
            { type: "step", text: "约 30 秒后清空剪贴板", note: "已经贴走或剪贴板被改过时不会误清" },
            { type: "choice", text: "验证码不对", yes: "开自动时间，再核对 Secret", no: "继续使用" },
            { type: "end", text: "完成登录" },
          ]} />
          <h3>日常使用</h3>
          <ul>
            <li>常用凭据可以收藏；系统较多时开启按系统分组。</li>
            <li>紧凑模式适合电脑大屏或凭据数量较多的场景。</li>
            <li>显示和排序开关在“我的”页的“显示”里。</li>
          </ul>
        </div>
      </section>

      <section id="share" className="otp-guide-chapter">
        <header><em>04</em><div><h2>临时授权</h2><p>先给授权起名，只开放对方真正需要的内容，并设置尽可能短的有效期。</p></div></header>
        <div className="otp-guide-prose">
          <GuideFlow label="创建授权" nodes={[
            { type: "start", text: "从卡片分享，或授权页点创建授权" },
            { type: "step", text: "勾选凭据", note: "单次最多 50 条" },
            { type: "step", text: "填写授权名称", note: "不填则为临时凭据授权" },
            { type: "choice", text: "发给谁", yes: "链接分享，可设访问码", no: "指定用户，对方登录后看", yesLabel: "链接", noLabel: "指定用户" },
            { type: "step", text: "选择可见字段、复制、有效期" },
            { type: "end", text: "发送或授权完成" },
          ]} />
          <div className="otp-guide-share-types">
            <section><span><Link2 size={16} /></span><h3>链接分享</h3><p>接收方无需登录。可以设置访问码、有效期、一次性访问和最大访问次数。</p><small>建议通过不同渠道分别发送链接和访问码。</small></section>
            <section><span><UserCheck size={16} /></span><h3>指定用户</h3><p>搜索接收账号，对方登录后会在“全部”和“我收到的”中看到共享凭据。</p><small>最高敏感等级的凭据只能使用此方式。</small></section>
          </div>
          <GuideFlow label="转存别人的授权" nodes={[
            { type: "start", text: "拿到授权链接" },
            { type: "choice", text: "从哪打开", yes: "打开授权链接", no: "回到保险库，剪贴板里正好是授权链接", yesLabel: "链接", noLabel: "剪贴板" },
            { type: "choice", text: "已经转存过", yes: "提示无需再转", no: "可转存到我收到的" },
            { type: "end", text: "不转存也能继续看原链接" },
          ]} />
          <GuideFlow label="带访问码的链接" nodes={[
            { type: "start", text: "打开带访问码的链接" },
            { type: "choice", text: "第一次打开", yes: "输入访问码", no: "第二次打开会直接进入内容" },
            { type: "end", text: "查看允许的字段" },
          ]} />
          <div className="otp-guide-copy-block"><b>给授权起个名字</b><p>创建时可填写授权名称，例如“给同事的临时访问”。不填时默认为“临时凭据授权”。名称会出现在你的授权列表、对方打开的授权页，以及复制出来的分享文案第一行。</p></div>
          <div className="otp-guide-copy-block"><b>我发出的和我收到的</b><p>授权页分成两个标签。“我发出的”是你创建的授权，可以编辑、撤销和查看转存列表；“我收到的”是别人指定给你的授权，以及你从链接转存进来的。</p></div>
          <div className="otp-guide-copy-block"><b>转存列表</b><p>链接分享的详情里可以看到谁转存了。移除后对方可再转存，并会收到通知；禁止后对方不能自行转存，且不会通知。创建授权时也可以打开“禁止转存”，一键禁止所有人。分享者修改、撤销或删除授权时，已转存的人同样会收到通知。</p></div>
          <div className="otp-guide-anatomy" aria-label="分享文案包含的字段">
            <b>复制按钮会带出这些信息</b>
            <ol>{shareParts.map(([title, text]) => <li key={title}><span>{title}</span><small>{text}</small></li>)}</ol>
          </div>
          <div className="otp-guide-permissions"><b>可单独控制的权限</b><div>{["账号", "登录密码", "动态口令", "登录地址", "备注", "允许复制"].map((item) => <span key={item}><Check size={11} />{item}</span>)}</div></div>
          <aside className="otp-guide-note"><Settings2 size={14} /><div><b>有效授权可以继续编辑</b><p>可以调整名称、凭据、剩余有效期、可见字段、复制权限和访问次数。原链接、访问码、分享方式和接收人不会变化。</p></div></aside>
        </div>
      </section>

      <section id="security" className="otp-guide-chapter">
        <header><em>05</em><div><h2>安全与备份</h2><p>安全功能按需开启，但加密备份应尽早准备。</p></div></header>
        <div className="otp-guide-prose">
          <div className="otp-guide-security-grid">
            <section><Fingerprint size={16} /><h3>敏感操作验证</h3><p>默认关闭。开启后可用邮箱、密码或 Passkey 验证。登录、改密和敏感操作都可使用 Passkey。</p></section>
            <section><LockKeyhole size={16} /><h3>锁屏</h3><p>顶栏小锁可随时锁定。未设置密码时会先设置 4 位或 6 位数字，或复杂密码。Passkey 解锁必须先有锁屏密码。自动锁屏在「我的 → 安全」设置。</p></section>
            <section><LockKeyhole size={16} /><h3>零知识保护</h3><p>敏感字段在浏览器加密。忘记保护密码无法恢复，并且零知识凭据不能创建服务器分享快照。</p></section>
            <section><Download size={16} /><h3>加密备份</h3><p>下载 .xbvault 文件，将文件和恢复密码分开保存。恢复前可以先校验和预览内容。</p></section>
            <section><Smartphone size={16} /><h3>离线应急</h3><p>可信设备可以保存加密只读副本。启用后，登录以及增删改、导入凭据会自动更新本机副本。</p></section>
          </div>
          <GuideFlow label="加密备份" nodes={[
            { type: "start", text: "我的 → 安全" },
            { type: "step", text: "导出 .xbvault" },
            { type: "step", text: "恢复密码和文件分开保管" },
            { type: "step", text: "新设备登录后先校验再导入" },
            { type: "end", text: "换机也能找回" },
          ]} />
          <div className="otp-guide-copy-block"><b>设备与回收站</b><p>在“我的 → 安全”可以查看登录设备、撤销陌生会话，以及从回收站恢复误删凭据。永久删除后只能靠加密备份找回。账号、通知、显示、安全和关于都在“我的”里。</p></div>
        </div>
      </section>

      <section id="faq" className="otp-guide-chapter">
        <header><em>06</em><div><h2>常见问题</h2><p>先按对应检查项排查，通常不需要重新创建账号。</p></div></header>
        <div className="otp-guide-faq">
          <details><summary>扫描不到二维码怎么办？</summary><p>确认相机权限、镜头清洁和画面无反光。仍无法识别时，使用二维码图片识别或手动填写 Secret。</p></details>
          <details><summary>验证码一直不正确怎么办？</summary><p>先开启设备的自动日期、自动时间和自动时区，再核对 Secret、算法、位数和周期是否与服务方一致。</p></details>
          <details><summary>分享链接打不开怎么办？</summary><p>请发送方检查授权是否已到期、撤销、达到访问上限，以及访问码是否正确。</p></details>
          <details><summary>授权名称对方能看到吗？</summary><p>能。名称会显示在授权页标题和分享文案第一行，请不要写入敏感信息。</p></details>
          <details><summary>误删凭据还能恢复吗？</summary><p>进入“我的 → 安全”的回收站恢复。永久删除后只能从加密备份重新导入。</p></details>
          <details><summary>更换手机怎么迁移？</summary><p>在旧设备创建 .xbvault 加密备份，在新设备登录后校验并恢复。也可以生成迁移二维码导入兼容应用。</p></details>
          <details><summary>没有原密码还能修改登录密码吗？</summary><p>可以使用绑定邮箱验证码，或选择已绑定的 Passkey，通过指纹、面容或设备 PIN 验证后修改。</p></details>
          <details><summary>发现陌生设备或来源 IP 怎么办？</summary><p>立即在“我的 → 安全”撤销设备、退出其他会话并修改登录密码，同时检查最近安全活动。</p></details>
          <details><summary>锁屏密码忘了怎么办？</summary><p>锁屏不等于退出账号。若开了 Passkey 解锁，可用本机指纹或面容打开，然后再到「我的 → 安全」修改锁屏密码。Passkey 也不可用时，需要能验证登录身份的设备再处理。</p></details>
          <details><summary>为什么提示已存在相同系统和账号？</summary><p>同一系统和账号可以重复添加。这是确认，不是拦截。确认后仍会保存，适合两台设备各自的验证码。</p></details>
          <details><summary>访问码链接第二次打开为什么会卡住？</summary><p>现在第二次打开会直接进入内容，不再停在“验证授权”。如果仍卡住，请硬刷新后再试。</p></details>
        </div>
      </section>
    </article>
  </main>;
}
