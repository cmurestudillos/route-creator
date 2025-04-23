// Variables globales
let map;
let routePolyline;
let markers = [];
let waypoints = [];

// Variables globales adicionales
let currentMode = 'route'; // 'route' o 'poi'
let poiMarkers = [];
let pois = [];

// Variables para el enrutamiento
let routingLayer; // Capa para mostrar la ruta calculada
const OPENROUTE_API_KEY = '5b3ce3597851110001cf6248625e8f0414d94952b2d5162d79b2ed44'; // Clave de API gratuita

// Variables para el soporte offline
let isOfflineMode = false;
let tileLayerOffline;

// Iconos personalizados para POIs
const poiIcons = {
  parking: L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'poi-icon parking-icon',
  }),
  service: L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'poi-icon service-icon',
  }),
  water: L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'poi-icon water-icon',
  }),
  fuel: L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'poi-icon fuel-icon',
  }),
  lpg: L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'poi-icon lpg-icon',
  }),
  viewpoint: L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'poi-icon viewpoint-icon',
  }),
};

// Inicialización principal de la aplicación
document.addEventListener('DOMContentLoaded', function () {
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
let layerControl;

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
  layerControl = L.control.layers(baseMaps).addTo(map);

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
  }
}

// Función para añadir un punto a la ruta
function addWaypoint(lat, lng, elevation = 0) {
  // Crear un marcador en el mapa
  const marker = L.marker([lat, lng], {
    draggable: true, // Permite arrastrar el marcador
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

  // Actualizar la línea de la ruta
  updateRoutePolyline();

  // Actualizar la lista de waypoints en la interfaz
  updateWaypointsList();

  // Eventos para el marcador
  marker.on('dragend', function (e) {
    // Actualizar las coordenadas cuando el marcador se mueve
    const position = marker.getLatLng();
    const index = markers.indexOf(marker);

    if (index !== -1) {
      waypoints[index].lat = position.lat;
      waypoints[index].lng = position.lng;
      updateRoutePolyline();
    }
  });
}

// Función para añadir un punto de interés (POI)
function addPOI(lat, lng, type) {
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
    description: getPoiDescription(type),
    time: new Date().toISOString(),
  };

  // Añadir a los arrays
  poiMarkers.push(marker);
  pois.push(poi);

  // Actualizar la lista de POIs en la interfaz
  updatePOIsList();

  // Eventos para el marcador
  marker.on('dragend', function (e) {
    // Actualizar las coordenadas cuando el marcador se mueve
    const position = marker.getLatLng();
    const index = poiMarkers.indexOf(marker);

    if (index !== -1) {
      pois[index].lat = position.lat;
      pois[index].lng = position.lng;
      updatePOIsList();
    }
  });

  // Mostrar popup con información del POI
  marker.bindPopup(`<strong>${getPoiDescription(type)}</strong><br>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
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

  // Actualizar estadísticas de la ruta
  updateRouteStats();
}

// Función para actualizar las estadísticas de la ruta
function updateRouteStats() {
  const pointCount = waypoints.length;
  const totalDistance = calculateTotalDistance();
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
      <span>${poi.description}: ${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}</span>
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
    const routeType = this.value;
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
      // Cambiar temporalmente al modo POI
      const prevMode = currentMode;
      setEditMode('poi');

      // Solicitar al usuario que haga clic en el mapa
      alert('Ahora haz clic en el mapa para colocar el punto de interés');

      // Configurar un listener único para este evento
      const clickHandler = function (e) {
        const poiType = document.getElementById('poi-type').value;
        addPOI(e.latlng.lat, e.latlng.lng, poiType);

        // Eliminar este listener después de usarlo una vez
        map.off('click', clickHandler);

        // Volver al modo anterior
        setEditMode(prevMode);
      };

      // Añadir el listener
      map.once('click', clickHandler);
    });
  }

  // Botón para calcular ruta
  document.getElementById('calculate-route').addEventListener('click', function () {
    calculateRoute();
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

// Función para cambiar el modo de edición
function setEditMode(mode) {
  currentMode = mode;

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

  // Limpiar la capa de enrutamiento
  routingLayer.clearLayers();

  // Actualizar las listas
  updateWaypointsList();
  updatePOIsList();

  // Restablecer las estadísticas
  document.getElementById('point-count').textContent = '0';
  document.getElementById('total-distance').textContent = '0.00';
  document.getElementById('poi-count').textContent = '0';
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

// Verificar el almacenamiento offline
async function checkOfflineStorage() {
  try {
    const storageStat = await showOfflineStorageStatus();
    if (storageStat && storageStat.tileCount > 0) {
      // Hay mapas disponibles offline
      const offlineInfo = document.createElement('div');
      offlineInfo.className = 'info-text';
      offlineInfo.innerHTML = `
        <p>Tienes ${storageStat.tileCount} teselas guardadas para uso offline 
        (aproximadamente ${storageStat.size} MB).</p>
      `;

      // Insertarlo antes del botón de guardar offline
      const offlineActions = document.querySelector('.offline-actions');
      offlineActions.insertBefore(offlineInfo, document.getElementById('save-offline').parentNode);
    }
  } catch (error) {
    console.error('Error verificando almacenamiento offline:', error);
  }
}

// Actualizar la versión de showOfflineStorageStatus para retornar datos útiles
async function showOfflineStorageStatus() {
  try {
    // Intentar acceder al almacenamiento offline
    const allKeys = await localforage.keys();

    if (!allKeys || allKeys.length === 0) {
      console.log('No hay teselas guardadas');
      return null;
    }

    // Filtrar solo las claves de teselas
    const tileKeys = allKeys.filter(key => key.startsWith('https://'));
    const tileCount = tileKeys.length;

    if (tileCount === 0) {
      console.log('No hay teselas guardadas');
      return null;
    }

    console.log('Teselas guardadas:', tileCount);

    // Calcular el espacio aproximado (cada tesela ~20KB en promedio)
    const approxSize = (tileCount * 20) / 1024; // En MB
    console.log('Espacio aproximado:', approxSize.toFixed(2), 'MB');

    return {
      tileCount: tileCount,
      size: approxSize.toFixed(2),
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
  const totalDistance = calculateTotalDistance();

  // Crear objeto de datos de la ruta
  const routeData = {
    name: routeName,
    type: routeType,
    waypoints: waypoints,
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

    // Limpiar la ruta actual antes de importar una nueva
    clearRoute();

    // Analizar el contenido GPX
    const gpxData = parseGPXContent(result.content);

    if (!gpxData) {
      alert('El archivo GPX no es válido o está corrupto.');
      return;
    }

    // Actualizar el nombre y tipo de ruta
    if (gpxData.name) {
      document.getElementById('route-name').value = gpxData.name;
    }

    if (gpxData.type) {
      const routeTypeSelect = document.getElementById('route-type');
      // Verificar si el tipo existe en el select
      for (let i = 0; i < routeTypeSelect.options.length; i++) {
        if (routeTypeSelect.options[i].value.toLowerCase() === gpxData.type.toLowerCase()) {
          routeTypeSelect.selectedIndex = i;
          break;
        }
      }

      // Actualizar capa del mapa y opciones
      updateMapLayer(routeTypeSelect.value);
      updateRouteOptions(routeTypeSelect.value);
    }

    // Cargar los waypoints de la ruta
    if (gpxData.waypoints && gpxData.waypoints.length > 0) {
      gpxData.waypoints.forEach(wp => {
        addWaypoint(wp.lat, wp.lng, wp.elevation);
      });
    }

    // Cargar los puntos de interés
    if (gpxData.pois && gpxData.pois.length > 0) {
      gpxData.pois.forEach(poi => {
        addPOI(poi.lat, poi.lng, poi.type || 'parking');
      });
    }

    // Centrar el mapa si hay puntos
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map(wp => [wp.lat, wp.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
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

    const trkName = xmlDoc.querySelector('trk > name');
    if (trkName && !gpxData.name) {
      gpxData.name = trkName.textContent;
    }

    const trkType = xmlDoc.querySelector('trk > type');
    if (trkType) {
      gpxData.type = trkType.textContent;
    }

    // Extraer waypoints de la ruta (puntos de track)
    const trkpts = xmlDoc.querySelectorAll('trkpt');
    trkpts.forEach(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat'));
      const lng = parseFloat(trkpt.getAttribute('lon'));

      if (!isNaN(lat) && !isNaN(lng)) {
        let elevation = 0;
        const eleElement = trkpt.querySelector('ele');
        if (eleElement) {
          elevation = parseFloat(eleElement.textContent) || 0;
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

        gpxData.pois.push({
          lat,
          lng,
          type: poiType,
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

  // Verificar que hay al menos 2 puntos
  if (waypoints.length < 2) {
    statusElement.textContent = 'Necesitas al menos 2 puntos para calcular una ruta.';
    return;
  }

  // Limpiar ruta anterior
  routingLayer.clearLayers();

  // Mostrar estado
  statusElement.textContent = 'Calculando ruta...';

  try {
    // Obtener el perfil de ruta seleccionado
    const profile = document.getElementById('routing-profile').value;

    // Preparar los puntos para la API (en formato [lng, lat])
    const coordinates = waypoints.map(wp => [wp.lng, wp.lat]);

    // Llamar al proceso principal para realizar la solicitud
    const result = await window.electron.ipcRenderer.invoke('fetch-route', {
      profile: profile,
      coordinates: coordinates,
      apiKey: OPENROUTE_API_KEY,
    });

    if (!result.success) {
      throw new Error(result.error || 'Error desconocido al calcular la ruta');
    }

    // Procesar la ruta recibida
    processRoutingResponse(result.data);

    // Actualizar estado
    statusElement.textContent = 'Ruta calculada con éxito!';
  } catch (error) {
    console.error('Error al calcular la ruta:', error);
    statusElement.textContent = `Error: ${error.message}`;
  }
}

// Función para procesar la respuesta de enrutamiento
function processRoutingResponse(data) {
  // Verificar que tenemos una respuesta válida
  if (!data || !data.features || data.features.length === 0) {
    throw new Error('La respuesta de la API no contiene datos de ruta válidos');
  }

  // Limpiar waypoints existentes (excepto el primero y el último)
  clearIntermediateWaypoints();

  // Obtener la geometría de la ruta
  const route = data.features[0];

  // Añadir la ruta al mapa
  const routeLayer = L.geoJSON(route, {
    style: {
      color: '#3388ff',
      weight: 6,
      opacity: 0.7,
    },
  }).addTo(routingLayer);

  // Extraer las coordenadas de la ruta
  let routeCoordinates = [];

  if (route.geometry.type === 'LineString') {
    routeCoordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
  }

  // Crear nuevos waypoints a lo largo de la ruta
  const numWaypoints = Math.min(20, routeCoordinates.length); // Limitar el número de waypoints
  const step = Math.floor(routeCoordinates.length / numWaypoints);

  // Guardar los puntos originales (inicio y fin)
  const startPoint = waypoints[0];
  const endPoint = waypoints[waypoints.length - 1];

  // Limpiar los marcadores y waypoints actuales
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  waypoints = [];

  // Añadir el punto de inicio
  addWaypoint(startPoint.lat, startPoint.lng, startPoint.elevation);

  // Añadir puntos intermedios
  for (let i = step; i < routeCoordinates.length - step; i += step) {
    const [lat, lng] = routeCoordinates[i];
    addWaypoint(lat, lng, 0); // Elevación se puede obtener de un servicio de elevación
  }

  // Añadir el punto final
  addWaypoint(endPoint.lat, endPoint.lng, endPoint.elevation);

  // Actualizar la línea de la ruta y las estadísticas
  updateRoutePolyline();
}

// Función para limpiar los waypoints intermedios
function clearIntermediateWaypoints() {
  if (waypoints.length <= 2) return; // No hay intermedios que limpiar

  // Conservar solo el primero y el último
  const startPoint = waypoints[0];
  const endPoint = waypoints[waypoints.length - 1];

  // Eliminar marcadores intermedios
  for (let i = 1; i < markers.length - 1; i++) {
    map.removeLayer(markers[i]);
  }

  // Reiniciar arrays conservando inicio y fin
  markers = [markers[0], markers[markers.length - 1]];
  waypoints = [startPoint, endPoint];

  // Actualizar la línea y la lista
  updateRoutePolyline();
  updateWaypointsList();
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

    // Evento para cuando la carga falla
    L.DomEvent.on(tile, 'error', () => {
      this._checkStoredTile(tile, coords, done);
    });

    if (isOfflineMode) {
      // En modo offline, intentar primero desde el almacenamiento
      this._checkStoredTile(tile, coords, done);
    } else {
      // En modo online, cargar normalmente
      const url = this.getTileUrl(coords);
      tile.src = url;

      L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
      L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));
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
        // En modo online, intentar cargarlo normalmente
        const url = this.getTileUrl(coords);
        tile.src = url;
      }
    } catch (error) {
      console.error('Error accediendo al almacenamiento:', error);
      // Intentar cargar normalmente
      const url = this.getTileUrl(coords);
      tile.src = url;
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
      const url = this.getTileUrl(coords);
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

    // Para cada nivel de zoom
    for (let z = minZoom; z <= maxZoom; z++) {
      const northEast = this._map.project(bounds.getNorthEast(), z);
      const southWest = this._map.project(bounds.getSouthWest(), z);

      // Calcular los índices de las teselas
      const minX = Math.floor(southWest.x / this.getTileSize().x);
      const maxX = Math.floor(northEast.x / this.getTileSize().x);
      const minY = Math.floor(northEast.y / this.getTileSize().y);
      const maxY = Math.floor(southWest.y / this.getTileSize().y);

      // Añadir todas las teselas en el área
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const tilePoint = new L.Point(x, y);
          tiles.push({
            z: z,
            x: x,
            y: y,
          });
        }
      }
    }

    return tiles;
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
  tileLayerOffline.on('offline:save-start', function (e) {
    document.querySelector('.progress-container').style.display = 'block';
    document.getElementById('offline-progress').value = 0;
    document.getElementById('offline-status').textContent = 'Iniciando descarga...';
  });

  tileLayerOffline.on('offline:save-progress', function (e) {
    const progress = Math.round((e.downloaded / e.total) * 100);
    document.getElementById('offline-progress').value = progress;
    document.getElementById('offline-status').textContent = `${e.downloaded} de ${e.total} teselas (${progress}%)`;
  });

  tileLayerOffline.on('offline:save-end', function (e) {
    document.getElementById('offline-status').textContent = '¡Guardado completo!';
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

  if (maxZoom - minZoom > 5) {
    const confirmMessage = `Estás a punto de descargar ${maxZoom - minZoom + 1} niveles de zoom, lo que puede requerir mucho espacio. ¿Quieres continuar?`;
    if (!confirm(confirmMessage)) {
      return;
    }
  }

  // Obtener los límites actuales del mapa
  const bounds = map.getBounds();

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

    // Restaurar la capa original
    if (currentBaseLayer) {
      map.removeLayer(currentBaseLayer);
    }

    // Volver a añadir la capa online
    updateMapLayer(document.getElementById('route-type').value);

    isOfflineMode = false;
  } else {
    // Cambiar a modo offline
    button.textContent = 'Desactivar modo offline';

    // Remover la capa actual
    if (currentBaseLayer) {
      map.removeLayer(currentBaseLayer);
    }

    // Añadir la capa offline
    tileLayerOffline.addTo(map);
    currentBaseLayer = tileLayerOffline;

    isOfflineMode = true;
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
