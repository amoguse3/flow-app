"use strict";
const electron = require("electron");
const path = require("path");
const memoryIpc = require("./chunks/memory-ipc-bLie0Z8U.js");
const electronUpdater = require("electron-updater");
require("node:vm");
require("crypto");
require("fs");
require("sql.js");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
function createMainWindow() {
  const win = new electron.BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: "#080606",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#080606",
      symbolColor: "#d97706",
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    show: false
  });
  win.on("ready-to-show", () => {
    win.show();
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !url.startsWith("http://localhost")) {
      event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      electron.shell.openExternal(url);
    }
    return { action: "deny" };
  });
  if (!is.dev) {
    win.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12" || input.control && input.shift && (input.key === "I" || input.key === "J" || input.key === "C") || input.control && input.key === "u") {
        event.preventDefault();
      }
    });
  }
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}
let tray = null;
function createTray(getWindow2) {
  const iconPath = path.join(__dirname, "../../resources/icon.png");
  let icon;
  try {
    icon = electron.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = electron.nativeImage.createEmpty();
  }
  tray = new electron.Tray(icon);
  tray.setToolTip("Wispucci Ai beta");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Show Wispucci AI beta",
      click: () => {
        const win = getWindow2();
        if (win) {
          win.show();
          win.focus();
        }
      }
    },
    {
      label: "Ascunde",
      click: () => {
        const win = getWindow2();
        if (win) win.hide();
      }
    },
    { type: "separator" },
    {
      label: "Ctrl+Shift+A — toggle rapid",
      enabled: false
    },
    { type: "separator" },
    {
      label: "Quit Wispucci AI beta",
      click: () => {
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    const win = getWindow2();
    if (!win) return;
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
      win.focus();
    }
  });
  return tray;
}
function registerHotkey(getWindow2) {
  electron.globalShortcut.register("CommandOrControl+Shift+A", () => {
    const win = getWindow2();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
}
function unregisterHotkeys() {
  electron.globalShortcut.unregisterAll();
}
let overlayWindow = null;
function shouldUseOverlay() {
  const profile = memoryIpc.getState("profile");
  return Boolean(profile?.onboardingDone) && profile?.orbEnabled !== false;
}
const REMINDERS = [
  "Don't forget to drink water! 💧",
  "You have unfinished courses! 📚",
  "A short break helps your brain.",
  "Let's learn something new!",
  "Progress is built step by step.",
  "You're on the right track! ⭐",
  "Memory improves with daily reps.",
  "Focus. You can do this. 💪",
  "One small step today = success tomorrow.",
  "Did you check your tasks today?"
];
function createWindow() {
  const { width: screenW, height: screenH } = electron.screen.getPrimaryDisplay().workAreaSize;
  const winW = 300;
  const winH = 350;
  const win = new electron.BrowserWindow({
    width: winW,
    height: winH,
    x: screenW - winW - 16,
    y: screenH - winH - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/overlay.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"] + "/overlay.html");
  } else {
    win.loadFile(path.join(__dirname, "../renderer/overlay.html"));
  }
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on("closed", () => {
    overlayWindow = null;
  });
  return win;
}
function registerOverlayIpc(getMainWindow) {
  electron.ipcMain.on("overlay:setClickThrough", (_, ignore) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      if (ignore) {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        overlayWindow.setIgnoreMouseEvents(false);
      }
    }
  });
  electron.ipcMain.on("overlay:dragMove", (_, dx, dy) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      const [w, h] = overlayWindow.getSize();
      const display = electron.screen.getDisplayNearestPoint({ x, y });
      const { x: sx, y: sy, width: sw, height: sh } = display.workArea;
      const nx = Math.max(sx, Math.min(sx + sw - w, x + dx));
      const ny = Math.max(sy, Math.min(sy + sh - h, y + dy));
      overlayWindow.setPosition(nx, ny);
    }
  });
  electron.ipcMain.handle("overlay:getReminder", () => {
    return { text: REMINDERS[Math.floor(Math.random() * REMINDERS.length)] };
  });
  electron.ipcMain.handle("overlay:getOrbSize", () => {
    const profile = memoryIpc.getState("profile");
    return profile?.orbSize || "medium";
  });
  electron.ipcMain.on("overlay:openMain", () => {
    const main = getMainWindow();
    if (main) {
      main.show();
      main.focus();
    }
    overlayWindow?.hide();
  });
  electron.ipcMain.on("overlay:sendToChat", (_, message) => {
    const main = getMainWindow();
    if (main) {
      main.show();
      main.focus();
      main.webContents.send("overlay:chatMessage", message);
    }
    overlayWindow?.hide();
  });
  electron.ipcMain.handle("overlay:setEnabled", (_, enabled) => {
    if (enabled) {
      ensureOverlayWindow();
    } else {
      hideOverlay();
    }
  });
  electron.ipcMain.handle("overlay:setSize", (_, size) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("overlay:sizeChange", size);
    }
  });
}
function ensureOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  overlayWindow = createWindow();
  return overlayWindow;
}
function initOverlay() {
  if (shouldUseOverlay()) {
    overlayWindow = createWindow();
  }
}
function showOverlay() {
  if (!shouldUseOverlay()) return;
  ensureOverlayWindow();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive();
  }
}
function hideOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}
function sendUpdateStatus(mainWindow2, text) {
  if (!mainWindow2 || mainWindow2.isDestroyed()) return;
  mainWindow2.webContents.send("app:updateStatus", text);
}
function initAutoUpdater(getMainWindow) {
  if (!electron.app.isPackaged) return;
  electronUpdater.autoUpdater.autoDownload = true;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  electronUpdater.autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus(getMainWindow(), "Checking for updates...");
  });
  electronUpdater.autoUpdater.on("update-available", (info) => {
    sendUpdateStatus(getMainWindow(), `Update available: v${info.version}`);
  });
  electronUpdater.autoUpdater.on("update-not-available", () => {
    sendUpdateStatus(getMainWindow(), "The app is up to date.");
  });
  electronUpdater.autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus(getMainWindow(), `Downloading update: ${Math.round(progress.percent)}%`);
  });
  electronUpdater.autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus(getMainWindow(), `Update downloaded (v${info.version}). It will install on the next close.`);
  });
  electronUpdater.autoUpdater.on("error", (err) => {
    sendUpdateStatus(getMainWindow(), `Update error: ${err.message}`);
  });
  const safeCheck = () => {
    electronUpdater.autoUpdater.checkForUpdates().catch(() => {
    });
  };
  setTimeout(safeCheck, 15e3);
  setInterval(safeCheck, 30 * 60 * 1e3);
}
let mainWindow = null;
function getWindow() {
  return mainWindow;
}
function isDeepSeekKey(value) {
  return typeof value === "string" && /^sk-(?!ant-)/.test(value.trim());
}
function isGroqKey(value) {
  return typeof value === "string" && /^gsk_/.test(value.trim());
}
electron.app.whenReady().then(async () => {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://api.groq.com https://api.deepseek.com https://wisp-flow.vercel.app; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com"
        ]
      }
    });
  });
  electron.app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
  electronApp.setAppUserModelId("app.wispflow.wispucci-ai-beta");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  await memoryIpc.initDB();
  const savedClaudeKey = memoryIpc.getState("claudeApiKey");
  const envClaudeKey = process.env["DEEPSEEK_API_KEY"] || process.env["CLAUDE_API_KEY"] || process.env["ANTHROPIC_API_KEY"] || "";
  const resolvedClaudeKey = isDeepSeekKey(savedClaudeKey) ? savedClaudeKey.trim() : isDeepSeekKey(envClaudeKey) ? envClaudeKey.trim() : "";
  memoryIpc.setClaudeApiKey(resolvedClaudeKey);
  if (resolvedClaudeKey && savedClaudeKey !== resolvedClaudeKey) {
    memoryIpc.setState("claudeApiKey", resolvedClaudeKey);
  }
  const savedGroqKey = memoryIpc.getState("groqApiKey");
  const envGroqKey = process.env["GROQ_API_KEY"] || "";
  const resolvedGroqKey = isGroqKey(savedGroqKey) ? savedGroqKey.trim() : isGroqKey(envGroqKey) ? envGroqKey.trim() : "";
  memoryIpc.setGroqApiKey(resolvedGroqKey);
  if (resolvedGroqKey && savedGroqKey !== resolvedGroqKey) {
    memoryIpc.setState("groqApiKey", resolvedGroqKey);
  }
  memoryIpc.registerIpcHandlers();
  memoryIpc.registerEducatorIpc();
  memoryIpc.reconcileInterruptedCourseGeneration();
  memoryIpc.registerVoiceIpc();
  memoryIpc.registerGamesIpc();
  memoryIpc.registerSyncIpc();
  memoryIpc.registerMemoryIpc();
  registerOverlayIpc(getWindow);
  mainWindow = createMainWindow();
  createTray(getWindow);
  registerHotkey(getWindow);
  initOverlay();
  memoryIpc.getMachineId();
  memoryIpc.startTelemetryLoop();
  initAutoUpdater(getWindow);
  mainWindow.on("minimize", () => showOverlay());
  mainWindow.on("hide", () => showOverlay());
  mainWindow.on("restore", () => hideOverlay());
  mainWindow.on("show", () => hideOverlay());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});
electron.app.on("will-quit", () => {
  memoryIpc.saveDBSync();
  unregisterHotkeys();
});
electron.app.on("window-all-closed", () => {
});
