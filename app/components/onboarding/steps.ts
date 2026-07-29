import type { OnboardingStep } from "./OnboardingContext";

/** 给外部注册"打开菜单"等命令的回调；onMount 时设置 */
let onOpenMenu: (() => void) | null = null;
let onCloseMenu: (() => void) | null = null;
export function registerOnboardingCommands(commands: { openMenu: () => void; closeMenu: () => void }) {
  onOpenMenu = commands.openMenu;
  onCloseMenu = commands.closeMenu;
}
export function unregisterOnboardingCommands() {
  onOpenMenu = null;
  onCloseMenu = null;
}

const isPage = (id: string): string => `page-${id}`;

/**
 * 等菜单 sheet 滑入动画结束（CSS 是 sheet-up .22s ease-out）。
 * 不等的话，点击"全部"后立即切到菜单分组那一步，rect 是在动画中途抓的，
 * spotlight 会被画在错的位置（看起来像"框在下面那个页面"）。
 */
function waitForMenuAnimation(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(); return; }
    const sheet = document.querySelector(".sheet") as (Element & { getAnimations?: () => Animation[] }) | null;
    if (!sheet) { resolve(); return; }
    // 用 Web Animations API 拿当前正在跑的动画；如果没有在跑就直接 resolve
    const animations = sheet.getAnimations?.() ?? [];
    const running = animations.filter((a) => a.playState === "running");
    if (running.length === 0) { resolve(); return; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      running.forEach((a) => a.removeEventListener("finish", finish));
      resolve();
    };
    running.forEach((a) => a.addEventListener("finish", finish));
    // 兜底：500ms 后强制 resolve
    setTimeout(finish, 500);
  });
}

/** 系统引导：首次登录后跑一次，看完标记 systemDone=true */
export function getSystemTourSteps(): OnboardingStep[] {
  return [
    {
      id: "__system-welcome",
      title: "欢迎使用喜八订单管理 👋",
      body: "我会用 30 秒带你认识这个 App 的核心模块、底部 dock 和菜单栏。点「开始」我们出发。",
      placement: "center",
    },
    {
      id: "dock-home",
      title: "首页 · 总览",
      body: "回到这里看实时数据：待处理订单、快捷入口、最近动态。",
      target: "[data-onboard='dock-home']",
      placement: "top",
    },
    {
      id: "dock-orders",
      title: "订单 · 处理中心",
      body: "所有订单都在这里：填快递、发货、改地址、删除、查详情。",
      target: "[data-onboard='dock-orders']",
      placement: "top",
    },
    {
      id: "dock-create",
      title: "录单 · 快速下单",
      body: "点中间的「+」录入一笔订单。批量录单从菜单进入。",
      target: "[data-onboard='dock-create']",
      placement: "top",
    },
    {
      id: "dock-bills",
      title: "账单 · 财务对账",
      body: "查看对账单、快递费、平台扣点，按店铺维度统计。",
      target: "[data-onboard='dock-bills']",
      placement: "top",
    },
    {
      id: "dock-menu",
      title: "全部 · 功能入口",
      body: "点这里打开「全部功能」菜单。",
      target: "[data-onboard='dock-menu']",
      placement: "top",
      awaitClick: true,
      clickHint: "请点下方高亮的「全部」按钮打开菜单",
    },
    {
      id: "menu-group-orders",
      title: "订单处理组",
      body: "「批量录单」「链接下单」「物流跟踪」—— 进店到发货的全套工具。",
      target: "[data-onboard='menu-group-orders']",
      placement: "bottom",
      beforeEnter: async () => {
        onOpenMenu?.();
        await waitForMenuAnimation();
      },
    },
    {
      id: "menu-group-manage",
      title: "经营管理组",
      body: "「快递」「价格」「店铺」「短链」等：维护发货配置、成本与对外链接。",
      target: "[data-onboard='menu-group-manage']",
      placement: "bottom",
      beforeEnter: waitForMenuAnimation,
    },
    {
      id: "menu-group-buyer",
      title: "买家服务组",
      body: "「买家管理」「生成链接」：维护老客户的专属下单入口。",
      target: "[data-onboard='menu-group-buyer']",
      placement: "bottom",
      beforeEnter: waitForMenuAnimation,
    },
    {
      id: "menu-group-tracking",
      title: "查询工具组",
      body: "「物流跟踪」：全局物流监控，在途/签收/滞留的订单一目了然。",
      target: "[data-onboard='menu-group-tracking']",
      placement: "top",
      beforeEnter: waitForMenuAnimation,
    },
    {
      id: "menu-public-tools",
      title: "免登录工具箱",
      body: "运费计算 / 运费对比 / 订单查询：点这个按钮跳到公开工具页。",
      target: "[data-onboard='menu-public-tools']",
      placement: "top",
      beforeEnter: waitForMenuAnimation,
    },
    {
      id: "menu-user-button",
      title: "个人中心",
      body: "头像按钮：编辑信息、改密、绑邮箱、退出登录。\n\n引导完成后想再看一遍，从这里进「设置 → 重看引导」。",
      target: "[data-onboard='menu-user-button']",
      placement: "bottom",
      beforeEnter: waitForMenuAnimation,
    },
    {
      id: "__system-done",
      title: "引导完成 🎉",
      body: "你已经认识所有模块。每个页面第一次进入还会单独做 3 秒介绍。",
      placement: "center",
      beforeEnter: () => {
        // 收尾：把菜单关掉，让用户看到干净的页面
        onCloseMenu?.();
      },
    },
  ];
}

