/// <reference path="./kino.d.ts" />

// Torrentio para Kino — puente al addon Torrentio (el de Stremio) con debrid.
//
// Torrentio vive en un servidor y responde streams por ID de IMDb; este
// plugin le hace de cliente dentro de Kino:
//   · Explorar y buscar salen de TMDB (servicio kino.tmdb de la propia app),
//     quedándonos solo con títulos que tienen ID de IMDb.
//   · Los capítulos de una serie salen de kino.meta, que ya entrega los IDs
//     estilo Stremio ("tt0944947:1:1") que Torrentio espera.
//   · Al reproducir (resolve) se le pregunta a Torrentio por ese IMDb y se
//     devuelven SOLO los enlaces http(s) directos, que son los que crea tu
//     debrid (TorBox): sin debrid, Torrentio contesta con datos de torrent
//     (magnet/infoHash) que ningún reproductor de Kino puede tocar, porque
//     Kino no tiene motor torrent — el torrenting lo hace el debrid.
//
// Tu configuración de Torrentio (la que generas en torrentio.strem.fun con
// tu debrid y tu clave API) se pega en Ajustes ▸ Plugins ▸ Torrentio ▸
// Configurar. Queda solo en tu aparato.

const HOME_ITEMS = 10;   // títulos por fila en Inicio/sección
const SEARCH_ITEMS = 14; // resultados máximos de búsqueda
const MAX_COPIES = 9;    // 1 principal + hasta 8 alternativas que admite Kino

/* ================= configuración ================= */

