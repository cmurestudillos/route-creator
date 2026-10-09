// Variables globales
let map;
let routePolyline;
let markers = [];
let waypoints = [];

// Variables globales adicionales
let currentMode = 'route'; // 'route' o 'poi'
let poiMarkers = [];
let pois = [];
let pendingPoiReturnMode = null; // Modo al que volver tras colocar un POI con el botón "Añadir POI"

// Variables para el enrutamiento
let routingLayer; // Capa para mostrar la ruta calculada
let routedTrack = null; // Ruta calculada por OpenRouteService: { points: [{ lat, lng, elevation }], distance }
let apiKeySource = null; // Origen de la API key de OpenRouteService: 'settings', 'config' o null (sin clave)

// Variables para el soporte offline
let isOfflineMode = false;
let tileLayerOffline;

// Iconos de los POIs: círculo con el color de cada tipo (el mismo que en la lista lateral) y un emoji,
// para distinguirlos de los puntos de la ruta
const POI_STYLES = {
  parking: { color: '#3f51b5', emoji: '🅿️' },
  service: { color: '#e91e63', emoji: '🚐' },
  water: { color: '#2196f3', emoji: '💧' },
  fuel: { color: '#ff5722', emoji: '⛽' },
  lpg: { color: '#9c27b0', emoji: '🔥' },
  viewpoint: { color: '#4caf50', emoji: '🔭' },
};

