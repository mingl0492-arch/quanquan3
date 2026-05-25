@echo off
chcp 65001 >nul
if not exist ".github\workflows" mkdir ".github\workflows"
copy /Y "github-workflow-网页上传备用\build-windows.yml" ".github\workflows\build-windows.yml"
echo 已生成：.github\workflows\build-windows.yml
pause
