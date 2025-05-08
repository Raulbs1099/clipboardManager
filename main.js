const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');

async function loadClipboardy() {
    const clipboardy = await import('clipboardy');
    return clipboardy.default;
}

let win = null;
let tray = null;

function createWindow() {
    win = new BrowserWindow({
        width: 400,
        height: 600,
        show: false,
        frame: false,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    win.loadFile('index.html');

    win.on('ready-to-show', () => {
        win.setAlwaysOnTop(true, 'pop-up');
        win.center();
    });

    win.on('closed', () => {
        win = null;
    });

    return win;
}

app.setActivationPolicy('accessory'); // Ejecutar como agente, sin ícono en el Dock

app.whenReady().then(async () => {
    win = createWindow();
    const clipboardy = await loadClipboardy();

    // Habilitar autoarranque
    app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
    });

    // Bandeja del sistema
    try {
        tray = new Tray(path.join(__dirname, 'icon.png'));
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Mostrar Historial',
                click: () => {
                    if (!win) win = createWindow();
                    win.show();
                    win.focus();
                }
            },
            { label: 'Salir', click: () => app.quit() }
        ]);
        tray.setToolTip('Historial del Portapapeles');
        tray.setContextMenu(contextMenu);
    } catch (err) {
        console.error('Error al crear la bandeja del sistema:', err);
    }

    // Registrar atajo global Command + Shift + V
    const shortcut = 'CommandOrControl+Shift+V';
    const registered = globalShortcut.register(shortcut, () => {
        if (!win) win = createWindow();
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    });

    if (!registered) {
        console.error(`No se pudo registrar el atajo ${shortcut}. Intenta cambiarlo.`);
    }

    // Manejar mensaje IPC para ocultar la ventana
    ipcMain.on('hide-window', () => {
        if (win) win.hide();
    });

    // Monitorear el portapapeles
    let lastText = '';
    let lastImage = '';
    try {
        lastText = clipboardy.readSync();
    } catch (err) {
        console.error('Error al leer el portapapeles de texto inicialmente:', err);
    }

    setInterval(() => {
        try {
            const currentText = clipboardy.readSync();
            if (currentText !== lastText && currentText) {
                lastText = currentText;
                if (win) win.webContents.send('clipboard-update', { type: 'text', data: currentText });
            }

            const image = clipboard.readImage();
            if (!image.isEmpty()) {
                const base64Image = image.toDataURL();
                if (base64Image !== lastImage) {
                    lastImage = base64Image;
                    if (win) win.webContents.send('clipboard-update', { type: 'image', data: base64Image });
                }
            }
        } catch (err) {
            console.error('Error al leer el portapapeles:', err);
        }
    }, 1000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) win = createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});