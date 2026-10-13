# API 文档

平台对外开放 RESTful API，基础地址为 https://api.example.com/v1。

## 鉴权
所有接口需在请求头携带 Authorization: Bearer <access_token>。Token 通过登录接口获取，有效期 2 小时，可用刷新令牌续期。

## 常用接口
- GET /users/{id}：获取用户信息
- POST /projects：创建项目
- GET /projects/{id}/tasks：获取项目任务列表
- POST /files/upload：上传文件（multipart/form-data）

## 限流
默认每个 API Key 每分钟 100 次请求，超出返回 HTTP 429。需要更高配额可在控制台申请。
