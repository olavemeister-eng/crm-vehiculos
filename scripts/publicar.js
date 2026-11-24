// Se ejecuta en GitHub Actions. Lee datos/crm.json, publica lo pendiente en Meta
// y actualiza los estados en el mismo archivo. Los secretos llegan por variables de entorno.
const fs = require('fs');
const path = require('path');

const RUTA = path.join(__dirname, '..', 'datos', 'crm.json');
const GRAPH = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
const PAGE_ID = process.env.META_PAGE_ID || '';
const IG_ID = process.env.META_IG_USER_ID || '';
const SOLO_ID = process.env.PUBLICACION_ID || '';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function graphPost(ruta, params) {
  const res = await fetch(`${GRAPH}/${ruta}`, {
    method: 'POST',
    body: new URLSearchParams({ ...params, access_token: TOKEN })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error?.message || 'Error HTTP ' + res.status);
  return json;
}

async function graphGet(ruta, params) {
  const url = new URL(`${GRAPH}/${ruta}`);
  Object.entries({ ...params, access_token: TOKEN }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error?.message || 'Error HTTP ' + res.status);
  return json;
}

function fmtCLP(n) {
  const v = Number(n);
  if (!v || isNaN(v)) return 'A convenir';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
}

function generarCaption(v) {
  const datos = [
    v.patente ? `🚘 Patente: ${v.patente}` : '',
    v.anio ? `📅 Año: ${v.anio}` : '',
    v.kilometraje ? `🛣️ Kilometraje: ${new Intl.NumberFormat('es-CL').format(Number(v.kilometraje))} km` : '',
    v.combustible ? `⛽ ${v.combustible}` : '',
    v.transmision ? `⚙️ ${v.transmision}` : '',
    v.color ? `🎨 ${v.color}` : ''
  ].filter(Boolean);
  const nombre = [v.marca, v.modelo, v.version].filter(Boolean).join(' ') || 'Vehículo en venta';
  const partes = [
    `🚗 ${nombre.toUpperCase()} ${v.anio ? '· ' + v.anio : ''}`, '',
    ...datos, '',
    v.descripcion || '', '',
    `💰 Precio: ${fmtCLP(v.precio)}`, '',
    '📩 Escríbenos al directo para más información o coordinar una prueba.', '',
    '#VehiculosEnVenta #AutosChile #Concesionario #VentaDeAutos #AutoUsado'
  ];
  return partes.filter((l, i, arr) => l !== '' || (arr[i - 1] !== '' && i < arr.length - 1)).join('\n').trim();
}

async function publicarFacebook(caption, imageUrl) {
  const res = await graphPost(`${PAGE_ID}/photos`, { url: imageUrl, caption });
  return { id: res.id, url: `https://www.facebook.com/${res.id}` };
}

async function publicarInstagram(caption, imageUrl) {
  const cont = await graphPost(`${IG_ID}/media`, { image_url: imageUrl, caption, media_type: 'IMAGE' });
  for (let i = 0; i < 12; i++) {
    const estado = await graphGet(cont.id, { fields: 'status_code' });
    if (estado.status_code === 'FINISHED') break;
    if (estado.status_code === 'ERROR') throw new Error('Meta no pudo procesar la imagen.');
    await esperar(1000);
  }
  const res = await graphPost(`${IG_ID}/media_publish`, { creation_id: cont.id });
  return { id: res.id, url: `https://www.instagram.com/p/${res.id}/` };
}

async function main() {
  if (!fs.existsSync(RUTA)) {
    console.log('No existe datos/crm.json; nada que hacer.');
    return;
  }
  if (!TOKEN || !PAGE_ID || !IG_ID) {
    console.log('Faltan secrets de Meta (META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_IG_USER_ID). No se publica.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
  const ahora = Date.now();
  let cambios = false;

  for (const pub of data.publicaciones || []) {
    const solicitada = !!SOLO_ID && pub.id === SOLO_ID;
    const pendiente = pub.estado === 'pendiente' && !!pub.fecha && new Date(pub.fecha).getTime() <= ahora;
    if (!solicitada && !pendiente) continue;

    const vehiculo = (data.vehiculos || []).find((v) => v.id === pub.vehiculoId);
    if (!vehiculo) {
      pub.estado = 'error';
      pub.error = 'Vehículo no encontrado';
      cambios = true;
      continue;
    }
    const imagen = (vehiculo.fotos || []).find((u) => /^https:\/\//i.test(u));
    if (!imagen) {
      pub.estado = 'error';
      pub.error = 'El vehículo no tiene una foto con URL pública https';
      cambios = true;
      continue;
    }

    try {
      const caption = pub.caption || generarCaption(vehiculo);
      pub.resultado = {};
      for (const red of pub.redes || []) {
        if (red === 'facebook') pub.resultado.facebook = await publicarFacebook(caption, imagen);
        if (red === 'instagram') pub.resultado.instagram = await publicarInstagram(caption, imagen);
      }
      pub.estado = 'publicado';
      pub.publicadoEn = new Date().toISOString();
      delete pub.error;
      console.log(`Publicado: ${pub.id} (${(pub.redes || []).join(', ')})`);
    } catch (e) {
      pub.estado = 'error';
      pub.error = e.message;
      console.error(`Error en ${pub.id}: ${e.message}`);
    }
    cambios = true;
  }

  if (cambios) {
    data.meta = data.meta || {};
    data.meta.actualizado = new Date().toISOString();
    fs.writeFileSync(RUTA, JSON.stringify(data, null, 2));
    console.log('Estados guardados en datos/crm.json');
  } else {
    console.log('Nada que publicar.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
