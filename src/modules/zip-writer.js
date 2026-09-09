// ============================================================================
// Escritor de ZIP mínimo, sin librería externa — evita tener que vendorizar
// una librería nueva y tocar index.html solo para esto. Usa método STORED
// (sin comprimir): las fotos ya son JPEG comprimido, así que comprimir de
// nuevo no ahorraría casi nada, y STORED es mucho más simple de implementar
// bien a mano que DEFLATE. Formato ZIP estándar (local header + central
// directory + end of central directory), con el bit UTF-8 activado para que
// nombres de zona con tildes/ñ se vean bien en cualquier descompresor.
// Kevin, 08/09/2026: "opción para descargar las imágenes del levantamiento
// en formato zip, organizadas por zona".
// ============================================================================

function crc32(bytes) {
  let c;
  const tabla = crc32._tabla || (crc32._tabla = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ tabla[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function utf8Bytes(str) {
  return new TextEncoder().encode(str);
}

function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]; }

// archivos: [{ ruta: "Zona1/foto.jpg", datos: Uint8Array }, ...]
// Devuelve un Uint8Array con el .zip completo.
function construirZip(archivos) {
  const partesLocales = [];
  const partesCentral = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = 0x21; // fecha neutra válida (1980-01-01), no afecta el contenido

  for (const { ruta, datos } of archivos) {
    const nombreBytes = utf8Bytes(ruta.replace(/\\/g, "/"));
    const crc = crc32(datos);
    const flag = 0x0800; // bit 11: nombre en UTF-8

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(flag), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nombreBytes.length), ...u16(0),
    ];
    const localHeader = new Uint8Array(local);
    partesLocales.push(localHeader, nombreBytes, datos);

    const central = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flag), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nombreBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset),
    ];
    partesCentral.push(new Uint8Array(central), nombreBytes);

    offset += localHeader.length + nombreBytes.length + datos.length;
  }

  const inicioCentral = offset;
  let tamanoCentral = 0;
  for (const p of partesCentral) tamanoCentral += p.length;

  const fin = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(archivos.length), ...u16(archivos.length),
    ...u32(tamanoCentral), ...u32(inicioCentral), ...u16(0),
  ]);

  const total = offset + tamanoCentral + fin.length;
  const salida = new Uint8Array(total);
  let cursor = 0;
  for (const p of [...partesLocales, ...partesCentral, fin]) {
    salida.set(p, cursor);
    cursor += p.length;
  }
  return salida;
}

function base64ADatosBinarios(dataUrl) {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// Nombres de carpeta/archivo seguros en Windows/Mac/Linux — evita
// / \ : * ? " < > | y recorta espacios repetidos.
function nombreDeArchivoSeguro(s) {
  return String(s).replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

if (typeof window !== "undefined") {
  window.construirZip = construirZip;
  window.base64ADatosBinarios = base64ADatosBinarios;
  window.nombreDeArchivoSeguro = nombreDeArchivoSeguro;
  window.crc32 = crc32;
}
if (typeof module !== "undefined") {
  module.exports = { construirZip, base64ADatosBinarios, nombreDeArchivoSeguro, crc32 };
}
