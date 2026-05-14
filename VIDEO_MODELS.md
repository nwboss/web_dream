# 视频生成模型配置说明

本系统支持多种视频生成模型，可以根据需要配置使用不同的API。

## 支持的模型

### 1. seeddance-1.5（推荐）
**提供商**：火山方舟  
**特点**：
- 支持文生视频（text2video）
- 支持首帧图生视频（image2video_first）
- 支持首尾帧图生视频（image2video_first_last）
- 支持 4s 和 8s 时长
- 支持多种宽高比

**配置方法**：
```bash
# 在 .env 文件中配置
ARK_API_KEY=your-ark-api-key
ARK_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3
JIMENG_VIDEO_MODEL=seeddance-1.5
```

**获取 API Key**：
1. 访问火山方舟控制台：https://console.volcengine.com/ark
2. 创建应用并获取 API Key
3. 确保已开通 seeddance-1.5 模型权限

### 2. jimeng-video-2.0（传统模型）
**提供商**：即梦 Visual API  
**特点**：
- 支持文生视频
- 支持首帧图生视频
- 暂不支持首尾帧模式

**配置方法**：
```bash
# 在 .env 文件中配置
JIMENG_ACCESS_KEY=your-jimeng-access-key
JIMENG_SECRET_KEY=your-jimeng-secret-key
JIMENG_VIDEO_MODEL=jimeng-video-2.0
```

## 配置示例

### 完整的 .env 配置示例

```bash
# 基础配置
NODE_ENV=production
PORT=8508
AUTH_SECRET=your-random-secret-key
COOKIE_SECURE=false

# 即梦老 API 配置（用于图片生成和 jimeng-video-2.0）
JIMENG_ACCESS_KEY=AKLTxxxxxxxxxxx
JIMENG_SECRET_KEY=xxxxxxxxxxxxxx
JIMENG_IMAGE_MODEL=jimeng-3.1
JIMENG_POLL_MAX_ATTEMPTS=40
JIMENG_POLL_INTERVAL_MS=2000

# 火山方舟配置（用于 seeddance-1.5）
ARK_API_KEY=your-ark-api-key-here
ARK_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3

# 视频模型选择（切换模型只需修改这一行）
JIMENG_VIDEO_MODEL=seeddance-1.5

# 视频生成轮询配置
JIMENG_VIDEO_POLL_MAX_ATTEMPTS=60
JIMENG_VIDEO_POLL_INTERVAL_MS=5000
```

## 切换模型

### 方式一：界面切换（推荐）

在视频生成页面，提示词输入框下方有"视频模型"选项，可以直接选择：
- **Seeddance 1.5** - 支持首尾帧
- **即梦视频 2.0** - 仅支持首帧

界面切换无需重启服务，立即生效。

### 方式二：环境变量默认值

在 `.env` 文件中设置默认模型（界面未选择时使用）：

- 使用 seeddance-1.5: `JIMENG_VIDEO_MODEL=seeddance-1.5`
- 使用 jimeng-video-2.0: `JIMENG_VIDEO_MODEL=jimeng-video-2.0`

**注意**：修改环境变量后需要重启服务：
```bash
docker compose down
docker compose up -d --build
```

## 功能对比

| 功能 | seeddance-1.5 | jimeng-video-2.0 |
|------|--------------|------------------|
| 文生视频 | ✅ | ✅ |
| 首帧图生视频 | ✅ | ✅ |
| 首尾帧图生视频 | ✅ | ❌ |
| 时长选项 | 4s, 8s | 5s, 10s |
| API认证 | 火山方舟 API Key | 即梦 AK/SK |

## 故障排查

### seeddance-1.5 相关问题

**问题：提示 "ARK_API_KEY and ARK_ENDPOINT required"**  
解决：确保在 .env 文件中正确配置了 ARK_API_KEY 和 ARK_ENDPOINT

**问题：API 返回 401 Unauthorized**  
解决：检查 ARK_API_KEY 是否正确，是否已在火山方舟控制台激活

**问题：任务一直 pending**  
解决：
1. 检查火山方舟控制台是否有额度
2. 增加 JIMENG_VIDEO_POLL_MAX_ATTEMPTS 值
3. 检查 ARK_ENDPOINT 是否正确

### jimeng-video-2.0 相关问题

**问题：提示 "Jimeng real mode is not configured"**  
解决：确保配置了 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY

**问题：首尾帧模式不工作**  
解决：jimeng-video-2.0 暂不支持首尾帧模式，请使用 seeddance-1.5

## 参考文档

- 火山方舟文档：https://www.volcengine.com/docs/82379/2298881
- 即梦 API 文档：https://www.volcengine.com/docs/85621/1785204
