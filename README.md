# AutoChess 赛季数据编辑器

支持多人在线协作的 AutoChess 游戏赛季配置数据编辑器。

## 难度数值与独立模式

在「游戏模式」选择模式后，可以编辑生命/攻击底数、各回合的独立指数和额外乘数、全体敌人移速，以及 Boss 的独立生命倍率。下方预览展示实际生效数值；默认预览不会自动写入赛季，只有编辑或采用公式后才形成覆盖。

服务器提供权威默认值；编辑器的预览规则与服务器做一致性测试。单人、联机终极默认生命底数为 1.2，攻击底数为 1.1，W3 起全体敌人移速为 115%。其他难度保持原有默认值。

公式表的每行使用「底数 ^ 指数 × 乘数」，表外延续末行；旧的最终倍率表保留表外为 1 的规则。两种格式互斥，空表均表示全部倍率为 1。生命和攻击倍率不叠加到 Boss；移速包括 Boss。

难度声明中任意字段错误会使**当前模式整套难度数值**回退，包括看似正确的 Boss 覆盖值。编辑器保留并显示原始错误声明，允许继续修正；点击「全部恢复默认」删除覆盖。合法的 0、false 会保留，留空的必填输入不会被自动改成 0。可通过「诊断 / 引用」连接目标游戏服务器查看最终校验结果。

新增模式采用「复制为独立模式」：填写独立 ID 和名称，选择已有模式作为基础，自动复制商店、战斗、地图关联和原生资源映射。之后修改该模式数值，保存并发布赛季，玩家即可在游戏内选择。基础难度仍使用已有枚举，以兼容经济、Boss 和回合流程。切换基础难度或模式类型时，需要同步检查战斗表、地图及原生适配。无商店、战斗表或可用地图的来源不能直接复制。

目录保存、普通 JSON 与 PE JSON 导出都保留难度声明和模式映射；未配置的模式继续继承服务器默认值。游戏服务器与客户端需要使用支持本配置的版本；已存在对局及旧快照继续使用记录的数值，新对局采用新规则。

## 部署

### 1. 前置条件

- **Node.js** >= 20
- **pnpm** >= 9（`npm install -g pnpm`）
- **PostgreSQL** >= 14

### 2. 克隆项目 & 安装依赖

```bash
git clone <repo-url> autochess-season-editor
cd autochess-season-editor
pnpm install
```

### 3. 配置环境变量

```bash
cp packages/server/.env.example packages/server/.env
```

编辑 `packages/server/.env`：

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/autochess_editor
JWT_SECRET=<改成随机字符串>
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

> **生产环境**：`CORS_ORIGIN` 设为前端实际域名，`JWT_SECRET` 务必使用强随机值。

### 4. 初始化数据库

```bash
# 创建数据库（以 PostgreSQL 超级用户执行）
sudo -u postgres psql -c "CREATE DATABASE autochess_editor;"

# 运行迁移（建表）
pnpm --filter @autochess-editor/server db:migrate

# 创建管理员账号（默认 admin / admin123）
pnpm --filter @autochess-editor/server db:seed

# 或自定义用户名密码：
pnpm --filter @autochess-editor/server db:seed myuser mypassword
```

### 5. 导入赛季数据（模板）

导入的数据默认作为**模板**（所有用户可见，需复制后才能编辑）。

项目自带赛季数据在 `packages/server/data/` 目录下，每个 `.json` 文件对应一个赛季（`AutoChessSeasonData` 格式）。更新游戏数据时直接替换对应文件即可。

```bash
# 导入 data/ 目录下所有赛季（推荐，文件名作为赛季名）
pnpm --filter @autochess-editor/server db:import

# 也可以指定单个文件导入
pnpm --filter @autochess-editor/server db:import /path/to/season.json "赛季名称"

# 如需导入为私有赛季（而非模板），加 --private 标志：
pnpm --filter @autochess-editor/server db:import /path/to/season.json --private
```

### 6. 启动

#### 开发模式

```bash
# 同时启动前后端（热重载）
pnpm dev:all

# 或分别启动：
pnpm dev:server   # 后端 http://localhost:3001
pnpm dev          # 前端 http://localhost:5173（自动代理 /api 和 /yjs）
```

#### 生产模式

```bash
# 构建前端
pnpm --filter @autochess-editor/editor build

# 启动后端（使用 tsx 运行 TypeScript）
cd packages/server
npx tsx src/index.ts
# 或使用 pm2 等进程管理器：
# pm2 start "npx tsx src/index.ts" --name autochess-server
```

前端构建产物在 `packages/editor/dist/`，用 Nginx/Caddy 托管静态文件，并将 `/api` 和 `/yjs` 反向代理到后端端口。

**Nginx 参考配置：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /path/to/autochess-season-editor/packages/editor/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 反向代理
    location /yjs/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 7. 访问

打开浏览器访问前端地址，使用管理员账号登录。

---

## 重置数据库

```bash
# 保留用户，清除赛季等数据后重新导入
pnpm --filter @autochess-editor/server db:reset
pnpm --filter @autochess-editor/server db:import

# 或一键执行：
pnpm --filter @autochess-editor/server db:reset-import

# 完全重建（包括用户）：
sudo -u postgres psql -c "DROP DATABASE IF EXISTS autochess_editor;"
sudo -u postgres psql -c "CREATE DATABASE autochess_editor;"
pnpm --filter @autochess-editor/server db:migrate
pnpm --filter @autochess-editor/server db:seed
pnpm --filter @autochess-editor/server db:import
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/autochess_editor` | PostgreSQL 连接串 |
| `JWT_SECRET` | `autochess-editor-secret-change-me` | JWT 签名密钥（生产环境务必修改） |
| `PORT` | `3001` | 后端监听端口 |
| `CORS_ORIGIN` | `http://localhost:5173` | 允许的跨域来源 |
