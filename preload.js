const { contextBridge, ipcRenderer } = require("electron");

// 与 localStorage 类似，但实际保存到软件目录旁边的 JSON 文件：
// 权权目标管理数据/quanquan-data.json
contextBridge.exposeInMainWorld("qqStorage", {
  getItem(key) {
    return ipcRenderer.sendSync("qq-storage-get", key);
  },
  setItem(key, value) {
    return ipcRenderer.sendSync("qq-storage-set", key, String(value));
  }
});
