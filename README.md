# 今晚吃什么 · Dinner Wheel

Vue 3 + TypeScript + Vite + Cloudflare Pages Functions。用户主动定位或输入地址后，从高德查询附近真实餐厅，筛选并等概率抽取。不使用 AI、模拟餐厅、账户系统或自建餐厅数据库。

## 本地运行

需要 Node.js 22.12+（建议 Node.js 24 LTS）和 npm。

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
```

在 `.dev.vars` 中填写自己的高德 **Web 服务** Key：

```dotenv
AMAP_WEB_KEY=你的高德Web服务Key
```

不要使用 JavaScript API Key，不要使用 `VITE_` 前缀。`.dev.vars` 已忽略，不应上传。

先构建一次，再开启两个终端：

```powershell
npm run build
npm run dev:api
```

```powershell
npm run dev
```

打开 Vite 输出的本地地址（通常为 `http://127.0.0.1:5173`）。Vite 会将 `/api` 代理到 Wrangler 的 `http://127.0.0.1:8789`。Wrangler 启动时读取 `.dev.vars`，修改密钥后需要重启它。

也可仅运行 `npm run dev:api`，在 8789 端口验证最近一次构建的完整应用。**仅 Vite 或 `npm run preview` 不能独立运行 Pages Functions。**

浏览器定位需要 HTTPS 或 localhost/127.0.0.1；手机通过局域网 HTTP 地址访问通常不能定位，请使用上线后的 HTTPS 地址。定位授权被拒绝或超时后可输入包含城市的完整地址。

## 高德配置

