# 子系统独立域名

给人工和 AI 看的约定。改路由、加子系统、配 nginx 之前先读这一份。

实现：`app/lib/subsystemHost.ts`  
入口：OTP 走 `src/main.tsx` → `app/systems/otp/OtpApp.tsx`（不加载主站 App）；其它域名仍走 `app/App.tsx` 的 `resolveSubsystemPath`。

## 一句话

`{子系统}.gooop.top` 对应主站路由 `/{子系统}`。  
nginx 只把独立域名整站反代到主站**根路径**，路径改写由前端做。主站原地址（`gooop.top/otp`、`m.gooop.top`）行为不变。

## 为什么不能把 nginx 指到子路径

下面这种写法是错的：

```nginx
# 错误：所有请求都会被拼到 /otp 后面
proxy_pass https://gooop.top/otp;
```

| 浏览器请求 | 实际打到 | 结果 |
| --- | --- | --- |
| `otp.gooop.top/` | `gooop.top/otp` | HTML 能回来 |
| `otp.gooop.top/assets/xxx.js` | `gooop.top/otp/assets/xxx.js` | **404，页面卡在「正在启动移动工作台」** |

`index.html` 里的「正在启动移动工作台…」只是 React 起来前的占位。一直停在这句，多半是 JS/CSS 没加载到。

正确写法：`proxy_pass https://gooop.top;`（不要带 `/otp`、`/lab`）。

## 路径怎么映射

主机名第一个标签 = 子系统名。该名字必须已经是主站的一级路由（`/otp`、`/lab`、`/tools` …）。

| 访问 | 前端当成 |
| --- | --- |
| `otp.gooop.top/` | `/otp` |
| `otp.gooop.top/otp` | `/otp`（已带前缀，不重复加） |
| `lab.gooop.top/` | `/lab` |
| `lab.gooop.top/video-extract` | `/lab/video-extract` |
| `tools.gooop.top/order-search` | `/tools/order-search` |
| `otp.gooop.top/s/xxxxx` | `/s/xxxxx`（全局分享链，不改写） |
| `gooop.top/otp` | `/otp`（不是子系统域名，不改写） |
| `m.gooop.top/otp` | `/otp`（保留主机名，不改写） |

## 不改写的主机名

这些当主站 / 环境域名，不当子系统：

`www` `m` `api` `admin` `uat` `dev` `stage` `test` `mail` `img` `cdn` `static` `localhost`

要加保留名：改 `app/lib/subsystemHost.ts` 里的 `RESERVED_HOSTS`。

## 不改写的路径

目前只有 OTP 分享链：`/s/...`  
在任意子系统域名上访问 `/s/xxxxx` 都保持原路径。

要加全局路径：改同一文件里的 `GLOBAL_PATHS`。

## 新增一个子系统

按顺序做，缺一步都会出问题。

### 1. 代码里先有一级路由

在 `app/App.tsx` 的 `routes` 里注册 `/{名字}`，子页写成 `/{名字}/xxx`。  
例如要做 `lab.gooop.top`，必须已有 `/lab`、`/lab/video-extract`。

子系统名只能用主机名允许的标签：小写字母、数字、连字符。不要用下划线。

### 2. nginx 只换 server_name 和证书

复制下面整段，改 `server_name` 和证书路径。`proxy_pass` 必须指向主站根，各子系统都一样。

```nginx
server {
    listen 80;
    server_name foo.gooop.top;
    return 301 https://foo.gooop.top$request_uri;
}

server {
    listen 443 ssl;
    server_name foo.gooop.top;

    ssl_certificate     ssl/foo.gooop.top_bundle.crt;
    ssl_certificate_key ssl/foo.gooop.top.key;

    ssl_session_timeout 5m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass https://gooop.top;

        proxy_set_header Host gooop.top;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;

        proxy_ssl_server_name on;
        proxy_ssl_name gooop.top;
        proxy_http_version 1.1;
    }
}
```

DNS 把 `foo.gooop.top` A 到这台 nginx。改完 `nginx -t` 再 reload。

### 3. 发前端

前端必须是带 `subsystemHost.ts` 的构建产物。只改 nginx、旧前端未上线时：独立域名打开的是主站首页，不会按子系统进。

发版顺序：nginx 先改成根路径反代 → 再发前端。只改一边会不对。

## 加载隔离（OTP）

`otp.gooop.top`、`/otp`、`/s/...` 在 `src/main.tsx` 里走独立入口 `OtpApp`，**不会加载**订单工作台 / 黄桃首页 / 工具箱。

登录页也不带扫码库 `jsqr`，进保险库后再拉工作区，打开扫码再拉识别库。

占位文案：OTP 显示「正在打开 OTP Vault…」，主站仍是「正在启动移动工作台…」。

## 不要做的事

- 不要 `proxy_pass https://gooop.top/otp;`（或任何子路径）
- 不要在 nginx 里 `rewrite` `/` → `/otp` 当长期方案（静态资源仍容易挂）
- 不要给 `m` / `www` / `api` 当子系统去映射
- 不要把 OTP 页面再挂回主站 App 的首包（会拖慢 `otp.gooop.top`）
- 不要改 `gooop.top/otp`、`m.gooop.top` 的现有路径语义

前端必须是带 `subsystemHost.ts` 的构建产物。只改 nginx、旧前端未上线时：独立域名打开的是主站首页，不会按子系统进。

发版顺序：nginx 先改成根路径反代 → 再发前端。只改一边会不对。

## 不要做的事

- 不要 `proxy_pass https://gooop.top/otp;`（或任何子路径）
- 不要在 nginx 里 `rewrite` `/` → `/otp` 当长期方案（静态资源仍容易挂）
- 不要给 `m` / `www` / `api` 当子系统去映射
- 不要在前端再写死 `otp.gooop.top` 判断；新系统靠路由表自动识别
- 不要改 `gooop.top/otp`、`m.gooop.top` 的现有路径语义

## 现有子系统

| 域名 | 一级路由 | 说明 |
| --- | --- | --- |
| `otp.gooop.top` | `/otp` | OTP Vault；分享链仍是 `/s/:token` |
| （可开）`lab.gooop.top` | `/lab` | Handy Lab |
| （可开）`tools.gooop.top` | `/tools` | 免登录工具箱 |

主站入口不受影响：`https://gooop.top/otp`、`https://m.gooop.top`。

## 改约定时改哪里

| 要改什么 | 文件 |
| --- | --- |
| 映射规则 / 保留主机名 / 全局路径 / OTP 启动面 | `app/lib/subsystemHost.ts` |
| OTP 独立入口 | `src/main.tsx`、`app/systems/otp/OtpApp.tsx` |
| 注册页面 | `app/App.tsx` 的 `routes` |
| API 基址（生产已写死主站） | `app/lib/api.ts` 的 `API_BASE` |
| 这份说明 | `docs/subsystem-host.md` |
