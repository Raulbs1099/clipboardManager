const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu, screen } = require('electron');
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
        // Posicionar la ventana a la derecha del cursor
        const cursorPoint = screen.getCursorScreenPoint();
        const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
        const { width, height } = win.getBounds();
        const displayBounds = currentDisplay.workArea;

        // Calcular la posición (a la derecha del cursor, con un margen)
        let x = cursorPoint.x + 10; // 10px a la derecha del cursor
        let y = cursorPoint.y;

        // Asegurarse de que la ventana no se salga de la pantalla
        if (x + width > displayBounds.x + displayBounds.width) {
            x = displayBounds.x + displayBounds.width - width;
        }
        if (y + height > displayBounds.y + displayBounds.height) {
            y = displayBounds.y + displayBounds.height - height;
        }
        if (x < displayBounds.x) x = displayBounds.x;
        if (y < displayBounds.y) y = displayBounds.y;

        win.setPosition(x, y);
    });

    win.on('closed', () => {
        win = null;
    });

    // Ocultar de la barra de tareas en Windows
    if (process.platform === 'win32') {
        win.setSkipTaskbar(true);
    }

    return win;
}

// Ejecutar como agente solo en macOS
if (process.platform === 'darwin') {
    app.setActivationPolicy('accessory');
}

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
                    // Reposicionar al abrir desde la bandeja
                    const cursorPoint = screen.getCursorScreenPoint();
                    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
                    const { width, height } = win.getBounds();
                    const displayBounds = currentDisplay.workArea;

                    let x = cursorPoint.x + 10;
                    let y = cursorPoint.y;

                    if (x + width > displayBounds.x + displayBounds.width) {
                        x = displayBounds.x + displayBounds.width - width;
                    }
                    if (y + height > displayBounds.y + displayBounds.height) {
                        y = displayBounds.y + displayBounds.height - height;
                    }
                    if (x < displayBounds.x) x = displayBounds.x;
                    if (y < displayBounds.y) y = displayBounds.y;

                    win.setPosition(x, y);
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

    // Registrar atajo global CommandOrControl + Shift + V
    const shortcut = 'CommandOrControl+Shift+V';
    const registered = globalShortcut.register(shortcut, () => {
        if (!win) win = createWindow();
        if (win.isVisible()) {
            win.hide();
        } else {
            // Reposicionar al abrir con el atajo
            const cursorPoint = screen.getCursorScreenPoint();
            const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);
            const { width, height } = win.getBounds();
            const displayBounds = currentDisplay.workArea;

            let x = cursorPoint.x + 10;
            let y = cursorPoint.y;

            if (x + width > displayBounds.x + displayBounds.width) {
                x = displayBounds.x + displayBounds.width - width;
            }
            if (y + height > displayBounds.y + displayBounds.height) {
                y = displayBounds.y + displayBounds.height - height;
            }
            if (x < displayBounds.x) x = displayBounds.x;
            if (y < displayBounds.y) y = displayBounds.y;

            win.setPosition(x, y);
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