function conf() {
  const baseRaw = (kino.config.get("base") || "").trim().replace(/\/+$/, "");
  const base = baseRaw || "https://torrentio.strem.fun";
  let seg = (kino.config.get("config") || "").trim();
  // Se acepta pegar: la URL completa del manifiesto, el enlace de
  // instalación (stremio://…) o solo el segmento de configuración.
  // Si el pegado trae la dirección dos veces o texto extra alrededor,
  // manda la ÚLTIMA URL que aparezca: es el enlace completo.
  const urls = seg.match(/https?:\/\/[^\s"']+/gi);
  if (urls && urls.length) seg = urls[urls.length - 1];
  seg = seg.replace(/^stremio:\/\//i, "");
  seg = seg.replace(/^https?:\/\/[^/]+\//i, "");
  seg = seg.replace(/\/manifest\.json$/i, "").replace(/\/+$/, "");
  if (seg === "manifest.json") seg = "";
  return { base, seg };
}

function needSeg() {
  const { base, seg } = conf();
  if (!seg) {
    throw kino.error("auth_required", "Pega tu configuración de Torrentio en Ajustes ▸ Plugins ▸ Torrentio ▸ Configurar (la generas en torrentio.strem.fun eligiendo tu debrid y tu clave API).");
  }
  return { base, seg };
}

/* ================= utilidades ================= */

function img(url) {
  if (!url) return undefined;
  try { return encodeURI(String(url).trim()); } catch (e) { return undefined; }
}

function ratingOf(v) {
  const n = parseFloat(v);
  return isNaN(n) || n <= 0 ? undefined : Math.round(n * 10) / 10;
}

function poster(path) {
  return path ? "https://image.tmdb.org/t/p/w500" + path : undefined;
}

function fmtSize(bytes) {
  const b = Number(bytes);
  if (!isFinite(b) || b <= 0) return undefined;
  if (b >= 1073741824) return (Math.round(b / 107374182.4) / 10) + " GB";
  if (b >= 1048576) return Math.round(b / 1048576) + " MB";
  return Math.round(b / 1024) + " KB";
}

/* ================= TMDB (metadatos) ================= */

async function tmdb(path, params) {
  if (typeof kino.tmdb !== "function") {
    throw kino.error("unavailable", "Esta versión de Kino no trae el servicio de metadatos (kino.tmdb); actualiza la app.");
  }
  try {
    return await kino.tmdb(path, params);
  } catch (e) {
    if (e && e.code === "no_tmdb_key") {
      throw kino.error("unavailable", "Kino no tiene clave de TMDB en esta instalación, así que el plugin no puede explorar ni buscar.");
    }
    throw e;
  }
}

async function imdbOf(kind, tmdbId) {
  try {
    const d = await tmdb(kind === "series" ? `/tv/${tmdbId}/external_ids` : `/movie/${tmdbId}/external_ids`);
    return d && d.imdb_id ? String(d.imdb_id) : null;
  } catch (e) { return null; }
}

// Ítem de Kino desde un resultado de TMDB. Sin IMDb no hay Torrentio:
// el título se omite antes que ofrecer algo que no va a reproducir.
async function tmdbItem(x, kind) {
  if (!x || !x.id) return null;
  const imdb = await imdbOf(kind, x.id);
  if (!imdb) return null;
  return {
    id: (kind === "series" ? "s" : "m") + imdb,
    ref: (kind === "series" ? "s:" : "m:") + imdb,
    title: x.title || x.name || imdb,
    kind,
    poster: img(poster(x.poster_path)),
    overview: x.overview ? String(x.overview) : undefined,
    year: String(x.release_date || x.first_air_date || "").slice(0, 4) || undefined,
    rating: ratingOf(x.vote_average),
    ids: { imdb, tmdb: Number(x.id) },
  };
}

async function tmdbItems(list, kind, limit) {
  const slice = (Array.isArray(list) ? list : []).slice(0, limit);
  const built = await Promise.all(slice.map((x) => tmdbItem(x, kind)));
  return built.filter(Boolean);
}

/* ================= Inicio y sección propia ================= */

async function trendingRows() {
  const [mv, tv] = await Promise.all([
    tmdb("/trending/movie/week", { page: 1 }),
    tmdb("/trending/tv/week", { page: 1 }),
  ]);
  const rows = [];
  const mItems = await tmdbItems(mv && mv.results, "movie", HOME_ITEMS);
  if (mItems.length) rows.push({ id: "pop-movies", title: "Películas populares", ref: "pop:movie", genre: "peliculas", items: mItems });
  const sItems = await tmdbItems(tv && tv.results, "series", HOME_ITEMS);
  if (sItems.length) rows.push({ id: "pop-series", title: "Series populares", ref: "pop:tv", genre: "series", items: sItems });
  return rows;
}

export async function home() {
  return trendingRows();
}

export async function section(arg) {
  const tabs = [
    { id: "todo", label: "Torrentio" },
  ];
  return {
    tabs,
    tab: "todo",
    hero: { title: "Torrentio", text: "Películas y series por Torrentio, con los enlaces directos de tu debrid (TorBox)." },
    rows: await trendingRows(),
  };
}

/* ================= Explorar ("Ver más") ================= */

export async function browse(ref, cursor) {
  const kind = String(ref) === "pop:tv" ? "series" : "movie";
  const page = cursor ? (parseInt(cursor, 10) || 1) : 1;
  const data = await tmdb(kind === "series" ? "/trending/tv/week" : "/trending/movie/week", { page });
  const items = await tmdbItems(data && data.results, kind, 20);
  const totalPages = (data && data.total_pages) || page;
  return { items, next: page < totalPages ? String(page + 1) : undefined };
}

/* ================= Búsqueda ================= */

export async function search(query) {
  const q = ((query && query.q) || "").trim();
  if (!q) return [];
  const data = await tmdb("/search/multi", { query: q, page: 1 });
  const results = (Array.isArray(data && data.results) ? data.results : [])
    .filter((x) => x && (x.media_type === "movie" || x.media_type === "tv"));
  const built = await Promise.all(
    results.slice(0, SEARCH_ITEMS).map((x) => tmdbItem(x, x.media_type === "tv" ? "series" : "movie"))
  );
  return built.filter(Boolean);
}

/* ================= Capítulos de una serie ================= */

export async function episodes(ref) {
  const imdb = String(ref).replace(/^s:/, "");
  if (!/^tt\d+$/.test(imdb)) throw kino.error("not_found", "Referencia de serie no válida.");
  if (typeof kino.meta !== "function") {
    throw kino.error("unavailable", "Esta versión de Kino no trae el servicio de metadatos (kino.meta); actualiza la app.");
  }
  const ans = await kino.meta({ type: "series", ids: { imdb }, lang: "es" });
  if (!ans || !Array.isArray(ans.episodes) || !ans.episodes.length) {
    throw kino.error("not_found", "No se encontraron capítulos para esta serie.");
  }
  const eps = ans.episodes.map((e) => ({
    season: e.season,
    number: e.number,
    ref: "e:" + (e.id || `${imdb}:${e.season}:${e.number}`),
    title: e.title || ("Episodio " + e.number),
    still: img(e.still),
    overview: e.overview ? String(e.overview) : undefined,
    airDate: e.airDate || undefined,
  }));
  eps.sort((a, b) => a.season - b.season || a.number - b.number);
  const tmdbRating = (ans.ratings || []).find((r) => r.source === "tmdb");
  return {
    series: {
      title: ans.title || undefined,
      poster: img(ans.poster),
      overview: ans.overview || undefined,
      year: ans.year || undefined,
      rating: tmdbRating ? ratingOf(tmdbRating.value) : undefined,
      genres: Array.isArray(ans.genres) ? ans.genres : undefined,
    },
    episodes: eps,
  };
}

/* ================= Reproducción (Torrentio) ================= */

// De un stream de Torrentio: etiqueta corta para el menú "Servidor" de
// Kino y los datos del archivo para KinoStream.media (solo informativos).
function streamInfo(s) {
  const title = String(s.title || "");
  const firstLine = title.split("\n")[0] || "";
  const nameSecond = String(s.name || "").split("\n")[1] || "";
  let quality = nameSecond.trim();
  if (!quality) {
    const m = /(2160p|1440p|1080p|720p|480p|360p|4K|UHD|HD|CAM)/i.exec(firstLine + " " + title);
    if (m) quality = m[1].toUpperCase() === "4K" ? "2160p" : m[1];
  }
  const hints = s.behaviorHints || {};
  let size = fmtSize(hints.videoSize);
  if (!size) {
    const m = /💾\s*([0-9.]+\s*(?:GB|MB|KB))/i.exec(title);
    if (m) size = m[1].replace(/\s+/g, " ");
  }
  let source = "";
  const sm = /⚙️\s*([^\n]+)/.exec(title);
  if (sm) source = sm[1].trim();
  const parts = [];
  if (quality) parts.push(quality);
  if (size) parts.push(size);
  if (source) parts.push(source);
  const label = (parts.join(" · ") || "Torrentio").slice(0, 48);
  const media = {};
  const fname = hints.filename || firstLine;
  if (fname) media.title = String(fname).slice(0, 120);
  if (hints.videoSize) media.sizeBytes = Number(hints.videoSize) || undefined;
  return { label, media: Object.keys(media).length ? media : undefined };
}

export async function resolve(ref) {
  const { base, seg } = needSeg();
  const r = String(ref);
  let type, videoId;
  if (r.startsWith("m:")) { type = "movie"; videoId = r.slice(2); }
  else if (r.startsWith("e:")) { type = "series"; videoId = r.slice(2); }
  else throw kino.error("not_found", "Referencia no válida para Torrentio.");
  if (!/^tt\d+(:\d+:\d+)?$/.test(videoId)) throw kino.error("not_found", "Este título no tiene ID de IMDb válido.");

  const url = `${base}/${seg}/stream/${type}/${encodeURIComponent(videoId)}.json`;
  let res;
  try {
    res = await kino.fetch(url);
  } catch (e) {
    throw kino.error("unavailable", "No se pudo contactar Torrentio.");
  }
  if (!res.ok) {
    throw kino.error("unavailable", "Torrentio respondió " + res.status + ". Revisa tu configuración en el plugin (que incluya tu debrid).");
  }
  let data;
  try {
    data = JSON.parse(res.text());
  } catch (e) {
    throw kino.error("unavailable", "Torrentio devolvió una respuesta no válida.");
  }
  const all = Array.isArray(data && data.streams) ? data.streams : [];
  // Solo sirven los enlaces directos del debrid; infoHash/magnet no se
  // pueden reproducir en Kino (no hay motor torrent).
  const playable = all.filter((s) => s && typeof s.url === "string" && /^https?:\/\//i.test(s.url));
  if (!playable.length) {
    if (all.length) {
      throw kino.error("not_found", "Torrentio solo encontró torrents sin enlace de debrid en caché para este título. Si tu TorBox ya lo está descargando, prueba de nuevo en unos minutos.");
    }
    throw kino.error("not_found", "Torrentio no encontró fuentes para este título.");
  }
  const copies = playable.slice(0, MAX_COPIES).map((s) => {
    const info = streamInfo(s);
    return { url: s.url, label: info.label, media: info.media };
  });
  const first = copies[0];
  const out = { url: first.url };
  if (first.label) out.label = first.label;
  if (first.media) out.media = first.media;
  if (copies.length > 1) {
    out.alternatives = copies.slice(1).map((c) => ({ url: c.url, label: c.label }));
  }
  return out;
}
