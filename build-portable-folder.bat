@echo off
chcp 65001 >nul
echo 正在安装依赖...
call npm install
if errorlevel 1 goto error

echo 正在打包快速便携文件夹版...
call npm run release:win
if errorlevel 1 goto error

echo.
echo 打包完成！请查看：
echo release\win-unpacked
echo.
echo 使用时复制整个 win-unpacked 文件夹，不要只复制 exe。
pause
exit /b 0

:error
echo.
echo 打包失败，请检查上面的错误信息。
pause
exit /b 1
