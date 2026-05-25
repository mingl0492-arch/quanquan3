# GitHub 网页上传漏掉 .github 的解决方法

如果上传后 Actions 页面仍然显示 “Get started with GitHub Actions”，说明 `.github/workflows/build-windows.yml` 没有上传成功。

不用重新上传全部文件，只需要：

1. 打开仓库 Code 页面。
2. 点击 Add file。
3. 选择 Create new file。
4. 文件名输入：

.github/workflows/build-windows.yml

5. 内容复制：

GITHUB_ACTIONS_WORKFLOW_网页上传备用.yml

6. 点击 Commit changes。

然后回到 Actions，就能看到 Build Windows Portable Folder。
