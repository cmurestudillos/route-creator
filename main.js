const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { XMLBuilder } = require('fast-xml-parser');

// Cargar configuración desde config.json (gitignored) con fallback a config.example.json
let appConfig = {};
try {
  appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch {
  try {
    appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.example.json'), 'utf8'));
  } catch {
    appConfig = { openRouteServiceApiKey: '' };
  }
}

// User-Agent identificable: la política de uso de teselas de OpenStreetMap lo exige
const USER_AGENT = `RouteCreator/${app.getVersion()} (+https://github.com/cmurestudillos/route-creator)`;

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

  // Los enlaces externos (p. ej. la atribución del mapa) se abren en el navegador del sistema:
  // sin esto, un clic en "Leaflet" u "OpenStreetMap" sacaba la ventana de la app sin forma de volver
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalLink(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    openExternalLink(url);
  });

  // Cargar el archivo HTML principal
  mainWindow.loadFile('index.html');

  // Abrir DevTools en desarrollo para depuración
  // mainWindow.webContents.openDevTools();
}

// Abre en el navegador del sistema solo URLs http(s)
function openExternalLink(url) {
  if (/^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
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

// Exponer configuración al renderer de forma segura (solo campos permitidos)
ipcMain.handle('get-config', () => ({
  openRouteServiceApiKey: appConfig.openRouteServiceApiKey || '',
}));

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
ipcMain.handle('import-gpx', async () => {
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

// Perfiles de OpenRouteService que ofrece la interfaz
const ROUTING_PROFILES = ['driving-car', 'driving-hgv', 'cycling-regular', 'cycling-mountain', 'foot-hiking'];

// Servidores de teselas permitidos para la descarga offline
const TILE_URL_PATTERNS = [
  /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\//,
  /^https:\/\/([abc]\.)?tile\.openstreetmap\.fr\//,
  /^https:\/\/server\.arcgisonline\.com\//,
];

// Lista de pares [lng, lat] numéricos (OpenRouteService admite como máximo 50 puntos)
function isValidCoordinateList(coordinates) {
  return (
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    coordinates.length <= 50 &&
    coordinates.every(c => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite))
  );
}

// Manejador para solicitudes de enrutamiento desde el renderer
ipcMain.handle('fetch-route', async (event, requestData) => {
  try {
    const { profile, coordinates, apiKey } = requestData || {};

    if (!ROUTING_PROFILES.includes(profile)) {
      return { success: false, error: `Perfil de ruta no válido: ${profile}` };
    }
    if (!isValidCoordinateList(coordinates)) {
      return { success: false, error: 'Coordenadas no válidas' };
    }

    // URL de la API de OpenRouteService
    const apiUrl = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

    // Realizar la solicitud
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(30000),
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
    // Solo se descargan teselas de los servidores de mapas que usa la app
    if (typeof tileUrl !== 'string' || !TILE_URL_PATTERNS.some(pattern => pattern.test(tileUrl))) {
      throw new Error('URL de tesela no permitida');
    }

    const response = await fetch(tileUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000),
    });

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

// Espacio de nombres de las extensiones propias del GPX
const ROUTE_CREATOR_NS = 'https://github.com/cmurestudillos/route-creator';

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

  // Puntos de interés como waypoints (<wpt>). El esquema GPX 1.1 fija el orden de los
  // elementos: en <gpx> metadata → wpt → trk, y en <wpt> time → name → desc → sym → type
  const wpt =
    pois && pois.length > 0
      ? pois.map(poi => ({
          '@_lat': poi.lat,
          '@_lon': poi.lng,
          time: poi.time || new Date().toISOString(),
          name: poi.description,
          desc: `${poi.description} - ${poi.type}`,
          sym: mapPoiTypeToGarminSymbol(poi.type), // Símbolo Garmin compatible
          type: poi.type,
        }))
      : undefined;

  // Objeto base GPX
  const gpxObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    gpx: {
      '@_version': '1.1',
      '@_creator': 'RouteCreator App',
      '@_xmlns': 'http://www.topografix.com/GPX/1/1',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xmlns:rc': ROUTE_CREATOR_NS,
      '@_xsi:schemaLocation': 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd',
      metadata: {
        name: name,
        desc: extendedDesc,
        time: new Date().toISOString(),
        keywords: type, // Útil para búsquedas
        // Las extensiones de GPX deben ir en un espacio de nombres propio
        extensions: metadata
          ? {
              'rc:route_metadata': prefixKeys('rc:', {
                type: type,
                ...metadata,
                total_distance_meters: stats?.totalDistance || 0,
                poi_count: stats?.poiCount || 0,
              }),
            }
          : undefined,
      },
      wpt,
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

  // Opciones para la conversión a XML
  const options = {
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
  };

  const builder = new XMLBuilder(options);
  return builder.build(gpxObj);
}

// Añade un prefijo de espacio de nombres a las claves de un objeto
function prefixKeys(prefix, obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [prefix + key, value]));
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