在 [高德开放平台](https://console.amap.com/dev/key/app) 注册/登录，创建应用并添加「Web 服务」Key。确认账户已开通当前需要的接口与配额：

- [周边搜索 POI 2.0](https://developer.amap.com/api/webservice/guide/api-advanced/newpoisearch)：`/v5/place/around`，请求 `types=050000`、`show_fields=business`、`sortrule=distance`、`page_size=25`。
- [GPS 坐标转换](https://developer.amap.com/api/webservice/guide/api/convert)：`/v3/assistant/coordinate/convert`，`coordsys=gps`。
- [地址地理编码](https://developer.amap.com/api/webservice/guide/api/georegeo)：`/v3/geocode/geo`。
- [地图单点标注](https://developer.amap.com/api/uri-api/guide/mobile-web/point)：`https://uri.amap.com/marker`，`coordinate=gaode`。

这些是中国境内高德 Web 服务接口。调用资格、免费配额、商业许可及字段可用性以你账户中的高德规定为准。没有 Key 时接口明确报配置未完成，不生成假数据。

## 使用与实现约定

- GPS 返回 WGS84，服务端调用官方接口转 GCJ-02；地理编码返回 GCJ-02，不重复转换。原始位置只存在于本次会话内存中。
- 半径 500/1000/2000/3000 米。每次获取按距离排序的前两页，每页最多 25 条。页面说明结果是最近最多 50 条，并非范围内所有餐厅。
- 类别按高德 `typecode` 和类别文本识别。中餐 `0501xx`、快餐 `0503xx`，面食以高德类别文本中的面食/面馆等标签细分，优先于中餐。没有明确面食标签时不会根据店名猜测，可能归入中餐/快餐。
- 价格、评分、营业时间、电话均使用高德真实返回字段；缺失字段显示暂无数据。没有时间不推断营业中。价格缺失或非正数标记为价格未知，设定预算时排除未知价格。
- 用 POI ID 去重，缺失 ID 时按名称和地址去重；无有效名称或坐标的条目排除。
- 转盘默认选最近 8 家，可调为 2–12 家；可从列表勾选/移除，或随机换一组候选。等概率仅针对当前转盘候选，不代表周边所有餐厅。
- 先随机选中一个索引，再计算扇区中心对准顶部固定指针的累计角度。旋转时冻结候选与筛选；结束后再展示结果，支持减少动态效果设置。
- 本地历史最多 20 条，仅保存名称、地址、抽取时间；不保存用户坐标或餐厅坐标。支持清除，浏览器禁用 localStorage 时仍可使用转盘。
- 前端查询有 2 秒冷却；接口严格校验经纬度、坐标系、半径、类别、分页、地址和城市长度。精确位置请求和响应使用 `no-store`，应用不记录精确坐标或上游完整错误。
- 本版本未设置共享后端限流。公开发布后可在 Cloudflare 配置 `/api/*` 限流，并在高德控制台设置配额，避免公开代理消耗超出预期。

## API

`GET /api/restaurants?lng=113.9&lat=22.6&radius=1000&coordsys=wgs84`

`coordsys` 可为 `wgs84`（默认）或 `gcj02`。可选 `category=all|chinese|fastfood|noodles|other`。不传 `page` 时最多获取两页；传 `page=1|2` 时获取指定页。返回标准化 `restaurants`、GCJ-02 `center`、`total`（高德 v5 不提供总量，未知时 null）以及是否截断 `truncated`。

`GET /api/geocode?address=深圳市南山区科技园&city=深圳`

返回 `locations` 地址候选列表，每个含 `label/lng/lat/coordsys`。多条结果由用户选择，不静默选择歧义地址；零条时提示补充城市或地标。

所有错误统一 `{ "error": "可展示的提示" }`，不透传 Key、请求地址或上游完整错误。

## 测试和构建

```powershell
npm test
npm run build
```

自动测试中的餐厅夹具仅用于验证边界，生产代码没有内置餐厅数据。测试覆盖筛选/去重、2–12 扇区连续旋转与指针一致性、官方地图 URI、API 参数校验、GPS 转换/手动地址不转换、两页合并、空字段、空结果、脱敏错误，以及前端定位拒绝、手动搜索、预算、旋转锁定和历史隐私。

真实定位授权、账户接口权限、配额及线上查询仍需要真实 Key 和浏览器/线上验证。详见 [执行记录](docs/progress.md)。

## Cloudflare Pages 部署

### 推荐：GitHub 持续部署

1. 创建 GitHub 仓库（例如 `dinner-wheel`），提交源代码、`package-lock.json`、`functions/`、`public/` 和 `wrangler.jsonc`。不提交 `.dev.vars`、`node_modules`、`dist`。
2. Cloudflare 控制台 → Workers & Pages → 创建应用 → Pages → 连接 Git，授权并选择 GitHub 仓库。
3. 构建命令 `npm run build`，输出目录 `dist`，根目录为仓库根目录，生产分支选自己的默认分支。构建环境设置 `NODE_VERSION=24`。
4. 项目设置 → Variables and Secrets → 添加 **Secret** `AMAP_WEB_KEY`（生产和预览环境按需分别设置）。它只供 Functions 使用，不使用 `VITE_` 前缀。
5. 重新部署，得到 `https://你的项目.pages.dev`。根目录的 `functions/` 由 Pages 自动构建，`dist/_routes.json` 限定仅 `/api/*` 进入 Functions。
6. 用 HTTPS 地址验证手动搜索、GPS 授权/拒绝、筛选、转盘、地图跳转和刷新后的历史。

### 另一种方式：Wrangler 直接部署

不依赖 GitHub，但建议先用 Git 备份源代码。**Direct Upload 创建的 Pages 项目后续不能直接改为 Git 集成，请先选定发布方式。**

```powershell
npx wrangler login
npx wrangler pages project create dinner-wheel --production-branch main
npx wrangler pages secret put AMAP_WEB_KEY --project-name dinner-wheel
npm run deploy -- --project-name dinner-wheel
```

Secret 命令会交互读取 Key，不把 Key 写进终端命令或源码。项目名若已占用，请替换命令与 `wrangler.jsonc` 的 `name`。部署脚本先类型检查并构建，再上传 `dist` 和根目录 Functions。

Cloudflare 控制台的纯静态文件拖拽上传不适合本项目的 Functions；使用 Git 集成或 Wrangler。

## 项目结构

```text
functions/api/       Pages Functions 两个入口
functions/lib/       高德请求、校验和标准化
src/components/     位置、筛选、转盘、餐厅与结果
src/services/       同源 API、浏览器定位、历史
src/utils/          筛选、去重、转盘与地图 URI
src/types/          前后端数据契约
tests/              单元与组件测试
docs/               用户原始方案、执行与验证记录
```

