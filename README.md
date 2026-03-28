# 即梦漫剧工坊

当前仓库已经落下 `Sprint 0 + Sprint 1` 的前端骨架，并且已经补好了 Docker 部署基础：

- To C 首页
- 登录 / 注册 / 忘记密码页
- 受保护的控制台页
- 账户中心页
- 基于 `httpOnly cookie` 的简易鉴权
- Dockerfile
- docker-compose.yml

## 本地启动

```bash
npm install
npm run dev
```

建议使用 `Node 22 LTS`。当前这台机器上的 `Node 24.13.0` 会导致 Next.js 的 SWC 原生模块崩溃，因此类型检查可以通过，但 `next build` 无法在该运行时上完成验证。

## Docker 部署

### 1. 准备环境变量

先复制环境变量模板：

```bash
cp .env.example .env
```

至少修改：

- `AUTH_SECRET`

建议把 `AUTH_SECRET` 换成一个足够长的随机字符串。

### 2. 本机或服务器构建并启动

```bash
docker compose build
docker compose up -d
```

启动后访问：

- `http://服务器IP:3000`

### 3. 查看日志

```bash
docker compose logs -f web
```

### 4. 停止服务

```bash
docker compose down
```

## 服务器更新部署

如果你后面把代码托管到 Git 仓库，服务器上可以直接这样更新：

```bash
cd /your/path/web_dream
git pull
docker compose build
docker compose up -d
```

如果依赖和镜像层没变，也可以用：

```bash
docker compose up -d --build
```

## 推荐服务器操作流程

### 方案一：手动拉取部署

适合早期项目，最简单。

1. 服务器安装 Docker 和 Docker Compose
2. `git clone` 项目
3. 配置 `.env`
4. `docker compose up -d --build`
5. 后续更新时执行 `git pull && docker compose up -d --build`

### 方案二：Nginx 反向代理

如果你要绑定域名，建议服务器上让 Nginx 代理到 `3000` 端口。

常见结构：

```text
Browser -> Nginx(80/443) -> Next.js Container(3000)
```

### 方案三：后续扩展为完整生产栈

等 Sprint 2 以后接数据库和队列时，可以扩展为：

```text
web
postgres
redis
worker
nginx
```

当前这版 `docker-compose.yml` 先只保留 `web`，方便你尽快上线骨架。

默认访问：

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/account`

## 当前说明

这版是骨架版，主要用于承接后续 Sprint 2~4 的项目工作台、即梦图片/视频 API 接入和额度系统。

当前登录注册为演示态：

- 没有接数据库
- 没有真实用户存储
- 没有短信/邮件验证
- 账号信息通过服务端签名 cookie 保存

当前图片生成支持两种模式：

- 未配置即梦环境变量时，使用 mock 结果，方便继续推进 MVP
- 配置 `JIMENG_ACCESS_KEY` 和 `JIMENG_SECRET_KEY` 后，图片生成会优先尝试火山引擎 Visual 官方 async 文生图 3.1
- 如果你使用自己的代理层，也可以继续使用 `JIMENG_API_KEY` 和 `JIMENG_IMAGE_ENDPOINT` 走 generic 模式

下一步建议：

1. 接 Prisma + PostgreSQL
2. 落项目/场次/分镜表
3. 接即梦图片 Provider
4. 接 Redis Job 队列和视频轮询
# web_dream
