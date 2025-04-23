const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, data) => {
      // Lista blanca de canales IPC permitidos
      const validChannels = ['save-gpx', 'import-gpx', 'fetch-route', 'download-tile'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
  },
});

// Exponer APIs para acceder al sistema de archivos
contextBridge.exposeInMainWorld('fs', {
  readFile: (path, options) => require('fs').readFileSync(path, options),
  writeFile: (path, data) => require('fs').writeFileSync(path, data),
});

// Exponer APIs para el almacenamiento local
contextBridge.exposeInMainWorld('os', {
  type: () => require('os').type(),
  platform: () => require('os').platform(),
  homedir: () => require('os').homedir(),
});

// Exponer APIs para las rutas de la aplicación
contextBridge.exposeInMainWorld('paths', {
  appData: () => {
    const electron = require('electron');
    return {
      userData: electron.app ? electron.app.getPath('userData') : '',
      appPath: electron.app ? electron.app.getAppPath() : '',
    };
  },
});
