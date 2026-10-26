const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: "#f5f7f3",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_web, _permission, callback) => callback(false),
  );
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
