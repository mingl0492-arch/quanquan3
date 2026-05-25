const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

app.setName("权权目标管理");

// 数据、缓存都固定在软件目录旁边，方便 U 盘/移动硬盘携带。
// 便携文件夹版目录结构：
// 权权目标管理便携版/
// ├─ 权权目标管理.exe
// ├─ resources/
// └─ 权权目标管理数据/
const baseDir = app.isPackaged
  ? path.dirname(app.getPath("exe"))
  : __dirname;

const dataDir = path.join(baseDir, "权权目标管理数据");
const cacheDir = path.join(dataDir, "Cache");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

app.setPath("userData", dataDir);
app.setPath("cache", cacheDir);

const storageFile = path.join(dataDir, "quanquan-data.json");

function readStore() {
  try {
    if (!fs.existsSync(storageFile)) return {};
    const raw = fs.readFileSync(storageFile, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error("读取本地数据失败：", error);
    return {};
  }
}

function writeStore(store) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmpFile = storageFile + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmpFile, storageFile);
  } catch (error) {
    console.error("保存本地数据失败：", error);
  }
}

ipcMain.on("qq-storage-get", (event, key) => {
  const store = readStore();
  event.returnValue = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
});

ipcMain.on("qq-storage-set", (event, key, value) => {
  const store = readStore();
  store[key] = String(value);
  writeStore(store);
  event.returnValue = true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    title: "权权目标管理",
    backgroundColor: "#f6f8fc",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "app", "index.html"));

  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const appFile = "file://" + path.join(__dirname, "app", "index.html").replace(/\\/g, "/");
    if (!url.startsWith(appFile)) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
