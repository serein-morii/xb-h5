import { APP_ROUTES } from "../lib/pathConventions";

const PEACH_IMAGES = {
  hero: "/images/peach-official/hero-modern-v2.webp",
  peach: "/images/peach-official/yanling-peach-line.svg",
  orchard: "/images/peach-official/yanling-orchard-line.svg",
  harvest: "/images/peach-official/yanling-harvest-line.svg",
};

const pages = [
  { index: "01", label: "开场", tone: "front" },
  { index: "02", label: "桃子", tone: "peach" },
  { index: "03", label: "山里", tone: "orchard" },
  { index: "04", label: "采收", tone: "harvest" },
  { index: "05", label: "登录", tone: "login" },
];

export default function PeachHome() {
  return (
    <main className="peach-snap-home" aria-label="炎陵黄桃品牌首页">
      <aside className="peach-snap-progress" aria-hidden="true">
        {pages.map((page) => <span key={page.index}>{page.index}</span>)}
      </aside>
      <a className="peach-lab-portal" href={APP_ROUTES.lab} aria-label="打开 Handy Lab 灵感实验室">
        <span className="peach-lab-orbit" aria-hidden="true"><i /><i /><i /></span>
        <span className="peach-lab-copy"><small>HANDY</small><b>LAB</b></span>
        <span className="peach-lab-arrow" aria-hidden="true">↗</span>
      </a>

      <section className="peach-snap-panel peach-snap-panel-hero" aria-labelledby="peach-snap-title">
        <div className="peach-snap-mark" aria-hidden="true">
          <span>YANLING</span>
          <b>PEACH</b>
        </div>
        <div className="peach-snap-copy">
          <p>炎陵黄桃</p>
          <h1 id="peach-snap-title">把盛夏装进清甜里</h1>
          <span>山风经过果园，甜意慢慢醒来。成熟的黄桃，不必说得太响。</span>
          <a className="peach-snap-login" href={APP_ROUTES.customerLogin}>用户登录</a>
        </div>
        <figure className="peach-snap-hero-fruit">
          <img src={PEACH_IMAGES.hero} alt="炎陵黄桃果实" width="1160" height="1320" fetchPriority="high" />
        </figure>
        <div className="peach-snap-page-no" aria-hidden="true">01 / 05</div>
      </section>

      <section className="peach-snap-panel peach-snap-panel-image peach-snap-panel-sketch peach-snap-panel-peach" aria-labelledby="peach-snap-peach">
        <figure>
          <img src={PEACH_IMAGES.peach} alt="炎陵黄桃果实线稿" width="1600" height="1067" loading="lazy" decoding="async" />
        </figure>
        <div className="peach-snap-glass">
          <p>桃子</p>
          <h2 id="peach-snap-peach">果香清亮，软糯里带着山风的甜。</h2>
        </div>
        <div className="peach-snap-page-no" aria-hidden="true">02 / 05</div>
      </section>

      <section className="peach-snap-panel peach-snap-panel-image peach-snap-panel-sketch peach-snap-panel-orchard" aria-labelledby="peach-snap-origin">
        <figure>
          <img src={PEACH_IMAGES.orchard} alt="炎陵山地黄桃果园线稿" width="1600" height="1067" loading="lazy" decoding="async" />
        </figure>
        <div className="peach-snap-glass peach-snap-glass-right">
          <p>山里</p>
          <h2 id="peach-snap-origin">日照、晨雾、昼夜温差，把清甜养得很轻。</h2>
        </div>
        <div className="peach-snap-page-no" aria-hidden="true">03 / 05</div>
      </section>

      <section className="peach-snap-panel peach-snap-panel-image peach-snap-panel-sketch peach-snap-panel-fruit" aria-labelledby="peach-snap-flavor">
        <figure>
          <img src={PEACH_IMAGES.harvest} alt="炎陵黄桃采收竹筐线稿" width="1600" height="1067" loading="lazy" decoding="async" />
        </figure>
        <div className="peach-snap-glass">
          <p>采收</p>
          <h2 id="peach-snap-flavor">成熟再摘，轻轻入筐，把新鲜留在路上。</h2>
        </div>
        <div className="peach-snap-page-no" aria-hidden="true">04 / 05</div>
      </section>

      <section className="peach-snap-panel peach-snap-panel-login" aria-labelledby="peach-snap-login-title">
        <div className="peach-snap-login-card">
          <p>专属入口</p>
          <h2 id="peach-snap-login-title">登录后，进入你的下单与订单进度。</h2>
          <span>还没有账号？登录页里可以注册。已有订单，也可以在底部轻轻查一下。</span>
          <a className="peach-snap-login" href={APP_ROUTES.customerLogin}>用户登录</a>
          <nav aria-label="弱化入口">
            <a href={APP_ROUTES.toolOrderSearch}>订单查询</a>
            <a href={APP_ROUTES.manage}>管理入口</a>
          </nav>
        </div>
        <footer className="peach-snap-footer">
          <strong>炎陵黄桃</strong>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a>
        </footer>
        <div className="peach-snap-page-no" aria-hidden="true">05 / 05</div>
      </section>
    </main>
  );
}
