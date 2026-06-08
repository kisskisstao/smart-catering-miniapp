# 智慧餐饮微信小程序

智慧餐饮用户端微信小程序，提供扫码点餐、菜品浏览、规格选择、购物车、下单、模拟支付、订单状态跟踪、餐桌预约和个人中心等功能。后端依赖 `smart-catering-backend` 服务。

## 技术与运行环境

- 微信小程序原生框架
- 微信开发者工具
- JavaScript / WXML / WXSS
- 后端接口：`smart-catering-backend`
- 默认后端地址：`http://10.225.252.99:8080`
- 默认 WebSocket 地址：`ws://10.225.252.99:8080`

## 目录结构

```text
mini-program/
  app.js                       全局后端地址配置
  app.json                     页面、窗口和 tabBar 配置
  app.wxss                     全局样式
  project.config.json          微信开发者工具项目配置
  project.private.config.json  本地私有配置
  assets/                      默认图片和 tabBar 图标
  utils/
    request.js                 请求封装、登录、备用后端地址切换
    socket.js                  WebSocket 连接封装
    cart.js                    本地购物车与结算快照
    util.js                    通用工具
  pages/
    menu/                      点单页
    cart/                      购物车
    order-history/             订单列表
    profile/                   个人中心
    reservation/               餐桌预约
    reservation-list/          我的预约
    index/                     首页/扫码入口
    dish-detail/               菜品详情
    payment/                   模拟支付
    order-detail/              订单详情和实时状态
```

## 页面功能

| 页面 | 路径 | 功能 |
| --- | --- | --- |
| 点单 | `pages/menu/menu` | 菜品分类、热门菜品、搜索、规格选择、加入购物车、立即购买、扫码换桌、进入预约 |
| 购物车 | `pages/cart/cart` | 查看桌台购物车、调整数量、清空购物车、提交订单 |
| 订单 | `pages/order-history/order-history` | 查看历史订单，按状态筛选 |
| 我的 | `pages/profile/profile` | 静默登录、用户信息入口、预约列表入口 |
| 预约 | `pages/reservation/reservation` | 查看空闲桌台、填写预约信息、提交预约，支持桌台状态 WebSocket 刷新 |
| 我的预约 | `pages/reservation-list/reservation-list` | 查看和取消预约 |
| 首页 | `pages/index/index` | 登录、推荐菜品、扫码点餐入口 |
| 菜品详情 | `pages/dish-detail/dish-detail` | 菜品详情、规格选择、加入购物车 |
| 支付 | `pages/payment/payment` | 15 分钟倒计时、模拟支付、超时自动取消 |
| 订单详情 | `pages/order-detail/order-detail` | 订单明细、状态步骤、取消待支付订单、WebSocket 实时状态 |

tabBar 页面：

- `pages/menu/menu`
- `pages/cart/cart`
- `pages/order-history/order-history`
- `pages/profile/profile`

## 后端配置

后端地址在 `app.js` 中配置：

```js
App({
  globalData: {
    baseUrl: 'http://10.225.252.99:8080',
    wsBaseUrl: 'ws://10.225.252.99:8080',
    apiBaseUrls: [
      'http://10.225.252.99:8080',
      'http://127.0.0.1:8080'
    ]
  }
})
```

说明：

- `baseUrl` 是默认 REST API 地址。
- `wsBaseUrl` 是默认 WebSocket 地址。
- `apiBaseUrls` 是备用 REST API 地址列表。请求出现 `timeout` 或 `request:fail` 时，`utils/request.js` 会自动尝试下一个地址，并把可用地址写回 `globalData.baseUrl`。
- 真机调试时不要使用 `127.0.0.1` 指向电脑后端，应改成电脑当前局域网 IP。

查看电脑当前 IPv4：

```powershell
Get-NetIPAddress -AddressFamily IPv4
```

确认后端是否可访问：

```powershell
Invoke-RestMethod "http://10.225.252.99:8080/user/mock-login?code=test"
Invoke-RestMethod "http://10.225.252.99:8080/dish/list?storeId=1"
```

## 后端启动

先启动后端项目 `smart-catering-backend`：

```powershell
cd E:\OvOTAO\code\smart-catering-backend\smart-catering-backend
.\mvnw.cmd clean package -DskipTests
java -jar target\smart-catering-backend-0.0.1-SNAPSHOT.jar
```

如果端口被占用：

```powershell
Get-NetTCPConnection -LocalPort 8080
```

当前小程序需要后端至少提供这些接口：

