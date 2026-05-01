"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("overlayAPI", {
  getReminder: () => electron.ipcRenderer.invoke("overlay:getReminder"),
  openMain: () => electron.ipcRenderer.send("overlay:openMain"),
  sendToChat: (message) => electron.ipcRenderer.send("overlay:sendToChat", message),
  getOrbSize: () => electron.ipcRenderer.invoke("overlay:getOrbSize"),
  onSizeChange: (callback) => {
    electron.ipcRenderer.on("overlay:sizeChange", (_event, size) => callback(size));
  },
  setClickThrough: (ignore) => electron.ipcRenderer.send("overlay:setClickThrough", ignore),
  dragMove: (dx, dy) => electron.ipcRenderer.send("overlay:dragMove", dx, dy)
});
