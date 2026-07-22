# xb-h5｜喜八移动订单管理

面向手机操作的订单管理前端，依据 `xb-ui` 中的订单管理模块重新设计。项目复用现有后端接口和登录体系，不会修改原有 `xb-ui`。

## 功能

- 账号、密码、验证码登录，密码使用后端公钥进行 RSA 加密
- 登录后工作台：首页实时汇总订单状态、最近订单、最新物流、账单和店铺概况
- 订单管理：移动端筛选、订单卡片、详情、物流轨迹、复制信息、新增、编辑、删除、导入、导出及批量状态操作
- 账单管理：费用与利润查看、维护、同步价格
- 快递管理：物流信息维护与刷新
- 价格管理：商品、包装、快递价格维护及导入导出
- 店铺管理：店铺、默认下单人、通知配置及营业状态（开业中/已关闭）
- 快递查询：快递 100、顺丰和 EMS 手机查询入口
- 免登录订单查询：通过 `/tools/order#订单签名` 查看订单和可收缩物流轨迹；原 `/order` 及旧的 `#id=` 格式继续兼容
- 免登录工具箱：将 `xb-html/手机端地址` 下 6 个旧 HTML 的有效功能合并为统一手机端菜单
  - `/tools`：公开工具菜单
  - `/tools/order-search`：手机号 + 验证码查询订单与物流
  - `/tools/order`：使用加密 ID 查询订单，订单卡片与手机号查询页面保持一致
  - `/tools/freight-calculator`：Excel / JSON / 表格粘贴导入，批量计算与汇总运费
  - `/tools/freight-compare`：京东、顺丰、邮政运费对比，支持复制及导出 Excel
  - “链接查询”：在工具菜单弹窗内粘贴完整链接或加密 ID，再进入对应订单详情
- 手机底部导航、抽屉式表单、确认弹窗、桌面兼容侧栏

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`。

## 接口配置

默认接口地址为：

```text
https://gooop.top/prod-api
```

如需连接其他环境，在项目根目录创建 `.env.local`：

```bash
NEXT_PUBLIC_API_BASE=https://your-domain.example/prod-api
NEXT_PUBLIC_PUBLIC_API_BASE=https://m.your-domain.example/prod-api
```

## 检查命令

```bash
npm run lint
npm run build
```