- `GET /user/mock-login`
- `GET /dish/list`
- `GET /dish/detail/{id}`
- `GET /merchant/category/list`
- `GET /table/list`
- `GET /table/scan`
- `POST /order/create`
- `POST /order/{orderId}/pay`
- `PUT /order/{orderId}/cancel`
- `GET /order/history`
- `GET /order/detail/{orderId}`
- `POST /reservation/create`
- `GET /reservation/my`
- `PUT /reservation/{id}/cancel`

## 导入和运行

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择 `E:\OvOTAO\code\mini-program`。
4. AppID 使用 `project.config.json` 中的 `wx433ddab95c687e43`，或选择测试号。
5. 确认后端服务已启动并监听 `8080`。
6. 点击“编译”运行。

本地调试配置：

- `project.private.config.json` 中已设置 `setting.urlCheck: false`，开发者工具本地调试时不校验合法域名。
- 如果真机预览仍请求失败，需要保证手机和电脑在同一局域网，并且电脑防火墙允许 Java/8080 端口入站。
- 小程序发布版必须使用 HTTPS 域名，并在微信公众平台配置 request/socket 合法域名。

## 登录与请求封装

请求工具位于 `utils/request.js`。

- `loginSilently()` 调用 `wx.login()` 获取 code。
- 当前后端使用 mock 登录接口：`GET /user/mock-login?code=xxx`。
- 登录成功后把 `token` 和 `userInfo` 写入本地缓存。
- 订单和预约接口需要 token 时会自动静默登录。
- token 请求头格式：

```http
Authorization: Bearer <token>
```

统一请求示例：

```js
const { request } = require('../../utils/request')

const dishes = await request({
  url: '/dish/list',
  data: {
    storeId: 1,
    type: 'HOT'
  }
})
```

## 购物车

购物车工具位于 `utils/cart.js`。

- 按桌台隔离购物车：`cart_{tableId}`。
- 同一菜品会按 `dishId + spicy + size` 合并。
- 下单前会保存待结算快照，避免页面跳转或支付失败后购物车丢失。
- 支付成功后清理对应桌台和订单快照。

## 支付与订单

当前支付为模拟支付：

- 创建订单后进入 `pages/payment/payment`。
- 支付倒计时为 15 分钟。
- 用户确认支付后调用 `POST /order/{orderId}/pay`。
- 超时会自动调用 `PUT /order/{orderId}/cancel`。
- 支付成功后进入订单详情页。

订单状态：

- `PENDING_PAYMENT`：待支付
- `WAIT_ACCEPT`：商家待接单
- `COOKING`：制作中
- `COMPLETED`：已完成
- `CANCELLED`：已取消

## WebSocket

WebSocket 工具位于 `utils/socket.js`。

当前支持：

- `connectOrderSocket(orderId)`：连接 `/ws/order/{orderId}`，接收订单状态变更。
- `connectTableStatusSocket(storeId)`：连接 `/ws/table/status?storeId={storeId}`，接收餐桌状态变更。

消息示例：

```json
{"type":"ORDER_STATUS_CHANGE","orderId":1,"status":"COOKING"}
```

```json
{"type":"TABLE_STATUS_CHANGED","storeId":1,"tableId":1,"tableNo":"A01","status":"OCCUPIED","seats":4}
```

连接断开后默认 3 秒重连。

## 常见问题

### 显示“网络异常”或“网络错误”

1. 确认后端已经启动。
2. 确认 `app.js` 中 `baseUrl` 是电脑当前局域网 IP。
3. 在电脑上执行：

```powershell
Invoke-RestMethod "http://10.225.252.99:8080/user/mock-login?code=test"
```

4. 微信开发者工具 Console 查看日志：
   - `[request base failed]` 表示某个后端地址不可达。
   - `[api base switched]` 表示已自动切换到备用地址。
5. 真机调试时确认手机和电脑在同一 Wi-Fi。
6. 检查 Windows 防火墙是否允许 Java 访问网络。

### 开发者工具能访问，真机不能访问

- 不要把 `baseUrl` 配成 `127.0.0.1`。
- 使用电脑 WLAN IPv4，例如 `http://10.225.252.99:8080`。
- 手机和电脑必须在同一个局域网。
- 防火墙需要放行 8080 端口或 Java 进程。

### 提示 request 合法域名错误

- 本地开发确认 `project.private.config.json` 中 `urlCheck` 为 `false`。
- 上传发布必须使用 HTTPS，并在微信公众平台配置合法域名。

