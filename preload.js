const { contextBridge, ipcRenderer } = require('electron');

// Lista blanca de canales IPC permitidos
const VALID_CHANNELS = ['save-gpx', 'import-gpx', 'fetch-route', 'download-tile', 'get-config'];

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, data) => {
      if (VALID_CHANNELS.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
  },
});
