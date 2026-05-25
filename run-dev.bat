@echo off
chcp 65001 >nul
echo 正在安装依赖...
call npm install
if errorlevel 1 goto error

echo 正在启动本地预览...
call npm run start
if errorlevel 1 goto error

exit /b 0

:error
echo.
echo 启动失败，请检查上面的错误信息。
pause
exit /b 1
