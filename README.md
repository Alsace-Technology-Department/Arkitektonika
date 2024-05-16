# Arkitektonika

<p>
    <img src="https://raw.githubusercontent.com/IntellectualSites/Assets/main/standalone/Arkitektonika/Arkitektonika.png" width="150" alt="logo">
</p>

---

Arkitektonika 是一个用于 NBT 数据的 REST 存储库。它接受有效的 NBT 数据上传，并将其存储在本地文件夹中，同时在本地 SQLite
数据库中记录其元数据。可以选择通过运行 prune 脚本，根据可配置的年龄来过期上传的文件。通过其删除密钥，文件始终可以被删除。

示例实例：

| 地址                           | 过期时间 |
|------------------------------|------|
| https://api.schematic.cloud/ | 30 天 |

## 运行

### 使用 Docker

```sh
docker pull alsacework/arkitektonika
```

可以在 https://hub.docker.com/r/intellectualsites/arkitektonika 上找到

### 从头开始

```sh
git clone https://github.com/IntellectualSites/Arkitektonika.git &&
cd Arkitektonika &&
yarn install
```

#### 使用 TypeScript 转译（推荐）

```sh
yarn start:prod
```

#### 不使用 TypeScript 转译

```sh
yarn start
```

### 本地构建镜像

克隆整个仓库并运行以下命令：

```sh
docker build -t alsacework/arkitektonika:<TAG> .
```

---

示例 Docker Compose：

```yaml
version: '3.8'

services:
  arkitektonika:
    container_name: Arkitektonika
    image: alsacework/arkitektonika:latest
    restart: unless-stopped
    volumes:
      - ./data:/app/data # 挂载包含配置文件、数据库和示意图存储的 data 文件夹
    environment:
      - LOG_LEVEL=DEBUG   # 如果应该将调试日志打印到控制台
```

`/app/data` 挂载到主机的 `/data`，因为该文件夹包含持久数据。

## 清理数据

执行带有 prune 标志的启动命令以执行清理例程：

```sh
yarn start:prod --prune
```

## 设置过期

创建一个在您想要的频率运行的 cron 作业。例如，这将在每 12 小时运行一次清理脚本：

```sh
0 */12 * * * cd /srv/arkitektonika && /usr/bin/yarn start:prod --prune
```

或者使用 Docker Compose 配置：

```sh
0 */12 * * * cd /srv/arkitektonika && docker-compose run --rm arkitektonika node app/launch.js --prune
```

## 配置

```json
{
  "port": 3000,
  "prune": 1800000,
  "maxIterations": 20,
  "maxSchematicSize": 1000000,
  "limiter": {
    "windowMs": 60000,
    "delayAfter": 30,
    "delayMs": 500
  }
}
```

| 配置键                | 描述                                                                                  |
|--------------------|-------------------------------------------------------------------------------------|
| port               | 应用程序绑定的端口                                                                           |
| prune              | 定义记录被清理脚本删除之前的最旧时间（以毫秒为单位）                                                          |
| maxIterations      | 获取唯一下载和删除令牌的最大迭代次数                                                                  |
| maxSchematicSize   | 接受的示意图文件的最大大小（以字节为单位）                                                               |
| limiter.windowMs   | 限制器的时间框架（经过多长时间后限制重置）                                                               |
| limiter.delayAfter | 在 windowMs 期间的多少请求后应该应用 delayMs                                                     |
| limiter.delayMs    | 请求应该延迟多少毫秒。公式：`currentRequestDelay = (currentRequestAmount - delayAfter) * delayMs` |

## 文件结构：

```
data
├── config.json
├── database.db
└── schemata
    ├── fe65d7edc37149c47171962dc26a039b
    └── a98f299c5cf294e6555617e83226bcdd
```

`config.json` 保存用户配置数据 <br>
`database.db` 保存每个示意图所需的数据 <br>
`schemata`    保存所有示意图文件数据

### 路由

所有路由将在公开的端口可用（例如 `localhost:3000`）。

### 上传文件

**POST `INSTANCE_URL/upload`**: 将您的文件作为 multipart/form-data 发送；示例：

```sh
curl --location --request POST 'http://localhost:3000/upload' \
--form 'schematic=@/path/to/plot.schem'
```

响应：

| 代码  | 含义                  |
|-----|---------------------|
| 200 | 文件格式为有效的 NBT，并且已被接受 |
| 400 | 文件格式无效              |
| 413 | 文件负载过大，被拒绝          |
| 500 | 文件上传后在磁盘上找不到（上传失败）  |

成功响应：

```json
{
  "download_key": "db6186c8795740379d26fc61ecba1a24",
  "delete_key": "11561161dffe4a1298992ce063be5ff9"
}
```

下载密钥允许您下载文件，删除密钥允许您删除文件。分享 `download_key`，但不要分享 `delete_key`。

### 检查下载头信息

**HEAD `INSTANCE_URL/download/:download_key`**: 检查如果发送带有给定 download_key 的 POST 请求会得到哪些头信息；示例：

```sh
curl --location --head 'http://localhost:3000/download/db6186c8795740379d26fc61ecba1a24'
```

响应形式为状态码。

| 状态码 | 含义                          |
|-----|-----------------------------|
| 200 | 找到文件，预期下载成功                 |
| 404 | 数据库中找不到文件                   |
| 410 | 文件元数据在记录表中，但文件不在磁盘上或已过期     |
| 500 | 由于元数据损坏（数据库中缺少数据），发生内部服务器错误 |

### 下载文件

**GET `INSTANCE_URL/download/:download_key`**: 使用给定的 `download_key` 下载文件；示例：

```sh
curl --location --request GET 'http://localhost:3000/download/db6186c8795740379d26fc61ecba1a24'
```

响应：
见上文 **检查下载头信息**。

成功时，文件作为附件发送到浏览器/请求者。

### 检查删除头信息

**HEAD `INSTANCE_URL/delete/:delete_key`**: 检查如果发送带有给定 delete_key 的 DELETE 请求会得到哪些头信息；示例：

```sh
curl --location --head 'http://localhost:3000/delete/11561161dffe4a1298992ce063be5ff9'
```

响应形式为状态码。

| 状态码 | 含义                          |
|-----|-----------------------------|
| 200 | 找到文件，预期删除成功                 |
| 404 | 数据库中找不到文件                   |
| 410 | 文件元数据在记录表中，但文件不在磁盘上或已过期     |
| 500 | 由于元数据损坏（数据库中缺少数据），发生内部服务器错误 |

### 删除文件

**DELETE `PUBLIC_URL/delete/:delete_key`**: 使用给定的 `delete_key` 删除文件；示例：

```sh
curl --location --request DELETE 'http://localhost:3000/delete/11561161dffe4a1298992ce063be5ff9'
```

响应：
见上文 **检查删除头信息**。

成功时，文件被删除，并在数据库中标记为已过期。
