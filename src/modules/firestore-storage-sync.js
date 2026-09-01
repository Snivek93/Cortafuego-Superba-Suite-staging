// ============================================================================
// firestore-storage-sync.js — Fase 3: fotos y planos de proyectos
// compartidos, vía Firebase Storage como transporte.
// ============================================================================
// Decisión de arquitectura (confirmada con Kevin): las fotos SIEMPRE quedan
// guardadas localmente como base64, igual que hoy — Storage es solo el
// medio para que viajen entre dispositivos, nunca la fuente de verdad ni
// un link permanente que el resto de la app tenga que aprender a resolver.
// Esto significa CERO cambios en PDF, Informes, Planos: para esos módulos,
// una foto que llegó de un proyecto compartido es indistinguible de una
// que se tomó en este mismo dispositivo.
//
// Flujo:
//   SUBIR  (dueño/editor con candado): extraerImagenesGrandes() ya separa
//     las fotos del JSON en un mapa {key: dataUrl}. Este módulo sube cada
//     una a Storage (si cambió — se compara contra un hash guardado
//     localmente para no resubir fotos que no cambiaron) y arma un mapa
//     liviano {key: url} que SÍ cabe cómodo en el documento de Firestore
//     (a diferencia del base64 completo, que reventaría el límite de 1MB
//     de un documento con más de unas pocas fotos).
//   BAJAR (quien recibe): se descarga cada foto desde su url, se convierte
//     a base64, y se reinserta en el JSON con reinsertarImagenesGrandes()
//     — la misma función que ya usa "Abrir…" con un archivo .fss.
// ============================================================================
(function () {

function storage() {
  return firebase.storage();
}

// Hash liviano (NO criptográfico — no hace falta, es solo para detectar si
// una foto cambió y evitar resubirla) a partir de un data URL base64.
// Combina el largo total con una muestra de caracteres a lo largo de la
// cadena — suficiente para que dos fotos distintas casi nunca choquen, sin
// tener que procesar megabytes carácter por carácter en cada autoguardado.
function hashLiviano(str) {
  if (!str) return "0";
  let h = str.length;
  const paso = Math.max(1, Math.floor(str.length / 64));
  for (let i = 0; i < str.length; i += paso) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return String(h) + ":" + str.length;
}

// Sube las fotos que cambiaron desde la última vez (comparando por hash
// contra una caché local en IndexedDB, clave por proyecto) y devuelve el
// mapa {key: url} completo (las que no cambiaron reusan la url ya
// guardada, sin re-subir). imagenesJson es el string tal cual lo devuelve
// extraerImagenesGrandes().
async function fsSubirImagenesFaltantes(proyectoId, imagenesJson) {
  const imagenes = JSON.parse(imagenesJson || "{}");
  const claves = Object.keys(imagenes);
  if (claves.length === 0) return {};

  const claveCache = "fsImagenesCache:" + proyectoId;
  let cache = {};
  try {
    cache = (await window.idbLeerMetaClave(claveCache)) || {};
  } catch (e) {
    cache = {};
  }

  const urls = {};
  let cacheCambio = false;
  for (const key of claves) {
    const dataUrl = imagenes[key];
    const hash = hashLiviano(dataUrl);
    if (cache[key] && cache[key].hash === hash) {
      urls[key] = cache[key].url;
      continue;
    }
    const ref = storage().ref("proyectos/" + proyectoId + "/" + key);
    await ref.putString(dataUrl, "data_url");
    const url = await ref.getDownloadURL();
    urls[key] = url;
    cache[key] = { hash, url };
    cacheCambio = true;
  }
  if (cacheCambio && window.idbGuardarMetaClave) {
    try { await window.idbGuardarMetaClave(claveCache, cache); } catch (e) { /* best-effort */ }
  }
  return urls;
}

// Descarga cada foto de su url y arma el mismo formato de string que
// produce extraerImagenesGrandes() (JSON de {key: dataUrl}), listo para
// pasarle a reinsertarImagenesGrandes(). Si una foto puntual falla al
// bajar (red mala a mitad de descarga), esa queda como placeholder sin
// resolver en vez de tirar abajo el resto del proyecto — mejor un proyecto
// con una foto rota que un proyecto que no se pudo abrir.
async function fsDescargarImagenesComoJson(imagenesUrls) {
  const imagenes = {};
  const entradas = Object.entries(imagenesUrls || {});
  for (const [key, url] of entradas) {
    try {
      const respuesta = await fetch(url);
      const blob = await respuesta.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("Error leyendo la imagen descargada"));
        reader.readAsDataURL(blob);
      });
      imagenes[key] = dataUrl;
    } catch (e) {
      console.error("No se pudo bajar la imagen", key, e);
      // Se deja sin esa clave — reinsertarImagenesGrandes deja el
      // placeholder "@@IMG:key" sin resolver para esa foto puntual.
    }
  }
  return JSON.stringify(imagenes);
}

window.fsSubirImagenesFaltantes = fsSubirImagenesFaltantes;
window.fsDescargarImagenesComoJson = fsDescargarImagenesComoJson;
// Exportado aparte para poder probar el hash sin Firebase real.
window.hashLivianoImagen = hashLiviano;

})();
