# 古建数据共享平台
<<<<<<< HEAD

=======
# 收集并共享古建数据资料 用于复刻及建模
>>>>>>> 8e4170ae956614bc7f7fd487e06767f3913cdc08
**Ancient Architecture Knowledge Base** — 类似知网的古建筑专业知识共享平台

## 功能特色

### 📄 文献库
- 上传/下载古建筑研究论文（PDF、DOC）
- 按朝代、建筑类型、关键词检索
- 论文详情页展示摘要、作者、附件下载

### 📐 构件参数库
- 古建筑构件的材分、模数、尺寸数据库
- 涵盖斗拱、柱、梁枋、屋顶、台基等分类
- 按朝代、分类、建筑名称筛选比对
- 预置 11 条实测数据（佛光寺东大殿、应县木塔、晋祠圣母殿、故宫太和殿）

### 🧊 3D 模型库
<<<<<<< HEAD
- 上传 STL/OBJ/3DM/GH 格式模型（可用于车床、铣床、3D 打印、参数化设计）
=======
- 上传 STL/OBJ 格式模型（可用于车床、铣床、3D 打印）
>>>>>>> 8e4170ae956614bc7f7fd487e06767f3913cdc08
- 内嵌 Three.js 3D 预览（旋转/缩放/多视角）
- 支持多视图上传：正视、侧视、俯视、轴测图
- 模型详情页一键下载

### 🖼️ 图片库
- 上传建筑照片、测绘图、拓片
- 分类浏览与搜索
- 大图灯箱预览

### 🔍 全局搜索
- 首页跨类型搜索（文献、构件、模型、图片）
- 实时统计面板（数据总量、涵盖朝代）

### 📤 贡献
- 四种数据类型均可在线提交
- 构件参数支持 JSON 批量导入

## 技术栈

- **后端**: Node.js + Express + better-sqlite3
- **前端**: Vanilla JS (ES Modules) + Three.js
- **数据库**: SQLite（零配置，单文件）
- **文件上传**: Multer（支持最大 50MB）

## 快速启动

```bash
cd D:\古建交互平台\ancient-knowledge

# 安装依赖
npm install

# 启动服务器
npm start
```

浏览器打开 `http://localhost:3000`

## 项目结构

```
ancient-knowledge/
├── server/
│   ├── index.js          # Express 后端（API + 静态文件）
│   ├── uploads/          # 上传文件存储
│   └── knowledge.db      # SQLite 数据库（自动创建）
├── public/
│   ├── index.html        # 主页面（SPA）
│   └── js/
│       └── app.js        # 前端应用逻辑
└── package.json
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 平台统计数据 |
| GET | `/api/search?q=&type=&dynasty=` | 全局搜索 |
| GET | `/api/papers` | 文献列表（分页） |
| GET | `/api/papers/:id` | 文献详情 |
| POST | `/api/papers` | 上传文献 |
| DELETE | `/api/papers/:id` | 删除文献 |
| GET | `/api/components` | 构件列表 |
| GET | `/api/components/:id` | 构件详情 |
| POST | `/api/components` | 添加构件参数 |
| GET | `/api/models` | 模型列表 |
| GET | `/api/models/:id` | 模型详情（含多视图） |
| POST | `/api/models` | 上传3D模型 |
| GET | `/api/images` | 图片列表 |
| GET | `/api/images/:id` | 图片详情 |
| POST | `/api/images` | 上传图片 |
| POST | `/api/seed` | 初始化种子数据 |

## 预置数据

系统首次启动后自动调用 `/api/seed` 初始化 11 条古建构件参数：

- 佛光寺东大殿（唐）：栌斗、华栌斗、耍头、昂、交互枪、柱、阑额
- 应县木塔（辽）：栌斗、柱
- 晋祠圣母殿（北宋）：栌斗
- 故宫太和殿（清）：柱

数据来源：佛光寺实测、《营造法式》、清工部《工程做法》
