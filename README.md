# xb-h5｜喜八移动订单管理

`xb-h5` 是专门为手机端操作设计的订单管理前端，包含登录、工作台、订单、账单、物流、价格、店铺、买家和免登录工具箱。

项目已经改为 **Vite + React 纯静态 SPA**。生产构建不需要 Node.js 服务、PM2、systemd、Cloudflare Worker 或 Docker，构建后的 `dist` 可以直接复制到 Nginx 网站目录。

仓库地址：[https://github.com/serein-morii/xb-h5](https://github.com/serein-morii/xb-h5)

## 最快发布方式

在自己的开发电脑上执行：

```bash
cd xb-h5
npm ci
npm test
```

构建成功后会生成：

```text
dist/
├── index.html
├── favicon.svg
└── assets/
    ├── index-*.css
    ├── index-*.js
    └── xlsx-*.js
```

把整个 `dist` 目录中的内容复制到服务器，例如：

```bash
scp -r dist/* root@服务器IP:/var/www/xb-h5/
```

服务器只需要安装 Nginx，不需要安装 npm。Nginx 的关键配置是：

```nginx
root /var/www/xb-h5;
index index.html;

location / {
    try_files $uri $uri/ /index.html;
}
```

`try_files` 不能省略，否则直接刷新 `/tools/order-search`、`/order` 等页面会出现 404。

## 主要功能

- 登录：账号、密码、验证码登录，密码使用后端公钥进行 RSA 加密。
- 工作台：订单状态、最近订单、最新物流和最近新增买家。
- 订单管理：筛选、详情、新增、修改、删除、导入、导出和批量操作。
- 发货：支持批量一键发货，也支持逐单填写快递公司和快递单号。
- 订单复制：订单详情、下单人链接、收件人链接和发货识别信息。
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

## 一、本地开发

### 1. 环境要求

- Node.js `>= 20.19.0`
- npm

Node.js 只在开发电脑或构建机上使用，Nginx 生产服务器不需要安装。

### 2. 安装依赖

```bash
git clone https://github.com/serein-morii/xb-h5.git
cd xb-h5
npm ci
```

### 3. 本地接口配置

开发模式默认请求：

```text
http://127.0.0.1:8080
```

如果后端地址不同，在项目根目录创建 `.env.local`：

```bash
VITE_API_BASE=http://127.0.0.1:8080
VITE_PUBLIC_API_BASE=http://127.0.0.1:8080
```

启动开发服务：

```bash
npm run dev
```

终端会显示本地访问地址，通常是 `http://localhost:5173`。

## 二、生产接口配置

项目默认生产接口为：

```text
管理接口：https://gooop.top/prod-api
公开接口：https://m.gooop.top/prod-api
```

如需修改，在项目根目录创建 `.env.production`：

```bash
VITE_API_BASE=https://your-api.example.com/prod-api
VITE_PUBLIC_API_BASE=https://your-public-api.example.com/prod-api
```

| 变量 | 用途 |
| --- | --- |
| `VITE_API_BASE` | 登录后的管理接口，包括订单、账单、买家和店铺等接口 |
| `VITE_PUBLIC_API_BASE` | 免登录订单查询、买家下单和公开字典接口 |

`VITE_*` 是构建时变量。修改接口地址后必须重新执行 `npm run build`，仅重新复制旧的 `dist` 不会生效。

环境文件已经被 Git 忽略，不要把令牌、密码或私密配置提交到仓库。

## 三、生产构建

推荐执行完整检查：

```bash
git pull origin main
npm ci
npm run lint
npm test
```

`npm test` 会先执行 TypeScript 类型检查和生产构建，再运行 7 项关键功能测试。

如果只需要快速构建：

```bash
npm run build
```

检查静态产物：

```bash
test -f dist/index.html
test -d dist/assets
```

在本机预览生产版本：

```bash
npm run preview
```

`npm run preview` 只用于本机检查，不需要在生产服务器运行。

## 四、Nginx 直接部署 dist

以下示例使用：

```text
域名：h5.example.com
网站目录：/var/www/xb-h5
```

请替换为自己的真实域名和目录。

### 1. 在开发电脑打包

```bash
cd xb-h5
npm ci
npm test
tar -czf xb-h5-dist.tar.gz -C dist .
```

上传压缩包：

```bash
scp xb-h5-dist.tar.gz root@服务器IP:/tmp/
```

### 2. 在服务器解压

```bash
sudo mkdir -p /var/www/xb-h5
sudo tar -xzf /tmp/xb-h5-dist.tar.gz -C /var/www/xb-h5
sudo chown -R www-data:www-data /var/www/xb-h5
```

确认服务器文件：

```bash
ls -la /var/www/xb-h5/index.html
ls -la /var/www/xb-h5/assets
```

### 3. 配置 Nginx

创建 `/etc/nginx/sites-available/xb-h5`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name h5.example.com;

    root /var/www/xb-h5;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/xb-h5 /etc/nginx/sites-enabled/xb-h5
sudo nginx -t
sudo systemctl reload nginx
```

将域名的 DNS A 记录解析到服务器公网 IP，然后访问：

```text
http://h5.example.com
```

### 4. 配置 HTTPS

Ubuntu/Debian 可以使用 Certbot：

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d h5.example.com
sudo certbot renew --dry-run
```

### 5. 验证 SPA 路由

以下地址都应返回 HTTP 200：

```bash
curl -I https://h5.example.com/
curl -I https://h5.example.com/order
curl -I https://h5.example.com/tools
curl -I https://h5.example.com/tools/order-search
curl -I https://h5.example.com/tools/place-order
```

如果只有首页正常、其他地址返回 404，检查 Nginx 是否配置了：

```nginx
try_files $uri $uri/ /index.html;
```

## 五、服务器没有 npm 怎么办

这是正常情况。纯静态部署的生产服务器不需要 npm。

正确流程：

```text
开发电脑安装 Node.js/npm
        ↓
执行 npm test 或 npm run build
        ↓
得到 dist 目录
        ↓
上传 dist 到 Nginx 服务器
        ↓
Nginx 直接读取 index.html 和 assets
```

不要在服务器的 `dist` 目录执行 `npm run start`。`dist` 已经是最终网站文件，Nginx 可以直接读取。

## 六、同域名代理后端接口（可选）

如果 `xb` 后端运行在同一台服务器的 `127.0.0.1:8080`，可以通过 Nginx 代理 `/prod-api`，避免跨域问题。

构建前在 `.env.production` 设置：

```bash
VITE_API_BASE=https://h5.example.com/prod-api
VITE_PUBLIC_API_BASE=https://h5.example.com/prod-api
```

在 Nginx 的 `server` 中加入，并放在 `location /` 前面：

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

修改 `.env.production` 后必须重新构建并上传新的 `dist`。

## 七、后续更新

每次更新代码后，在开发电脑重新构建：

```bash
git pull origin main
npm ci
npm test
tar -czf xb-h5-dist.tar.gz -C dist .
scp xb-h5-dist.tar.gz root@服务器IP:/tmp/
```

服务器重新解压并加载 Nginx：

```bash
sudo tar -xzf /tmp/xb-h5-dist.tar.gz -C /var/www/xb-h5
sudo chown -R www-data:www-data /var/www/xb-h5
sudo nginx -t
sudo systemctl reload nginx
```

纯静态文件更新不需要重启 Node.js，因为服务器上没有 Node.js 应用进程。

## 八、Docker + Nginx（可选）

纯静态版本也可以放进 Nginx Docker 镜像：

```dockerfile
FROM nginx:1.27-alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

其中 `nginx.conf` 同样必须包含 SPA 回退：

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

构建和启动：

```bash
docker build -t xb-h5:latest .
docker run -d --name xb-h5 --restart unless-stopped -p 8088:80 xb-h5:latest
```

## 九、常见问题

### `npm: command not found`

如果是在 Nginx 生产服务器看到该提示，不需要安装 npm。在开发电脑构建 `dist`，然后把它上传到服务器即可。

如果是在开发电脑构建，则需要安装 Node.js 20.19.0 或更高版本。

### 刷新子页面出现 404

Nginx 缺少 SPA 回退。添加：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 页面仍然请求旧接口

接口地址在构建时写入 JavaScript。修改 `.env.production` 后重新执行：

```bash
npm run build
```

并重新上传整个 `dist`。

### 登录接口跨域失败

让后端允许 H5 域名、`Authorization` 和 `Content-Type` 请求头，或者使用上面的 Nginx `/prod-api` 同域代理方案。

### 页面打开后空白

打开浏览器开发者工具检查网络请求，确认：

- `/assets/index-*.js` 返回 200。
- Nginx 的 `root` 指向包含 `index.html` 的目录。
- 没有只复制 `index.html` 而漏掉 `assets`。
- 网站部署在域名根目录，而不是未配置的二级子目录。

## 常用命令

```bash
npm run dev       # 本地开发
npm run lint      # 代码检查
npm run build     # 生成纯静态 dist
npm test          # 构建并运行自动测试
npm run preview   # 本机预览 dist
```

## 发布前检查清单

- [ ] 已配置正确的 `.env.production`。
- [ ] `npm ci` 执行成功。
- [ ] `npm run lint` 执行成功。
- [ ] `npm test` 的 7 项测试全部通过。
- [ ] 已完整上传 `dist/index.html`、`dist/assets` 和图标文件。
- [ ] Nginx 已配置 `try_files $uri $uri/ /index.html`。
- [ ] 后端允许生产域名跨域，或者已经配置同域接口代理。
- [ ] 登录、订单查询、专属下单和发货已在手机上验证。
- [ ] 域名已经启用 HTTPS。
