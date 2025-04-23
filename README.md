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

- [Node.js](https://nodejs.org/)
- npm (incluido con Node.js)

### Pasos de instalación

1. Clona este repositorio:
```bash
git clone https://github.com/tu-usuario/route-creator.git
cd route-creator
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia la aplicación:
```bash
npm start
```

### Generación de ejecutables para distribución

Para crear ejecutables para tu sistema operativo:
```bash
npm run build
```

Esto generará archivos ejecutables en la carpeta `dist`.

## 🛠️ Uso

### Crear una nueva ruta

1. Selecciona el tipo de ruta (MTB, Ciclismo en Ruta o Autocaravana)
2. Configura las opciones específicas para ese tipo de ruta
3. Haz clic en el mapa para añadir puntos a tu ruta
4. Ajusta los puntos arrastrándolos si es necesario

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

- [Electron](https://www.electronjs.org/) - Framework para crear aplicaciones de escritorio con tecnologías web
- [Leaflet](https://leafletjs.com/) - Biblioteca JavaScript para mapas interactivos
- [OpenStreetMap](https://www.openstreetmap.org/) - Datos de mapas
- [OpenRouteService](https://openrouteservice.org/) - API para el cálculo automático de rutas
- [localForage](https://localforage.github.io/localForage/) - Biblioteca para almacenamiento offline

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue o envía un pull request para sugerir cambios o mejoras.

1. Haz un fork del proyecto
2. Crea tu rama de características (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'Add some amazing feature'`)
4. Haz push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📊 Roadmap

Características planeadas para futuras versiones:

- [ ] Perfil de elevación para rutas
- [ ] Estimación de tiempo/esfuerzo
- [ ] Sincronización con servicios en la nube
- [ ] Exportación a otros formatos además de GPX
- [ ] Aplicación móvil complementaria
- [ ] Integración con Strava y otras plataformas

## 📞 Contacto

Tu Nombre - [@tu_twitter](https://twitter.com/tu_twitter) - email@ejemplo.com

Link del proyecto: [https://github.com/tu-usuario/route-creator](https://github.com/tu-usuario/route-creator)