/** 11 个模块的单步介绍：首次进入时跑 */
export function getPageIntroSteps(pageId: string): OnboardingStep[] {
  const id = isPage(pageId);
  const map: Record<string, { title: string; body: string; target?: string }> = {
    home: {
      title: "首页 · 总览",
      body: "实时数据 + 快捷入口。最近 7 天的动态都浓缩在这里。",
      target: "[data-onboard='page-home']",
    },
    orders: {
      title: "订单 · 处理中心",
      body: "上面是筛选，下面是订单列表。点进任意一行可以填快递、改地址、删除。",
      target: "[data-onboard='page-orders']",
    },
    orderEntry: {
      title: "录单 · 单条下单",
      body: "必填项标了红边，填完点底部「提交订单」。批量录单请走菜单的「批量录单」。",
      target: "[data-onboard='page-order-entry']",
    },
    batchOrder: {
      title: "批量录单",
      body: "把多笔订单粘到文本框里，一次性解析 + 录入。顶部可以保存格式模板。",
      target: "[data-onboard='page-batch-order']",
    },
    bills: {
      title: "账单 · 对账",
      body: "按店铺筛选对账单，导出明细。账期和扣点规则在「价格」里维护。",
      target: "[data-onboard='page-bills']",
    },
    express: {
      title: "快递 · 配置",
      body: "维护发货快递公司、月结账号、运费模板。订单里填快递时这里取值。",
      target: "[data-onboard='page-express']",
    },
    prices: {
      title: "价格 · 维护",
      body: "商品定价、扣点、账期都在这里。改完会同步到账单统计。",
      target: "[data-onboard='page-prices']",
    },
    stores: {
      title: "店铺 · 管理",
      body: "店铺信息、负责人、归属部门。创建买家时绑定的是这里的店铺。",
      target: "[data-onboard='page-stores']",
    },
    orderLink: {
      title: "链接下单 · 生成专属入口",
      body: "选好店铺和买家，复制专属短链接发给客户。客户点开就能免登录下单。",
      target: "[data-onboard='page-order-link']",
    },
    purchasers: {
      title: "买家管理",
      body: "维护老客户档案：编辑、删除、换绑店铺、配置下单码、禁止下单/查单。",
      target: "[data-onboard='page-purchasers']",
    },
    tracking: {
      title: "物流跟踪",
      body: "全局物流监控：在途、签收、滞留的订单一目了然。",
      target: "[data-onboard='page-tracking']",
    },
    logistics: {
      title: "物流管理",
      body: "维护物流商配额、月结账号；超额的自动提示。",
      target: "[data-onboard='page-logistics']",
    },
    shortLinks: {
      title: "短链管理",
      body: "自定义 domain.com/xxx 跳转到免登录工具或外部网址，发给客户更短更好记。",
      target: "[data-onboard='page-short-links']",
    },
  };
  const entry = map[pageId];
  if (!entry) return [];
  return [
    {
      id,
      title: entry.title,
      body: entry.body,
      target: entry.target,
      placement: "bottom",
    },
  ];
}
