const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { XMLBuilder } = require('fast-xml-parser');
const fetch = require('node-fetch');

// Variable para almacenar la ventana principal
let mainWindow;

// Crear la ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'RouteCreator - Creador de Rutas GPX',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Cargar el archivo HTML principal
  mainWindow.loadFile('index.html');

  // Abrir DevTools en desarrollo para depuración
  // mainWindow.webContents.openDevTools();
}

// Evento cuando la aplicación está lista
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Salir de la aplicación cuando todas las ventanas estén cerradas (excepto en macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Manejo de eventos IPC para guardar rutas en formato GPX
ipcMain.handle('save-gpx', async (event, routeData) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Guardar ruta como GPX',
      defaultPath: 'mi-ruta.gpx',
      filters: [{ name: 'Archivos GPX', extensions: ['gpx'] }],
    });

    if (!filePath) return { success: false, message: 'Operación cancelada' };

    // Construir el XML para el archivo GPX
    const gpxContent = buildGPXContent(routeData);

    // Guardar el archivo
    fs.writeFileSync(filePath, gpxContent);

    return { success: true, filePath };
  } catch (error) {
    console.error('Error al guardar el archivo GPX:', error);
    return { success: false, message: error.message };
  }
});

// Manejo de eventos IPC para importar rutas en formato GPX
ipcMain.handle('import-gpx', async event => {
  try {
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Importar archivo GPX',
      filters: [{ name: 'Archivos GPX', extensions: ['gpx'] }],
      properties: ['openFile'],
    });

    if (!filePaths || filePaths.length === 0) {
      return { success: false, message: 'Operación cancelada' };
    }

    // Leer el contenido del archivo GPX
    const gpxContent = fs.readFileSync(filePaths[0], 'utf8');

    return { success: true, content: gpxContent, filePath: filePaths[0] };
  } catch (error) {
    console.error('Error al importar el archivo GPX:', error);
    return { success: false, message: error.message };
  }
});

// Manejador para solicitudes de enrutamiento desde el renderer
ipcMain.handle('fetch-route', async (event, requestData) => {
  try {
    const { profile, coordinates, apiKey } = requestData;

    // URL de la API de OpenRouteService
    const apiUrl = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

    // Realizar la solicitud
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: coordinates,
        profile: profile,
        format: 'geojson',
      }),
    });

    // Verificar si la respuesta es correcta
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Error en la API (${response.status}): ${errorText}`,
      };
    }

    // Analizar la respuesta JSON
    const data = await response.json();

    return { success: true, data: data };
  } catch (error) {
    console.error('Error al realizar la solicitud de ruta:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para solicitudes de descarga de mapas
ipcMain.handle('download-tile', async (event, tileUrl) => {
  try {
    const response = await fetch(tileUrl);

    if (!response.ok) {
      throw new Error(`Error descargando tesela: ${response.status}`);
    }

    // Convertir la respuesta a un array buffer
    const buffer = await response.arrayBuffer();

    return { success: true, data: buffer };
  } catch (error) {
    console.error('Error descargando tesela:', error);
    return { success: false, error: error.message };
  }
});

// Función para construir el contenido GPX
function buildGPXContent(routeData) {
  const { name, type, waypoints, pois, metadata, stats } = routeData;

  // Preparar descripción ampliada con metadatos
  let extendedDesc = `Ruta para ${type}`;

  if (stats && stats.totalDistance) {
    // Convertir distancia de metros a kilómetros
    const distanceKm = (stats.totalDistance / 1000).toFixed(2);
    extendedDesc += `. Distancia total: ${distanceKm} km`;
  }

  // Añadir metadatos específicos según tipo de ruta
  if (metadata) {
    if (type === 'MTB') {
      extendedDesc += `. Dificultad: ${metadata.difficulty}, Superficie: ${metadata.surface}`;
    } else if (type === 'Road') {
      extendedDesc += `. Tráfico: ${metadata.traffic}, Calidad del asfalto: ${metadata.surface}`;
    } else if (type === 'Motorhome') {
      extendedDesc += `. Altura máx: ${metadata.maxHeight}m, Carreteras: ${metadata.roadTypes}`;
      if (metadata.includeParking) {
        extendedDesc += `, Incluye áreas de pernocta`;
      }
    }
  }

  // Información sobre POIs si existen
  if (pois && pois.length > 0) {
    extendedDesc += `. Puntos de interés: ${pois.length}`;
  }

  // Objeto base GPX
  const gpxObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    gpx: {
      '@_version': '1.1',
      '@_creator': 'RouteCreator App',
      '@_xmlns': 'http://www.topografix.com/GPX/1/1',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xsi:schemaLocation': 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd',
      metadata: {
        name: name,
        desc: extendedDesc,
        time: new Date().toISOString(),
        keywords: type, // Útil para búsquedas
        extensions: metadata
          ? {
              route_metadata: {
                type: type,
                ...metadata,
                total_distance_meters: stats?.totalDistance || 0,
                poi_count: stats?.poiCount || 0,
              },
            }
          : undefined,
      },
      trk: {
        name: name,
        type: type,
        trkseg: {
          trkpt: waypoints.map(wp => ({
            '@_lat': wp.lat,
            '@_lon': wp.lng,
            ele: wp.elevation || 0,
            time: wp.time || new Date().toISOString(),
          })),
        },
      },
    },
  };

  // Añadir puntos de interés como waypoints en el GPX
  if (pois && pois.length > 0) {
    gpxObj.gpx.wpt = pois.map(poi => ({
      '@_lat': poi.lat,
      '@_lon': poi.lng,
      name: poi.description,
      desc: `${poi.description} - ${poi.type}`,
      sym: mapPoiTypeToGarminSymbol(poi.type), // Símbolo Garmin compatible
      type: poi.type,
      time: poi.time || new Date().toISOString(),
    }));
  }

  // Opciones para la conversión a XML
  const options = {
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  };

  const builder = new XMLBuilder(options);
  return builder.build(gpxObj);
}

// Función para mapear tipos de POI a símbolos compatibles con Garmin
function mapPoiTypeToGarminSymbol(poiType) {
  const symbolMap = {
    parking: 'Parking Area',
    service: 'Gas Station',
    water: 'Drinking Water',
    fuel: 'Gas Station',
    lpg: 'Gas Station',
    viewpoint: 'Scenic Area',
  };

  return symbolMap[poiType] || 'Flag, Blue';
}