const poiIcons = Object.fromEntries(
  Object.entries(POI_STYLES).map(([type, { color, emoji }]) => [
    type,
    L.divIcon({
      className: `poi-icon ${type}-icon`,
      html: `<span class="poi-marker" style="--poi-color: ${color}">${emoji}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    }),
  ])
);

// Inicialización principal de la aplicación
document.addEventListener('DOMContentLoaded', async function () {
  // Cargar configuración desde el proceso principal (la API key no sale de él: solo si hay una)
  try {
    const config = await window.electron.ipcRenderer.invoke('get-config');
    apiKeySource = config.apiKeySource;
    document.getElementById('app-version').textContent = `v${config.version}`;
  } catch (error) {
    console.error('No se pudo cargar la configuración:', error);
  }
  updateApiKeyStatus();

  // Inicializar el mapa
  initMap();

  // Configurar eventos de la interfaz
  setupEventListeners();

  // Inicializar opciones según el tipo de ruta por defecto
  const routeType = document.getElementById('route-type').value;
  updateRouteOptions(routeType);

  // Ocultar el contenedor de modos de edición inicialmente si no es autocaravana
  const editModeContainer = document.getElementById('edit-mode-container');
  if (routeType !== 'Motorhome') {
    editModeContainer.style.display = 'none';
  }

  // Inicializar el modo de edición
  setEditMode('route');

  // Inicializar el enrutamiento
  setupRouting();

  // Inicializar el soporte offline
  setupOfflineSupport();

  // Verificar si hay almacenamiento offline disponible
  checkOfflineStorage();
});

// Variables para las capas del mapa
let baseMaps = {};
let currentBaseLayer;
let _layerControl;

// Función para inicializar el mapa con Leaflet
function initMap() {
  // Centrar el mapa en España (ajustar según preferencias)
  map = L.map('map').setView([40.416775, -3.70379], 6);

  // Definir diferentes capas de mapa para cada tipo de ruta
  baseMaps = {
    OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),

    'Terreno (MTB)': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
      }
    ),

    'Carreteras (Ciclismo)': L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">HOT</a>',
    }),

    'Transporte (Autocaravana)': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
  };

  // Añadir capa por defecto según el tipo de ruta seleccionado
  const routeType = document.getElementById('route-type').value;
  updateMapLayer(routeType);

  // Añadir control de capas
  _layerControl = L.control.layers(baseMaps).addTo(map);

  // Inicializar la línea de la ruta
  routePolyline = L.polyline([], {
    color: 'blue',
    weight: 5,
    opacity: 0.7,
  }).addTo(map);

  // Inicializar la capa de enrutamiento
  routingLayer = L.layerGroup().addTo(map);

  // Evento click para añadir puntos a la ruta
  map.on('click', onMapClick);
}

// Función para actualizar la capa del mapa según el tipo de ruta (versión actualizada)
function updateMapLayer(routeType) {
  // No actualizar si estamos en modo offline
  if (isOfflineMode) {
    return;
  }

  // Eliminar capa actual si existe
  if (currentBaseLayer) {
    map.removeLayer(currentBaseLayer);
  }

  // Seleccionar la capa adecuada según el tipo de ruta
  switch (routeType) {
    case 'MTB':
      currentBaseLayer = baseMaps['Terreno (MTB)'];
      break;
    case 'Road':
      currentBaseLayer = baseMaps['Carreteras (Ciclismo)'];
      break;
    case 'Motorhome':
      currentBaseLayer = baseMaps['Transporte (Autocaravana)'];
      break;
    default:
      currentBaseLayer = baseMaps['OpenStreetMap'];
  }

  // Añadir la capa seleccionada al mapa
  currentBaseLayer.addTo(map);
}

// Función para manejar clicks en el mapa
function onMapClick(e) {
  if (currentMode === 'route') {
    addWaypoint(e.latlng.lat, e.latlng.lng);
  } else if (currentMode === 'poi') {
    // Obtener el tipo de POI seleccionado
    const poiType = document.getElementById('poi-type').value;
    addPOI(e.latlng.lat, e.latlng.lng, poiType);

    // POI colocado con el botón "Añadir POI": volver al modo en el que estaba
    if (pendingPoiReturnMode !== null) {
      const returnMode = pendingPoiReturnMode;
      pendingPoiReturnMode = null;
      setEditMode(returnMode);
    }
  }
}

// Función para añadir un punto a la ruta
// Con deferUpdate no se refrescan la línea ni la lista (importaciones grandes: se refrescan una vez al final)
function addWaypoint(lat, lng, elevation = null, { deferUpdate = false } = {}) {
  // Crear un marcador en el mapa
  const marker = L.marker([lat, lng], {
    draggable: true, // Permite arrastrar el marcador
    icon: routePointIcons.middle, // updateRoutePolyline marca el inicio y el final
  }).addTo(map);

  // Crear un objeto waypoint
  const waypoint = {
    id: Date.now(), // ID único basado en timestamp
    lat: lat,
    lng: lng,
    elevation: elevation,
    time: new Date().toISOString(),
  };

  // Añadir a los arrays
  markers.push(marker);
  waypoints.push(waypoint);

  if (!deferUpdate) {
    // Actualizar la línea de la ruta
    updateRoutePolyline();

    // Actualizar la lista de waypoints en la interfaz
    updateWaypointsList();
  }

  // Popup con información del punto y botón para eliminarlo
  marker.bindPopup(() => createWaypointPopupContent(marker));

  // Evitar que el clic en el marcador se propague al mapa y cree un punto nuevo
  marker.on('click', function (e) {
    L.DomEvent.stopPropagation(e);
  });

  // Clic derecho elimina el punto directamente
  marker.on('contextmenu', function (e) {
    L.DomEvent.preventDefault(e);
    L.DomEvent.stopPropagation(e);
    removeWaypointByMarker(marker);
  });

  // Eventos para el marcador
  marker.on('dragend', function () {
    // Actualizar las coordenadas cuando el marcador se mueve
    const position = marker.getLatLng();
    const index = markers.indexOf(marker);

    if (index !== -1) {
      waypoints[index].lat = position.lat;
      waypoints[index].lng = position.lng;
      updateRoutePolyline();

      // Refrescar el popup si está abierto para mostrar la nueva posición
      if (marker.isPopupOpen()) {
        marker.setPopupContent(createWaypointPopupContent(marker));
      }
    }
  });
}

// Crea el contenido del popup de un punto del track, con botón para eliminarlo
function createWaypointPopupContent(marker) {
  const index = markers.indexOf(marker);
  const wp = waypoints[index];

  const container = document.createElement('div');
  container.innerHTML = `
    <strong>Punto ${index + 1}</strong><br>
    Lat: ${wp.lat.toFixed(5)}, Lng: ${wp.lng.toFixed(5)}<br>
    <button type="button" class="delete-point-btn">Eliminar punto</button>
  `;

  container.querySelector('.delete-point-btn').addEventListener('click', () => {
    marker.closePopup();
    removeWaypointByMarker(marker);
  });

  return container;
}

// Elimina un waypoint a partir de su marcador en el mapa
function removeWaypointByMarker(marker) {
  const index = markers.indexOf(marker);
  if (index !== -1) {
    removeWaypoint(index);
  }
}

// Función para añadir un punto de interés (POI)
function addPOI(lat, lng, type, description) {
  // Verificar si el tipo es válido
  if (!poiIcons[type]) {
    type = 'parking'; // Tipo por defecto
  }

  // Crear un marcador en el mapa con el icono correspondiente
  const marker = L.marker([lat, lng], {
    draggable: true,
    icon: poiIcons[type],
  }).addTo(map);

  // Crear un objeto POI
  const poi = {
    id: Date.now(), // ID único basado en timestamp
    lat: lat,
    lng: lng,
    type: type,
    description: description || getPoiDescription(type),
    time: new Date().toISOString(),
  };

  // Añadir a los arrays
  poiMarkers.push(marker);
  pois.push(poi);

  // Actualizar la lista de POIs en la interfaz
  updatePOIsList();

  // Popup con información del POI y botón para eliminarlo
  marker.bindPopup(() => createPOIPopupContent(marker));

  // Evitar que el clic en el marcador se propague al mapa y cree un punto nuevo
  marker.on('click', function (e) {
    L.DomEvent.stopPropagation(e);
  });

  // Clic derecho elimina el POI directamente
  marker.on('contextmenu', function (e) {
    L.DomEvent.preventDefault(e);
    L.DomEvent.stopPropagation(e);
    removePOIByMarker(marker);
  });

  // Eventos para el marcador
  marker.on('dragend', function () {
    // Actualizar las coordenadas cuando el marcador se mueve
    const position = marker.getLatLng();
    const index = poiMarkers.indexOf(marker);

    if (index !== -1) {
      pois[index].lat = position.lat;
      pois[index].lng = position.lng;
      updatePOIsList();

      // Refrescar el popup si está abierto para mostrar la nueva posición
      if (marker.isPopupOpen()) {
        marker.setPopupContent(createPOIPopupContent(marker));
      }
    }
  });
}

// Crea el contenido del popup de un POI, con botón para eliminarlo
function createPOIPopupContent(marker) {
  const index = poiMarkers.indexOf(marker);
  const poi = pois[index];

  const container = document.createElement('div');
  container.innerHTML = `
    <strong>${escapeHtml(poi.description)}</strong><br>
    Lat: ${poi.lat.toFixed(5)}, Lng: ${poi.lng.toFixed(5)}<br>
    <button type="button" class="delete-point-btn">Eliminar punto</button>
  `;

  container.querySelector('.delete-point-btn').addEventListener('click', () => {
    marker.closePopup();
    removePOIByMarker(marker);
  });

  return container;
}

// Elimina un POI a partir de su marcador en el mapa
function removePOIByMarker(marker) {
  const index = poiMarkers.indexOf(marker);
  if (index !== -1) {
    removePOI(index);
  }
}

// Escapar texto que viene de archivos importados antes de insertarlo como HTML
function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

// Obtener descripción para un tipo de POI
function getPoiDescription(type) {
  const descriptions = {
    parking: 'Área de pernocta',
    service: 'Área de servicio',
    water: 'Punto de agua',
    fuel: 'Gasolinera',
    lpg: 'Punto de recarga de GLP',
    viewpoint: 'Mirador',
  };

  return descriptions[type] || 'Punto de interés';
}

// Función para actualizar la línea de la ruta y el resumen
function updateRoutePolyline() {
  const points = waypoints.map(wp => [wp.lat, wp.lng]);
  routePolyline.setLatLngs(points);
  updateRoutePointIcons();

  // Los puntos han cambiado: la ruta calculada ya no corresponde a ellos
  discardRoutedTrack();

  // Actualizar estadísticas de la ruta
  updateRouteStats();
}

// Iconos de los puntos de la ruta: puntos pequeños (un track importado puede tener miles) y el inicio y el
// final destacados en verde y rojo
const routePointIcons = Object.fromEntries(
  ['start', 'middle', 'end'].map(role => [
    role,
    L.divIcon({
      className: `route-point route-point-${role}`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -7],
    }),
  ])
);

// Asignar a cada marcador el icono de su posición (solo cambia los que lo necesitan)
function updateRoutePointIcons() {
  markers.forEach((marker, index) => {
    const role = index === 0 ? 'start' : index === markers.length - 1 ? 'end' : 'middle';
    if (marker.options.icon !== routePointIcons[role]) {
      marker.setIcon(routePointIcons[role]);
      // Inicio y final por encima del resto de puntos
      marker.setZIndexOffset(role === 'middle' ? 0 : 1000);
    }
  });
}

// Función para actualizar las estadísticas de la ruta
function updateRouteStats() {
  const pointCount = waypoints.length;
  const totalDistance = getRouteDistance();
  const totalDistanceKm = (totalDistance / 1000).toFixed(2);

  // Actualizar elementos en la interfaz
  document.getElementById('point-count').textContent = pointCount;
  document.getElementById('total-distance').textContent = totalDistanceKm;
}

// Función para actualizar la lista de waypoints en la interfaz
function updateWaypointsList() {
  const container = document.getElementById('waypoints-container');
  container.innerHTML = '';

  waypoints.forEach((wp, index) => {
    const waypointItem = document.createElement('div');
    waypointItem.className = 'waypoint-item';
    waypointItem.innerHTML = `
      <span>Punto ${index + 1}: ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</span>
      <button data-index="${index}" class="remove-waypoint">X</button>
    `;
    container.appendChild(waypointItem);

    // Añadir evento para eliminar el waypoint
    waypointItem.querySelector('.remove-waypoint').addEventListener('click', function () {
      removeWaypoint(parseInt(this.getAttribute('data-index')));
    });
  });
}

// Función para actualizar la lista de POIs en la interfaz
function updatePOIsList() {
  const container = document.getElementById('pois-container');

  if (!container) return;

  container.innerHTML = '';

  pois.forEach((poi, index) => {
    const poiItem = document.createElement('div');
    poiItem.className = 'poi-item';
    poiItem.setAttribute('data-type', poi.type); // Añadir el atributo data-type para estilos CSS
    poiItem.innerHTML = `
      <span>${escapeHtml(poi.description)}: ${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}</span>
      <button data-index="${index}" class="remove-poi">X</button>
    `;
    container.appendChild(poiItem);

    // Añadir evento para eliminar el POI
    poiItem.querySelector('.remove-poi').addEventListener('click', function () {
      removePOI(parseInt(this.getAttribute('data-index')));
    });
  });

  // Actualizar contador de POIs
  document.getElementById('poi-count').textContent = pois.length;
}

// Función para eliminar un waypoint
function removeWaypoint(index) {
  if (index >= 0 && index < waypoints.length) {
    // Eliminar el marcador del mapa
    map.removeLayer(markers[index]);

    // Eliminar el waypoint y marcador de los arrays
    waypoints.splice(index, 1);
    markers.splice(index, 1);

    // Actualizar la línea y la lista
    updateRoutePolyline();
    updateWaypointsList();
  }
}

// Función para eliminar un POI
function removePOI(index) {
  if (index >= 0 && index < pois.length) {
    // Eliminar el marcador del mapa
    map.removeLayer(poiMarkers[index]);

    // Eliminar el POI y marcador de los arrays
    pois.splice(index, 1);
    poiMarkers.splice(index, 1);

    // Actualizar la lista
    updatePOIsList();
  }
}

// Función para mostrar/ocultar opciones específicas según tipo de ruta
function updateRouteOptions(routeType) {
  // Ocultar todas las opciones
  document.querySelectorAll('.route-options').forEach(element => {
    element.style.display = 'none';
  });

  // Mostrar opciones específicas según el tipo de ruta
  switch (routeType) {
    case 'MTB':
      document.getElementById('mtb-options').style.display = 'block';
      break;
    case 'Road':
      document.getElementById('road-options').style.display = 'block';
      break;
    case 'Motorhome':
      document.getElementById('motorhome-options').style.display = 'block';
      break;
  }
}

// Función para configurar eventos para los botones
function setupEventListeners() {
  // Botón para limpiar la ruta
  document.getElementById('clear-route').addEventListener('click', function () {
    clearRoute();
  });

  // Botón para exportar como GPX
  document.getElementById('save-gpx').addEventListener('click', function () {
    exportGPX();
  });

  // Botón para importar GPX
  document.getElementById('import-gpx').addEventListener('click', function () {
    importGPX();
  });

  // Selector de tipo de ruta - cambiar capa del mapa y opciones al cambiar
  document.getElementById('route-type').addEventListener('change', function () {
    applyRouteType(this.value);
  });

  // Botones de modo de edición
  const routeModeBtn = document.getElementById('route-mode');
  const poiModeBtn = document.getElementById('poi-mode');

  if (routeModeBtn) {
    routeModeBtn.addEventListener('click', function () {
      setEditMode('route');
    });
  }

  if (poiModeBtn) {
    poiModeBtn.addEventListener('click', function () {
      setEditMode('poi');
    });
  }

  // Botón para añadir POI
  const addPoiButton = document.getElementById('add-poi');
  if (addPoiButton) {
    addPoiButton.addEventListener('click', function () {
      // Cambiar temporalmente al modo POI: el siguiente clic en el mapa (onMapClick) coloca el POI
      // y vuelve al modo anterior. Pulsar el botón varias veces no acumula clics pendientes.
      const returnMode = pendingPoiReturnMode ?? currentMode;
      setEditMode('poi');
      pendingPoiReturnMode = returnMode;

      // Solicitar al usuario que haga clic en el mapa
      alert('Ahora haz clic en el mapa para colocar el punto de interés');
    });
  }

  // Botón para calcular ruta
  document.getElementById('calculate-route').addEventListener('click', function () {
    calculateRoute();
  });

  // Guardar la API key de OpenRouteService
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  document.getElementById('ors-api-key').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveApiKey();
  });

  // Botones para soporte offline
  document.getElementById('save-offline').addEventListener('click', function () {
    saveOfflineMap();
  });

  document.getElementById('toggle-offline-mode').addEventListener('click', function () {
    toggleOfflineMode();
  });

  // Controles de zoom offline
  document.getElementById('offline-zoom-min').addEventListener('change', updateZoomLevels);
  document.getElementById('offline-zoom-max').addEventListener('change', updateZoomLevels);
}

// Aplicar un tipo de ruta a toda la interfaz: capa del mapa, opciones, modos de edición y perfil
function applyRouteType(routeType) {
  updateMapLayer(routeType);
  updateRouteOptions(routeType);

  // Mostrar u ocultar el contenedor de modos de edición según el tipo de ruta
  const editModeContainer = document.getElementById('edit-mode-container');
  if (routeType === 'Motorhome') {
    editModeContainer.style.display = 'block';
  } else {
    editModeContainer.style.display = 'none';
    // Si cambiamos a otro tipo de ruta, volver al modo de ruta
    setEditMode('route');
  }

  // Actualizar el perfil de enrutamiento
  updateRoutingProfile(routeType);
}

// Función para cambiar el modo de edición
function setEditMode(mode) {
  currentMode = mode;
  pendingPoiReturnMode = null; // Un cambio de modo cancela el POI pendiente del botón "Añadir POI"

  // Actualizar clases de los botones
  const routeModeBtn = document.getElementById('route-mode');
  const poiModeBtn = document.getElementById('poi-mode');

  if (routeModeBtn && poiModeBtn) {
    routeModeBtn.classList.toggle('active', mode === 'route');
    poiModeBtn.classList.toggle('active', mode === 'poi');

    // Mostrar u ocultar listas según el modo
    const waypointList = document.getElementById('waypoints-container');
    const poiList = document.getElementById('poi-list');

    if (waypointList && waypointList.parentElement) {
      waypointList.parentElement.style.display = mode === 'route' ? 'block' : 'none';
    }

    if (poiList) {
      poiList.style.display = mode === 'poi' ? 'block' : 'none';
    }
  }
}

// Función para limpiar la ruta
function clearRoute() {
  // Eliminar todos los marcadores de ruta
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  waypoints = [];

  // Limpiar la línea de la ruta
  routePolyline.setLatLngs([]);

  // Eliminar todos los POIs si hay alguno
  poiMarkers.forEach(marker => map.removeLayer(marker));
  poiMarkers = [];
  pois = [];

  // Descartar la ruta calculada
  discardRoutedTrack();

  // Actualizar las listas
  updateWaypointsList();
  updatePOIsList();

  // Restablecer las estadísticas
  document.getElementById('point-count').textContent = '0';
  document.getElementById('total-distance').textContent = '0.00';
  document.getElementById('poi-count').textContent = '0';
}

// Distancia de la ruta: la de la ruta calculada si la hay, si no la de los tramos rectos entre puntos
function getRouteDistance() {
  return routedTrack ? routedTrack.distance : calculateTotalDistance();
}

// Función para calcular la distancia total de la ruta
function calculateTotalDistance() {
  let totalDistance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const point1 = L.latLng(waypoints[i].lat, waypoints[i].lng);
    const point2 = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lng);
    totalDistance += point1.distanceTo(point2); // distancia en metros
  }

  return totalDistance;
}

// Mostrar cuántas teselas hay guardadas para uso offline (se llama al arrancar y tras cada descarga)
async function checkOfflineStorage() {
  try {
    const storageStat = await showOfflineStorageStatus();
    let offlineInfo = document.getElementById('offline-storage-info');

    if (!storageStat) {
      if (offlineInfo) offlineInfo.remove();
      return;
    }

    if (!offlineInfo) {
      offlineInfo = document.createElement('p');
      offlineInfo.id = 'offline-storage-info';
      offlineInfo.className = 'info-text';

      // Insertarlo antes del botón de guardar offline
      const offlineActions = document.querySelector('.offline-actions');
      offlineActions.insertBefore(offlineInfo, document.getElementById('save-offline').parentNode);
    }

    offlineInfo.textContent = `Tienes ${storageStat.tileCount} teselas guardadas para uso offline (${storageStat.size} MB).`;
  } catch (error) {
    console.error('Error verificando almacenamiento offline:', error);
  }
}

// Contar las teselas guardadas y su tamaño (en el almacén de teselas, no en el de localForage por defecto)
async function showOfflineStorageStatus() {
  try {
    let tileCount = 0;
    let bytes = 0;

    await tileLayerOffline._storage.iterate(value => {
      tileCount++;
      // Las teselas se guardan en base64: 4 caracteres por cada 3 bytes
      bytes += typeof value === 'string' ? (value.length * 3) / 4 : 0;
    });

    if (tileCount === 0) {
      console.log('No hay teselas guardadas');
      return null;
    }

    return {
      tileCount: tileCount,
      size: (bytes / 1024 / 1024).toFixed(2),
    };
  } catch (error) {
    console.error('Error al verificar el almacenamiento:', error);
    return null;
  }
}

// Función para exportar como GPX
async function exportGPX() {
  if (waypoints.length === 0 && pois.length === 0) {
    alert('No hay puntos en la ruta ni puntos de interés. Añade algunos puntos antes de exportar.');
    return;
  }

  const routeName = document.getElementById('route-name').value || 'Mi Ruta';
  const routeType = document.getElementById('route-type').value;

  // Recopilar metadatos específicos según el tipo de ruta
  let routeMetadata = {};

  switch (routeType) {
    case 'MTB':
      routeMetadata = {
        difficulty: document.getElementById('mtb-difficulty').value,
        surface: document.getElementById('mtb-surface').value,
      };
      break;
    case 'Road':
      routeMetadata = {
        traffic: document.getElementById('road-traffic').value,
        surface: document.getElementById('road-surface').value,
      };
      break;
    case 'Motorhome':
      routeMetadata = {
        maxHeight: document.getElementById('motorhome-height').value,
        includeParking: document.getElementById('motorhome-parking').checked,
        roadTypes: document.getElementById('motorhome-roads').value,
      };
      break;
  }

  // Calcular estadísticas básicas de la ruta
  const totalDistance = getRouteDistance();

  // Crear objeto de datos de la ruta. Si se ha calculado la ruta, el track es su geometría completa
  // (sigue las carreteras y caminos); si no, los puntos marcados en el mapa
  const routeData = {
    name: routeName,
    type: routeType,
    waypoints: routedTrack ? routedTrack.points : waypoints,
    pois: pois, // Añadir los POIs
    metadata: routeMetadata,
    stats: {
      totalDistance: totalDistance, // en metros
      poiCount: pois.length,
    },
  };

  // Enviar al proceso principal para guardar
  try {
    const result = await window.electron.ipcRenderer.invoke('save-gpx', routeData);

    if (result.success) {
      alert(`Ruta guardada correctamente en: ${result.filePath}`);
    } else {
      alert(`Error al guardar: ${result.message}`);
    }
  } catch (error) {
    alert(`Error al exportar: ${error.message}`);
  }
}

// Función para importar un archivo GPX
async function importGPX() {
  try {
    // Llamar al proceso principal para abrir el diálogo de selección de archivo
    const result = await window.electron.ipcRenderer.invoke('import-gpx');

    if (!result.success) {
      if (result.message !== 'Operación cancelada') {
        alert(`Error al importar: ${result.message}`);
      }
      return;
    }

    // Analizar el contenido GPX antes de tocar la ruta actual
    const gpxData = parseGPXContent(result.content);

    if (!gpxData) {
      alert('El archivo no es un GPX válido o está corrupto.');
      return;
    }

    if (gpxData.waypoints.length === 0 && gpxData.pois.length === 0) {
      alert('El archivo GPX no contiene puntos de track, de ruta ni de interés.');
      return;
    }

    // Limpiar la ruta actual antes de cargar la nueva
    clearRoute();

    // Actualizar el nombre y tipo de ruta
    if (gpxData.name) {
      document.getElementById('route-name').value = gpxData.name;
    }

    if (gpxData.type) {
      const routeTypeSelect = document.getElementById('route-type');
      const option = [...routeTypeSelect.options].find(o => o.value.toLowerCase() === gpxData.type.toLowerCase());

      // Aplicar el tipo a toda la interfaz (capa, opciones, modos de edición y perfil de enrutamiento)
      if (option) {
        routeTypeSelect.value = option.value;
        applyRouteType(option.value);
      }
    }

    // Cargar los waypoints de la ruta
    if (gpxData.waypoints && gpxData.waypoints.length > 0) {
      gpxData.waypoints.forEach(wp => {
        addWaypoint(wp.lat, wp.lng, wp.elevation, { deferUpdate: true });
      });
      updateRoutePolyline();
      updateWaypointsList();
    }

    // Cargar los puntos de interés
    if (gpxData.pois && gpxData.pois.length > 0) {
      gpxData.pois.forEach(poi => {
        addPOI(poi.lat, poi.lng, poi.type || 'parking', poi.name);
      });
    }

    // Centrar el mapa en los puntos importados (track y POIs)
    const importedPoints = [...waypoints, ...pois].map(p => [p.lat, p.lng]);
    if (importedPoints.length > 0) {
      map.fitBounds(L.latLngBounds(importedPoints), { padding: [50, 50], maxZoom: 16 });
    }

    alert(`Archivo GPX importado correctamente: ${result.filePath}`);
  } catch (error) {
    console.error('Error al importar el archivo GPX:', error);
    alert(`Error al importar el archivo GPX: ${error.message}`);
  }
}

// Función para analizar el contenido de un archivo GPX
function parseGPXContent(gpxContent) {
  try {
    // Crear un parser XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');

    // DOMParser no lanza excepciones: indica los errores con un elemento <parsererror>
    if (xmlDoc.querySelector('parsererror') || xmlDoc.documentElement.localName !== 'gpx') {
      return null;
    }

    // Objeto para almacenar los datos extraídos
    const gpxData = {
      name: '',
      type: '',
      waypoints: [],
      pois: [],
    };

    // Extraer nombre y tipo de la ruta
    const metadataName = xmlDoc.querySelector('metadata > name');
    if (metadataName) {
      gpxData.name = metadataName.textContent;
    }

    const trkName = xmlDoc.querySelector('trk > name, rte > name');
    if (trkName && !gpxData.name) {
      gpxData.name = trkName.textContent;
    }

    const trkType = xmlDoc.querySelector('trk > type, rte > type');
    if (trkType) {
      gpxData.type = trkType.textContent;
    }

    // Extraer waypoints de la ruta: puntos de track (<trkpt>) o, si no hay, puntos de ruta (<rtept>)
    let trkpts = xmlDoc.querySelectorAll('trkpt');
    if (trkpts.length === 0) {
      trkpts = xmlDoc.querySelectorAll('rtept');
    }
    trkpts.forEach(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat'));
      const lng = parseFloat(trkpt.getAttribute('lon'));

      if (!isNaN(lat) && !isNaN(lng)) {
        // Altitud solo si el archivo la trae (no se inventa 0)
        let elevation = null;
        const eleElement = trkpt.querySelector('ele');
        if (eleElement && eleElement.textContent.trim() !== '') {
          const value = parseFloat(eleElement.textContent);
          elevation = Number.isFinite(value) ? value : null;
        }

        gpxData.waypoints.push({
          lat,
          lng,
          elevation,
        });
      }
    });

    // Extraer puntos de interés (wpt)
    const wpts = xmlDoc.querySelectorAll('wpt');
    wpts.forEach(wpt => {
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lng = parseFloat(wpt.getAttribute('lon'));

      if (!isNaN(lat) && !isNaN(lng)) {
        // Determinar el tipo de POI
        let poiType = 'parking'; // por defecto

        const symElement = wpt.querySelector('sym');
        if (symElement) {
          const symbol = symElement.textContent;

          // Mapear símbolos Garmin a tipos de POI
          if (symbol.includes('Parking')) poiType = 'parking';
          else if (symbol.includes('Gas') || symbol.includes('Fuel')) poiType = 'fuel';
          else if (symbol.includes('Water')) poiType = 'water';
          else if (symbol.includes('Service')) poiType = 'service';
          else if (symbol.includes('Scenic')) poiType = 'viewpoint';
        }

        // También comprobar el elemento <type>
        const typeElement = wpt.querySelector('type');
        if (typeElement) {
          const typeText = typeElement.textContent.toLowerCase();
          if (['parking', 'service', 'water', 'fuel', 'lpg', 'viewpoint'].includes(typeText)) {
            poiType = typeText;
          }
        }

        // Conservar el nombre del punto si lo tiene
        const nameElement = wpt.querySelector('name');

        gpxData.pois.push({
          lat,
          lng,
          type: poiType,
          name: nameElement ? nameElement.textContent.trim() : '',
        });
      }
    });

    return gpxData;
  } catch (error) {
    console.error('Error al analizar el archivo GPX:', error);
    return null;
  }
}

// Función para configurar el enrutamiento
function setupRouting() {
  // Inicializar la capa de enrutamiento (si no se ha hecho ya)
  if (!routingLayer) {
    routingLayer = L.layerGroup().addTo(map);
  }

  // Añadir controlador para el botón de calcular ruta (ya configurado en setupEventListeners)

  // Inicializar el perfil basado en el tipo inicial
  updateRoutingProfile(document.getElementById('route-type').value);
}

// Función para actualizar el perfil de enrutamiento basado en el tipo de ruta
function updateRoutingProfile(routeType) {
  const profileSelect = document.getElementById('routing-profile');

  switch (routeType) {
    case 'MTB':
      profileSelect.value = 'cycling-mountain';
      break;
    case 'Road':
      profileSelect.value = 'cycling-regular';
      break;
    case 'Motorhome':
      profileSelect.value = 'driving-hgv';
      break;
    default:
      profileSelect.value = 'driving-car';
  }
}

// Función para calcular la ruta automática entre los puntos
async function calculateRoute() {
  const statusElement = document.getElementById('routing-status');

  // Sin API key no se puede calcular
  if (!apiKeySource) {
    statusElement.textContent = 'Falta la API key de OpenRouteService: pégala arriba y pulsa "Guardar API key".';
    document.getElementById('ors-api-key').focus();
    return;
  }

  // Verificar que hay al menos 2 puntos
  if (waypoints.length < 2) {
    statusElement.textContent = 'Necesitas al menos 2 puntos para calcular una ruta.';
    return;
  }

  // Límite de la API de OpenRouteService
  if (waypoints.length > MAX_ROUTING_POINTS) {
    statusElement.textContent = `OpenRouteService admite como máximo ${MAX_ROUTING_POINTS} puntos y la ruta tiene ${waypoints.length}.`;
    return;
  }

  // Limpiar ruta anterior
  discardRoutedTrack();

  // Mostrar estado
  statusElement.textContent = 'Calculando ruta...';

  try {
    // Obtener el perfil de ruta seleccionado
    const profile = document.getElementById('routing-profile').value;

    // Preparar los puntos para la API (en formato [lng, lat])
    const coordinates = waypoints.map(wp => [wp.lng, wp.lat]);

    // Llamar al proceso principal para realizar la solicitud (añade la API key guardada)
    const result = await window.electron.ipcRenderer.invoke('fetch-route', {
      profile: profile,
      coordinates: coordinates,
    });

    if (!result.success) {
      throw new Error(result.error || 'Error desconocido al calcular la ruta');
    }

    // Procesar la ruta recibida
    processRoutingResponse(result.data);

    // Actualizar estado
    statusElement.textContent = `Ruta calculada: ${(routedTrack.distance / 1000).toFixed(2)} km, ${routedTrack.points.length} puntos. Se exportará al GPX.`;
  } catch (error) {
    console.error('Error al calcular la ruta:', error);
    statusElement.textContent = `Error: ${error.message}`;
  }
}

// Mostrar si hay API key de OpenRouteService y de dónde sale
function updateApiKeyStatus() {
  const status = document.getElementById('api-key-status');
  const input = document.getElementById('ors-api-key');

  if (apiKeySource === 'settings') {
    status.textContent =
      'API key guardada. Para cambiarla, pega otra y guárdala; para borrarla, guarda el campo vacío.';
    input.placeholder = '•••••••• (guardada)';
  } else if (apiKeySource === 'config') {
    status.textContent = 'Usando la API key de config.json (desarrollo).';
    input.placeholder = 'Pega aquí tu API key';
  } else {
    status.textContent = 'Necesitas una API key gratuita de OpenRouteService para calcular rutas.';
    input.placeholder = 'Pega aquí tu API key';
  }
}

// Guardar (o borrar si el campo está vacío) la API key en la configuración de la app
async function saveApiKey() {
  const input = document.getElementById('ors-api-key');
  const status = document.getElementById('api-key-status');

  try {
    const result = await window.electron.ipcRenderer.invoke('set-api-key', input.value);
    if (!result.success) {
      status.textContent = `No se pudo guardar: ${result.error}`;
      return;
    }

    apiKeySource = result.apiKeySource;
    input.value = '';
    updateApiKeyStatus();

    // Quitar el aviso de "falta la API key" del enrutamiento si lo había
    const routingStatus = document.getElementById('routing-status');
    if (apiKeySource && routingStatus.textContent.startsWith('Falta la API key')) {
      routingStatus.textContent = 'API key guardada: ya puedes calcular la ruta.';
    }
  } catch (error) {
    status.textContent = `No se pudo guardar: ${error.message}`;
  }
}

// Número máximo de puntos que acepta la API de directions de OpenRouteService
const MAX_ROUTING_POINTS = 50;

// Función para procesar la respuesta de enrutamiento
function processRoutingResponse(data) {
  // Verificar que tenemos una respuesta válida
  const route = data && data.features && data.features[0];
  if (!route || !route.geometry || route.geometry.type !== 'LineString') {
    throw new Error('La respuesta de la API no contiene datos de ruta válidos');
  }

  // Añadir la ruta al mapa. Los puntos marcados se mantienen como puntos de paso
  L.geoJSON(route, {
    style: {
      color: '#3388ff',
      weight: 6,
      opacity: 0.8,
    },
  }).addTo(routingLayer);

  // Guardar la geometría completa ([lng, lat, elevación]) para exportarla como track
  routedTrack = {
    points: route.geometry.coordinates.map(([lng, lat, elevation]) => ({
      lat,
      lng,
      elevation: Number.isFinite(elevation) ? elevation : null,
    })),
    distance: route.properties?.summary?.distance ?? calculateTotalDistance(),
  };
  fillElevationGaps(routedTrack.points);

  // La línea recta entre puntos pasa a ser una guía discontinua
  routePolyline.setStyle({ dashArray: '6 8', opacity: 0.5 });
  updateRouteStats();
}

// OpenRouteService devuelve altitud 0 donde no tiene datos: los tramos a 0 entre dos puntos claramente
// por encima del nivel del mar (> 20 m) se rellenan interpolando para no crear caídas falsas en el perfil
function fillElevationGaps(points) {
  let i = 0;
  while (i < points.length) {
    if (points[i].elevation !== 0) {
      i++;
      continue;
    }

    let end = i;
    while (end < points.length && points[end].elevation === 0) end++;

    const before = points[i - 1];
    const after = points[end];
    if (before && after && before.elevation > 20 && after.elevation > 20) {
      const steps = end - i + 1;
      for (let k = i; k < end; k++) {
        const t = (k - i + 1) / steps;
        points[k].elevation = Math.round((before.elevation + (after.elevation - before.elevation) * t) * 10) / 10;
      }
    }
    i = end;
  }
}

// Descartar la ruta calculada (al cambiar los puntos o limpiar la ruta)
function discardRoutedTrack() {
  const hadRoute = routedTrack !== null;

  routedTrack = null;
  routingLayer.clearLayers();
  routePolyline.setStyle({ dashArray: null, opacity: 0.7 });

  if (hadRoute) {
    document.getElementById('routing-status').textContent =
      'Los puntos han cambiado: vuelve a calcular la ruta para exportarla siguiendo las carreteras.';
    updateRouteStats();
  }
}

// Clase personalizada para manejo offline con Electron
class ElectronOfflineTileLayer extends L.TileLayer {
  constructor(url, options) {
    super(url, options);
    this._storage = localforage.createInstance({
      name: 'electron-offline-tiles',
      storeName: 'tiles',
    });
    this._downloading = false;
    this._pendingTiles = [];
    this._downloadedTiles = 0;
    this._totalTiles = 0;
  }

  // Sobreescribir el método de carga de teselas
  createTile(coords, done) {
    const tile = document.createElement('img');

    if (isOfflineMode) {
      // En modo offline, cargar directamente desde el almacenamiento local
      this._checkStoredTile(tile, coords, done);
    } else {
      // En modo online, cargar normalmente y caer en caché si falla
      const url = this.getTileUrl(coords);
      tile.src = url;

      L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
      L.DomEvent.on(tile, 'error', () => {
        this._checkStoredTile(tile, coords, done);
      });
    }

    return tile;
  }

  // Método para verificar si la tesela existe en el almacenamiento
  async _checkStoredTile(tile, coords, done) {
    try {
      const key = this._getTileKey(coords);
      const data = await this._storage.getItem(key);

      if (data) {
        // Crear un blob y establecer la URL
        const blob = this._base64ToBlob(data);
        const url = URL.createObjectURL(blob);
        tile.src = url;

        L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
      } else if (isOfflineMode) {
        // En modo offline, mostrar tesela de "no disponible"
        tile.src =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAsTAAALEwEAmpwYAAABFUlEQVR4nO3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4MGkBAAFG4cY7AAAAAElFTkSuQmCC';
        done(null, tile);
      } else {
        // Online pero no en caché: la tesela no está disponible, marcar como error
        done(new Error('Tesela no disponible en caché'), tile);
      }
    } catch (error) {
      console.error('Error accediendo al almacenamiento:', error);
      done(error, tile);
    }
  }

  // Método para guardar teselas para uso offline
  async saveTiles(minZoom, maxZoom, bounds, callback) {
    if (this._downloading) {
      callback(new Error('Ya hay una descarga en progreso'), null);
      return;
    }

    try {
      // Calcular todas las teselas necesarias
      const tilesToFetch = this._calculateTilesToFetch(minZoom, maxZoom, bounds);

      this._totalTiles = tilesToFetch.length;
      this._downloadedTiles = 0;
      this._pendingTiles = [...tilesToFetch];
      this._downloading = true;

      // Disparar evento de inicio
      this.fire('offline:save-start', {
        total: this._totalTiles,
      });

      // Iniciar la descarga de teselas
      await this._startTileDownload(callback);
    } catch (error) {
      this._downloading = false;
      callback(error, null);

      // Disparar evento de error
      this.fire('offline:save-error', {
        error: error.message,
      });
    }
  }

  // Método para iniciar la descarga de teselas
  async _startTileDownload(callback) {
    const maxConcurrent = 5; // Número máximo de descargas concurrentes
    const promises = [];

    // Mientras haya teselas pendientes, descargar
    while (this._pendingTiles.length > 0 && promises.length < maxConcurrent) {
      const tileCoords = this._pendingTiles.shift();
      promises.push(this._downloadTile(tileCoords));
    }

    if (promises.length > 0) {
      try {
        await Promise.all(promises);

        // Si quedan más teselas por descargar, continuar
        if (this._pendingTiles.length > 0) {
          await this._startTileDownload(callback);
        } else {
          // Descarga completa
          this._downloading = false;
          callback(null, this._totalTiles);

          // Disparar evento de finalización
          this.fire('offline:save-end', {
            total: this._totalTiles,
          });
        }
      } catch (error) {
        this._downloading = false;
        callback(error, null);

        // Disparar evento de error
        this.fire('offline:save-error', {
          error: error.message,
        });
      }
    }
  }

  // Método para descargar una tesela individual
  async _downloadTile(coords) {
    try {
      const url = this._getDownloadUrl(coords);
      const key = this._getTileKey(coords);

      // Usar IPC para descargar la tesela
      const result = await window.electron.ipcRenderer.invoke('download-tile', url);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Convertir a base64 y guardar
      const base64 = this._arrayBufferToBase64(result.data);
      await this._storage.setItem(key, base64);

      // Incrementar contador y disparar evento de progreso
      this._downloadedTiles++;
      this.fire('offline:save-progress', {
        total: this._totalTiles,
        downloaded: this._downloadedTiles,
      });
    } catch (error) {
      console.error('Error descargando tesela:', error);
      // Continuar con las demás teselas
    }
  }

  // Método para calcular las teselas a descargar
  _calculateTilesToFetch(minZoom, maxZoom, bounds) {
    const tiles = [];

    // La capa offline solo está en el mapa en modo offline: se proyecta con el CRS del mapa
    // (this._map no existe mientras la capa no se ha añadido)
    const crs = map.options.crs;
    const tileSize = this.getTileSize();

    // Para cada nivel de zoom
    for (let z = minZoom; z <= maxZoom; z++) {
      const northEast = crs.latLngToPoint(bounds.getNorthEast(), z);
      const southWest = crs.latLngToPoint(bounds.getSouthWest(), z);
      const lastIndex = Math.pow(2, z) - 1;

      // Calcular los índices de las teselas (sin salirse del mundo)
      const minX = Math.max(0, Math.floor(southWest.x / tileSize.x));
      const maxX = Math.min(lastIndex, Math.floor(northEast.x / tileSize.x));
      const minY = Math.max(0, Math.floor(northEast.y / tileSize.y));
      const maxY = Math.min(lastIndex, Math.floor(southWest.y / tileSize.y));

      // Añadir todas las teselas en el área
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ z: z, x: x, y: y });
        }
      }
    }

    return tiles;
  }

  // URL de una tesela concreta. getTileUrl() de Leaflet usa el zoom actual del mapa en lugar de coords.z,
  // así que para descargar varios niveles de zoom se construye a partir de la plantilla
  _getDownloadUrl(coords) {
    const subdomains = this.options.subdomains;
    return L.Util.template(this._url, {
      ...this.options,
      s: subdomains[Math.abs(coords.x + coords.y) % subdomains.length],
      x: coords.x,
      y: coords.y,
      z: coords.z,
    });
  }

  // Número de teselas que ocupa un área entre dos niveles de zoom
  countTiles(minZoom, maxZoom, bounds) {
    return this._calculateTilesToFetch(minZoom, maxZoom, bounds).length;
  }

  // Método para generar una clave única para cada tesela
  _getTileKey(coords) {
    return `${this._url}_${coords.z}_${coords.x}_${coords.y}`;
  }

  // Método para convertir ArrayBuffer a Base64
  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
  }

  // Método para convertir Base64 a Blob
  _base64ToBlob(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'image/png' });
  }
}

// Función para configurar el soporte offline
function setupOfflineSupport() {
  // Inicializar el tile layer personalizado
  tileLayerOffline = new ElectronOfflineTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    minZoom: 1,
    maxZoom: 18,
  });

  // Eventos para la descarga de teselas
  tileLayerOffline.on('offline:save-start', function () {
    document.querySelector('.progress-container').style.display = 'block';
    document.getElementById('offline-progress').value = 0;
    document.getElementById('offline-status').textContent = 'Iniciando descarga...';
  });

  tileLayerOffline.on('offline:save-progress', function (e) {
    const progress = Math.round((e.downloaded / e.total) * 100);
    document.getElementById('offline-progress').value = progress;
    document.getElementById('offline-status').textContent = `${e.downloaded} de ${e.total} teselas (${progress}%)`;
  });

  tileLayerOffline.on('offline:save-end', function () {
    document.getElementById('offline-status').textContent = '¡Guardado completo!';
    checkOfflineStorage();
    setTimeout(function () {
      document.querySelector('.progress-container').style.display = 'none';
    }, 2000);
  });

  tileLayerOffline.on('offline:save-error', function (e) {
    document.getElementById('offline-status').textContent = 'Error: ' + e.error;
  });
}

// Función para guardar el mapa actual para uso offline
function saveOfflineMap() {
  // Obtener los niveles de zoom
  const minZoom = parseInt(document.getElementById('offline-zoom-min').value);
  const maxZoom = parseInt(document.getElementById('offline-zoom-max').value);

  // Validar los valores
  if (minZoom > maxZoom) {
    alert('El zoom mínimo debe ser menor o igual al zoom máximo');
    return;
  }

  // Obtener los límites actuales del mapa
  const bounds = map.getBounds();

  // Avisar antes de descargas grandes (servidores de teselas comunitarios: descargar solo lo necesario)
  const tileCount = tileLayerOffline.countTiles(minZoom, maxZoom, bounds);
  if (tileCount > 500) {
    const confirmMessage = `Vas a descargar ${tileCount} teselas (unos ${Math.ceil((tileCount * 20) / 1024)} MB). Acerca el mapa o baja el zoom máximo para descargar menos. ¿Quieres continuar?`;
    if (!confirm(confirmMessage)) {
      return;
    }
  }

  // Iniciar la descarga
  tileLayerOffline.saveTiles(minZoom, maxZoom, bounds, function (error, tilesForSave) {
    if (error) {
      console.error('Error guardando teselas:', error);
      document.getElementById('offline-status').textContent = 'Error: ' + error.message;
      return;
    }

    console.log('Teselas guardadas:', tilesForSave);
  });
}

// Función para alternar el modo offline
function toggleOfflineMode() {
  const button = document.getElementById('toggle-offline-mode');

  if (isOfflineMode) {
    // Cambiar a modo online
    button.textContent = 'Activar modo offline';
    isOfflineMode = false;

    // Volver a la capa online del tipo de ruta (updateMapLayer quita la capa offline)
    updateMapLayer(document.getElementById('route-type').value);
  } else {
    // Cambiar a modo offline
    button.textContent = 'Desactivar modo offline';

    // Remover la capa actual
    if (currentBaseLayer) {
      map.removeLayer(currentBaseLayer);
    }

    // Activar el modo antes de añadir la capa: createTile lo consulta al crear las primeras teselas
    isOfflineMode = true;

    // Añadir la capa offline
    tileLayerOffline.addTo(map);
    currentBaseLayer = tileLayerOffline;
  }
}

// Función para actualizar los niveles de zoom
function updateZoomLevels() {
  const minZoom = parseInt(document.getElementById('offline-zoom-min').value);
  const maxZoom = parseInt(document.getElementById('offline-zoom-max').value);

  // Validar los valores
  if (minZoom > maxZoom) {
    alert('El zoom mínimo debe ser menor o igual al zoom máximo');
    document.getElementById('offline-zoom-min').value = maxZoom;
    return;
  }
}
