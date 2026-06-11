# RouteCreator

RouteCreator es una aplicación de escritorio para crear, editar y gestionar rutas para MTB, ciclismo en ruta y autocaravanas. Permite diseñar tus propias rutas, añadir puntos de interés, calcular rutas automáticas y exportarlas en formato GPX compatible con dispositivos Garmin y otras aplicaciones de navegación.

## ✨ Características

- 🗺️ **Diferentes capas de mapas** adaptadas a cada tipo de actividad:
  - Terreno para MTB
  - Carreteras para ciclismo en ruta
  - Carreteras para autocaravanas

- 📍 **Gestión avanzada de rutas**:
  - Añade puntos manualmente haciendo clic en el mapa
  - Arrastra y ajusta puntos de forma interactiva
  - Edita o elimina puntos del track (incluidos los importados de un GPX) directamente desde el mapa: clic en un
    punto para ver sus coordenadas y eliminarlo, o clic derecho para eliminarlo al instante
  - Cálculo automático de distancias

- 🚏 **Puntos de interés (POIs)** especialmente útiles para rutas en autocaravana:
  - Áreas de pernocta
  - Áreas de servicio
  - Puntos de agua
  - Gasolineras
  - Puntos de recarga de GLP
  - Miradores

- 🧭 **Enrutamiento automático** entre puntos:
  - Perfiles específicos para cada actividad
  - Cálculo de la ruta óptima entre puntos seleccionados
  - Basado en OpenRouteService API

- 📱 **Soporte offline**:
  - Descarga mapas para usarlos sin conexión
  - Selecciona el área y nivel de zoom a guardar
  - Ideal para zonas con mala cobertura

- 💾 **Importación/Exportación**:
  - Exporta tus rutas en formato GPX compatible con Garmin
  - Importa rutas GPX existentes para editarlas
  - Metadatos específicos según el tipo de actividad

## 🚀 Instalación

### Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [pnpm](https://pnpm.io/) v9 o superior

```bash
npm install -g pnpm
```

### Pasos de instalación

1. Clona este repositorio:
```bash
git clone https://github.com/cmurestudillos/route-creator.git
cd route-creator
```

2. Instala las dependencias:
```bash
pnpm install
```

3. Inicia la aplicación:
```bash
pnpm start
```

### Generación de ejecutables para distribución

```bash
# Windows
pnpm package:win

# macOS
pnpm package:mac

# Linux
pnpm package:linux
```

Los ejecutables se generarán en la carpeta `release/`.

## 🛠️ Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `pnpm start` | Inicia la aplicación en modo desarrollo |
| `pnpm lint` | Verifica el código con ESLint |
| `pnpm lint:fix` | Corrige automáticamente los errores de ESLint |
| `pnpm format` | Formatea el código con Prettier |
| `pnpm format:check` | Verifica el formato sin modificar archivos |
| `pnpm package:win` | Genera ejecutable para Windows |
| `pnpm package:mac` | Genera ejecutable para macOS |
| `pnpm package:linux` | Genera ejecutable para Linux |

## 🛠️ Uso

### Crear una nueva ruta

1. Selecciona el tipo de ruta (MTB, Ciclismo en Ruta o Autocaravana)
2. Configura las opciones específicas para ese tipo de ruta
3. Haz clic en el mapa para añadir puntos a tu ruta
4. Ajusta los puntos arrastrándolos si es necesario

### Editar o eliminar puntos del track y POIs en el mapa

1. Haz clic sobre el marcador de un punto para abrir un popup con sus coordenadas y un botón "Eliminar punto"
2. Para mover un punto, arrástralo a su nueva posición (el popup se actualiza automáticamente)
3. Para eliminar un punto rápidamente sin abrir el popup, haz clic derecho sobre su marcador

### Añadir puntos de interés (para rutas de autocaravana)

1. Selecciona el modo "Puntos de interés"
2. Elige el tipo de POI que quieres añadir
3. Haz clic en "Añadir POI" y luego en el mapa para colocarlo

### Cálculo automático de rutas

1. Añade al menos un punto de inicio y un punto de destino
2. Selecciona el perfil de ruta adecuado
3. Haz clic en "Calcular ruta automática"
4. La aplicación calculará y mostrará la mejor ruta entre tus puntos

### Guardar mapas para uso offline

1. Navega al área que quieres guardar
2. Ajusta los niveles de zoom a descargar
3. Haz clic en "Guardar área visible para uso offline"
4. Espera a que se complete la descarga
5. Activa el modo offline con el botón correspondiente cuando lo necesites

### Exportar a GPX

1. Una vez completada tu ruta, haz clic en "Exportar como GPX"
2. Selecciona la ubicación donde guardar el archivo
3. El archivo GPX generado incluirá todos los puntos de la ruta y POIs, y será compatible con dispositivos Garmin y otras aplicaciones de navegación

## 🧩 Tecnologías utilizadas

- [Electron](https://www.electronjs.org/) v39 — Framework para crear aplicaciones de escritorio con tecnologías web
- [Leaflet](https://leafletjs.com/) v1.7.1 — Biblioteca JavaScript para mapas interactivos
- [OpenStreetMap](https://www.openstreetmap.org/) — Datos de mapas
- [OpenRouteService](https://openrouteservice.org/) — API para el cálculo automático de rutas
- [localForage](https://localforage.github.io/localForage/) — Biblioteca para almacenamiento offline
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — Generación de archivos GPX (XML)
- [node-fetch](https://github.com/node-fetch/node-fetch) — Peticiones HTTP en el proceso principal

## 🔧 Calidad de código

El proyecto usa **ESLint v9** (flat config) + **Prettier** para garantizar calidad y consistencia:

```bash
# Verificar linting
pnpm lint

# Auto-corregir
pnpm lint:fix

# Verificar formato
pnpm format:check
```

La configuración de ESLint está en `eslint.config.mjs` y aplica reglas diferenciadas para el proceso principal (Node.js) y el renderer (browser).

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT.

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue o envía un pull request para sugerir cambios o mejoras.

1. Haz un fork del proyecto
2. Crea tu rama de características (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'Add some amazing feature'`)
4. Haz push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📊 Roadmap

- [ ] Perfil de elevación para rutas
- [ ] Estimación de tiempo/esfuerzo
- [ ] Sincronización con servicios en la nube
- [ ] Exportación a otros formatos además de GPX
- [ ] Aplicación móvil complementaria
- [ ] Integración con Strava y otras plataformas
- [ ] Mover Leaflet y localforage de CDN a dependencias locales (mejor soporte offline)
