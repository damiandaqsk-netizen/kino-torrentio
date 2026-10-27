# Torrentio para Kino

Plugin de Kino que trae **Torrentio** (el addon de Stremio) a la app, usando los
enlaces directos de tu debrid (**TorBox**).

Explorar y buscar salen de TMDB; al reproducir, el plugin le pide los streams a
Torrentio por el ID de IMDb del título y le entrega a Kino solo los enlaces
http(s) de debrid en caché. Sin debrid, Torrentio contesta con torrents
(magnet/infoHash) y Kino no tiene motor torrent para reproducirlos: el
torrenting lo hace el debrid, no la app.

## Antes de instalar: genera tu configuración de Torrentio

1. Entra a https://torrentio.strem.fun
2. En la sección de **Debrid**, elige **TorBox** y pega tu clave API
   (torbox.app ▸ Settings ▸ API).
3. Ajusta a tu gusto proveedores, orden (calidad/tamaño) y filtros
   (recomendado: excluir calidades CAM/bajas).
4. La página genera tu enlace de instalación de Torrentio. **Cópialo entero**:
   ese enlace ES tu configuración (lleva tu clave dentro, trátalo como una
   contraseña).

## Instalación en Kino

1. Kino ▸ Ajustes ▸ Plugins ▸ escribe: `damiandaqsk-netizen/kino-torrentio`
2. Abre el plugin ▸ **Configurar** ▸ en **Configuración de Torrentio** pega el
   enlace completo del paso anterior (también acepta solo el segmento de
   configuración).
3. Listo: en Inicio aparece la sección Torrentio con películas y series
   populares; el buscador de Kino también consulta este plugin.

Al dar play, si hay varias copias, el reproductor las muestra en su menú
**Servidor** con calidad, tamaño y fuente (ej. "1080p · 4 GB · RARBG").

## Notas

- Si un título muestra "solo torrents sin enlace de debrid en caché": ese
  torrent aún no está en la caché de TorBox. TorBox puede descargarlo —
  prueba de nuevo en unos minutos.
- El ajuste opcional "Servidor Torrentio" permite usar un espejo propio de
  Torrentio en vez de torrentio.strem.fun.
