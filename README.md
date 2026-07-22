# xb-h5｜喜八移动订单管理

`xb-h5` 是专门为手机端操作设计的订单管理前端。项目复用 `xb` 后端的登录、订单、账单、物流、价格、店铺和买家接口，同时提供无需登录的订单查询、专属下单链接和运费工具。

线上仓库：[https://github.com/serein-morii/xb-h5](https://github.com/serein-morii/xb-h5)

## 主要功能

- 登录：账号、密码、验证码登录，密码使用后端公钥进行 RSA 加密。
- 工作台：汇总订单状态、最近订单、最新物流和最近新增买家。
- 订单管理：筛选、详情、物流轨迹、新增、修改、删除、导入、导出、批量操作。
- 发货：支持批量一键发货，也支持逐单填写快递公司和快递单号。
- 订单复制：订单详情、下单人查询链接、收件人查询链接和发货识别信息。
- 订单录入：选择或新建买家，识别收货地址后快速建单。
- 买家管理：买家短 ID、店铺绑定/解绑及专属下单链接。
- 账单管理：商品成本、包装费、快递费、附加费、销售价格和利润。
- 快递管理：物流状态和物流节点维护。
- 价格管理：商品、规格、包装及快递计价维护。
- 店铺管理：店铺资料、通知配置和营业状态。
- 免登录工具箱：订单查询、链接查询、运费对比和运费计算。

## 页面地址

| 地址 | 说明 | 是否需要登录 |
| --- | --- | --- |
| `/` | 登录页及移动管理后台 | 是 |
| `/order#加密ID` | 兼容旧地址的订单详情 | 否 |
| `/tools` | 免登录工具箱 | 否 |
| `/tools/order-search` | 手机号和验证码查询订单 | 否 |
| `/tools/order#加密ID` | 通过订单链接查询订单和物流 | 否 |
| `/tools/place-order#买家短ID` | 买家专属下单页面 | 否 |
| `/tools/freight-compare` | 运费对比 | 否 |
| `/tools/freight-calculator` | 批量运费计算 | 否 |

## 技术与运行方式

- Node.js：`>= 22.13.0`
- 包管理器：npm
- 页面框架：React 19、Next.js App Router
- 构建工具：Vite、vinext
- 推荐生产运行环境：Cloudflare Workers 或项目内置 Sites 托管

该项目不是纯静态站点。生产构建同时包含浏览器静态资源和 Worker 服务端代码：

```text
dist/
├── client/              # 浏览器静态资源
├── server/index.js      # Cloudflare Worker 入口
└── .openai/             # Sites 托管元数据
```

因此不要只将 `dist/client` 上传到 Nginx，否则动态路由、React Server Components 和部分页面刷新会失效。

## 最快上线方式

当前项目最推荐发布到 Cloudflare Workers。第一次发布直接执行：

```bash
cd xb-h5
npm ci
npm run lint
npm test
npx wrangler login
npx wrangler deploy --config dist/server/wrangler.json
```

其中 `npm test` 已包含生产构建。发布成功后，终端会返回一个 `workers.dev` 访问地址。

以后更新线上版本只需要：

```bash
git pull origin main
npm ci
npm run lint
npm test
npx wrangler deploy --config dist/server/wrangler.json
```

如果需要更换后端地址、绑定自己的域名、配置 GitHub 自动发布或回滚版本，请继续阅读对应章节。

## 一、本地开发

### 1. 克隆项目

```bash
git clone https://github.com/serein-morii/xb-h5.git
cd xb-h5
```

### 2. 安装依赖

仓库包含 `package-lock.json`，推荐使用 `npm ci`，以确保安装版本与生产环境一致：

```bash
npm ci
```

### 3. 配置本地接口

开发模式默认连接：

```text
管理接口：http://127.0.0.1:8080
公开接口：http://127.0.0.1:8080
```

如果后端不在这个地址，在项目根目录创建 `.env.local`：

```bash
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080
NEXT_PUBLIC_PUBLIC_API_BASE=http://127.0.0.1:8080
```

然后启动开发服务：

```bash
npm run dev
```

终端会打印实际访问地址，通常为 `http://localhost:3000`。

## 二、生产环境变量

生产构建默认使用以下线上接口：

```text
NEXT_PUBLIC_API_BASE=https://gooop.top/prod-api
NEXT_PUBLIC_PUBLIC_API_BASE=https://m.gooop.top/prod-api
```

如需修改，在根目录创建 `.env.production`：

```bash
NEXT_PUBLIC_API_BASE=https://your-api.example.com/prod-api
NEXT_PUBLIC_PUBLIC_API_BASE=https://your-public-api.example.com/prod-api
```

变量说明：

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | 登录后的管理接口，包括登录、订单、账单、买家和店铺等接口 |
| `NEXT_PUBLIC_PUBLIC_API_BASE` | 免登录接口，包括订单查询、买家下单和公开字典等接口 |

这两个变量以 `NEXT_PUBLIC_` 开头，会在构建时写入浏览器代码。修改后必须重新执行生产构建，仅重启服务不会生效。

`.env.local`、`.env.production` 和其他 `.env*` 文件已被 Git 忽略，不要把令牌、密码或私密配置提交到仓库。仓库中的 `.env.example` 只保存无敏感信息的示例地址。

## 三、构建生产版本

推荐在一台干净环境中执行：

```bash
git pull origin main
npm ci
npm run lint
npm test
```

`npm test` 会先执行完整生产构建，再运行页面和关键功能测试。如果只需要构建，可以执行：

```bash
npm run build
```

构建成功后应看到：

```text
Build complete
dist/server/index.js
dist/client/
```

可以使用下面的命令检查关键产物：

```bash
test -f dist/server/index.js
test -d dist/client
```

### 本地验证生产版本

```bash
npm run start
```

使用终端打印的地址打开网站，至少验证以下流程：

1. 登录、验证码和退出登录。
2. 工作台、订单列表和订单详情。
3. 新增订单、选择买家和填写快递发货。
4. `/tools/order-search` 免登录查询。
5. `/tools/place-order#买家短ID` 专属下单。
6. 手机浏览器下底部菜单、弹窗和验证码是否完整显示。

## 四、推荐发布：Cloudflare Workers

项目构建结果已经包含 Wrangler 所需的 Worker 配置，适合直接发布到 Cloudflare Workers。

### 1. 登录 Cloudflare

第一次发布需要登录：

```bash
npx wrangler login
```

浏览器会打开 Cloudflare 授权页面。授权完成后可确认当前账号：

```bash
npx wrangler whoami
```

### 2. 构建并发布

```bash
npm ci
npm run lint
npm test
npx wrangler deploy --config dist/server/wrangler.json
```

最后一条命令会同时上传 Worker 服务端代码和 `dist/client` 静态资源。首次发布后 Cloudflare 会返回一个类似下面的地址：

```text
https://xb-h5.<你的账号子域>.workers.dev
```

后续更新执行：

```bash
git pull origin main
npm ci
npm test
npx wrangler deploy --config dist/server/wrangler.json
```

### 3. 绑定自定义域名

进入 Cloudflare 控制台：

```text
Workers & Pages → xb-h5 → Settings → Domains & Routes → Add Custom Domain
```

选择一个已经托管在当前 Cloudflare 账号中的域名，例如：

```text
m.example.com
```

域名生效后，需要同时在 `xb` 后端的跨域配置中允许该 H5 域名，否则浏览器会拦截登录和订单接口请求。

## 五、通过项目内置 Sites 发布

项目保留了 `.openai/hosting.json`，生产构建会自动将托管元数据放入 `dist/.openai`。在支持 Sites 的 Codex 环境中，可以直接要求 Codex：

```text
构建并发布当前 xb-h5 项目
```

发布前仍建议先执行：

```bash
npm ci
npm test
```

Sites 会发布完整的 Worker 和静态资源，不需要手动上传 `dist/client`。如果后续使用 D1 或 R2，只在 `.openai/hosting.json` 中维护逻辑绑定名称，线上资源和运行时变量通过 Sites 管理。

## 六、GitHub Actions 自动发布

如需每次推送 `main` 后自动部署，可在 GitHub 仓库添加以下 Secrets：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

API Token 至少需要当前账号的 Workers Scripts 编辑权限。然后创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy xb-h5

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npx wrangler deploy --config dist/server/wrangler.json
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

建议先手动发布成功一次，再启用自动发布，以确认 Cloudflare 账号、Worker 名称和自定义域名都正确。

## 七、Nginx + Linux 服务器发布

Nginx 可以部署本项目，但它负责的是域名、HTTPS 和反向代理，页面本身仍由 Node.js 生产服务运行：

```text
手机浏览器 → Nginx :443 → vinext/Node.js :3000
```

不要使用 `root /var/www/xb-h5/dist/client` 把它部署成纯静态站点，否则子页面刷新、动态路由和 React Server Components 会异常。

以下示例以 Ubuntu/Debian、域名 `h5.example.com`、安装目录 `/var/www/xb-h5` 为例。请将域名替换成自己的真实域名。

### 1. 准备服务器

服务器需要安装：

- Node.js 22.13.0 或更高版本。
- npm。
- Git。
- Nginx。

确认版本：

```bash
node -v
npm -v
nginx -v
```

### 2. 拉取代码并配置生产接口

```bash
sudo mkdir -p /var/www
sudo chown -R "$USER":"$USER" /var/www
git clone https://github.com/serein-morii/xb-h5.git /var/www/xb-h5
cd /var/www/xb-h5
npm ci
```

如果继续请求现有线上后端，可以不创建环境文件，项目会使用默认接口地址。如果需要连接自己的后端，在 `/var/www/xb-h5/.env.production` 中填写：

```bash
NEXT_PUBLIC_API_BASE=https://gooop.top/prod-api
NEXT_PUBLIC_PUBLIC_API_BASE=https://m.gooop.top/prod-api
```

随后检查并构建：

```bash
npm run lint
npm test
```

`npm test` 已经包含 `npm run build`，成功后会生成 `dist/server` 和 `dist/client`。

### 3. 先手动启动验证

```bash
npm run start
```

看到下面的信息说明生产服务启动成功：

```text
Production server running at http://0.0.0.0:3000
```

另开一个终端验证：

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/tools
```

两个地址都应返回 `HTTP 200`。验证后按 `Ctrl+C` 停止临时服务。

### 4. 使用 systemd 保持服务运行

先确认 npm 的绝对路径：

```bash
which npm
```

创建 `/etc/systemd/system/xb-h5.service`：

```ini
[Unit]
Description=xb-h5 mobile order application
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/xb-h5
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

如果 `which npm` 返回的不是 `/usr/bin/npm`，必须同步修改 `ExecStart`。然后将目录交给运行用户并启动：

```bash
sudo chown -R www-data:www-data /var/www/xb-h5
sudo systemctl daemon-reload
sudo systemctl enable --now xb-h5
sudo systemctl status xb-h5
```

查看实时日志：

```bash
sudo journalctl -u xb-h5 -f
```

### 5. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/xb-h5`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name h5.example.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/xb-h5 /etc/nginx/sites-enabled/xb-h5
sudo nginx -t
sudo systemctl reload nginx
```

将 `h5.example.com` 的 DNS A 记录解析到服务器公网 IP，等待解析生效后访问：

```text
http://h5.example.com
```

### 6. 配置 HTTPS

使用 Certbot 自动申请和续期 Let's Encrypt 证书：

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d h5.example.com
sudo certbot renew --dry-run
```

生产环境应只对外开放 80 和 443 端口。3000 端口由 Nginx 在本机访问，不需要开放到公网。

### 7. 可选：由同一个 Nginx 转发后端接口

如果 `xb` 后端也运行在这台服务器的 `127.0.0.1:8080`，可以让前端和接口共用一个域名，从而减少跨域配置。

在 `.env.production` 中设置：

```bash
NEXT_PUBLIC_API_BASE=https://h5.example.com/prod-api
NEXT_PUBLIC_PUBLIC_API_BASE=https://h5.example.com/prod-api
```

在上面的 Nginx `server` 中、`location /` 之前加入：

```nginx
location ^~ /prod-api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

这里 `proxy_pass` 末尾的 `/` 会把外部 `/prod-api/xxx` 转成后端的 `/xxx`。修改 `.env.production` 后必须重新执行 `npm test` 并重启服务。

### 8. 后续更新发布

由于目录属于 `www-data`，建议先切换到该用户再更新：

```bash
sudo -u www-data -H bash
cd /var/www/xb-h5
git pull origin main
npm ci
npm run lint
npm test
exit
sudo systemctl restart xb-h5
sudo systemctl status xb-h5
```

最后验证线上地址：

```bash
curl -I https://h5.example.com/
curl -I https://h5.example.com/tools
```

如果更新失败，不要重启当前服务，旧进程会继续提供上一版页面。若新版本已经启动后才发现问题，可将 Git 切回上一个确认可用的提交，重新构建并重启 `xb-h5`。

## 八、回滚 Cloudflare 版本

查看最近部署：

```bash
npx wrangler deployments list --name xb-h5
```

确认要恢复的版本 ID 后执行：

```bash
npx wrangler rollback <version-id> --name xb-h5
```

回滚只恢复 Cloudflare 上的运行版本，不会修改 GitHub 代码。确认线上恢复后，再决定是否在 Git 中创建修复提交。

## 九、后端和跨域检查

H5 页面会从用户浏览器直接请求 `xb` 后端，因此发布前必须确认：

- 管理接口和公开接口都可以通过 HTTPS 访问。
- 后端允许生产 H5 域名跨域请求。
- `Authorization` 请求头在跨域配置中被允许。
- 登录、验证码、公开查询和下单接口没有被反向代理错误缓存。
- 如果 H5 和接口使用不同子域名，两个域名的 TLS 证书均有效。
- 后端部署版本已经包含买家表、`purchaser_short_id` 和相关接口。

## 十、常见问题

### 修改接口地址后页面仍请求旧地址

`NEXT_PUBLIC_*` 是构建时变量。修改 `.env.production` 后重新执行：

```bash
npm run build
```

然后重新发布。

### 刷新子页面后出现 404

说明只发布了静态资源，或者服务器没有运行 Worker/RSC 服务。请使用完整的 Cloudflare Workers 发布命令，或让 `npm run start` 常驻并通过 Nginx 反向代理。

### 登录接口提示跨域错误

检查后端 CORS 是否允许当前 H5 域名、`Authorization` 和 `Content-Type` 请求头，并确认预检 `OPTIONS` 请求没有被网关拦截。

### Wrangler 发布时提示未登录

```bash
npx wrangler login
npx wrangler whoami
```

CI 环境不要使用浏览器登录，应配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

### 构建后目录很大

不要提交或上传 `node_modules`、`.vinext`、`.wrangler`。正式发布只需要 Wrangler 根据 `dist/server/wrangler.json` 上传 `dist/server` 和 `dist/client`。

## 常用命令

```bash
npm run dev       # 本地开发
npm run lint      # 代码检查
npm run build     # 生产构建
npm test          # 生产构建 + 自动测试
npm run start     # 本地运行生产版本
```

## 发布前检查清单

- [ ] 已拉取 `main` 最新代码。
- [ ] 已配置正确的生产接口地址。
- [ ] `npm ci` 执行成功。
- [ ] `npm run lint` 执行成功。
- [ ] `npm test` 全部通过。
- [ ] 后端已允许生产 H5 域名跨域。
- [ ] 登录、订单查询、专属下单和发货已在手机上验证。
- [ ] 自定义域名已经启用 HTTPS。
- [ ] 已保留上一个可用的 Cloudflare 部署版本，方便回滚。
