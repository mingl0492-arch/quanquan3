# SECURITY

## 本地优先

本项目是本地桌面应用。默认情况下，目标数据只保存在本机，不上传到云端。

## 数据位置

快速便携文件夹版会把数据和缓存保存在软件目录旁边：

```text
权权目标管理数据/quanquan-data.json
权权目标管理数据/Cache/
```

## 已做的安全限制

- Electron `nodeIntegration` 关闭。
- Electron `contextIsolation` 开启。
- 页面通过受控 IPC 保存数据，不直接访问任意系统文件。
- 默认不允许应用内打开未知窗口或跳转到外部页面。

## 仍需注意

本应用的本地数据未做强加密。请保护好自己的 Windows 登录账户、电脑硬盘、U 盘、备份盘和 GitHub 仓库权限。
