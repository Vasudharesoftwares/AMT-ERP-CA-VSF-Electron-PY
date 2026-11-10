const { app, BrowserWindow } = require('electron');
const path = require('node:path');
app.setName('Vasudhare Salesforce');
function createWindow() {
  const win = new BrowserWindow({
    title: 'Vasudhare Salesforce',
    width: 1440, height: 920, minWidth: 1100, minHeight: 700,
    backgroundColor: '#f5f7fb',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  if (!app.isPackaged) win.loadURL('http://127.0.0.1:5173');
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
