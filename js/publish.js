// Generación de texto y compartir. La publicación automática la hace GitHub Actions.
const HASHTAGS = '#VehiculosEnVenta #AutosChile #Concesionario #VentaDeAutos #AutoUsado';

function fmtCLP(n) {
  const v = Number(n);
  if (!v || isNaN(v)) return 'A convenir';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
}

function fmtKm(n) {
  const v = Number(n);
  return v ? new Intl.NumberFormat('es-CL').format(v) + ' km' : '';
}

function nombreVehiculo(v) {
  return [v.marca, v.modelo, v.version].filter(Boolean).join(' ').trim() || 'Vehículo en venta';
}

// Texto listo para Instagram / Facebook.
function generarCaption(v) {
  const datos = [
    v.patente ? `🚘 Patente: ${v.patente}` : '',
    v.anio ? `📅 Año: ${v.anio}` : '',
    fmtKm(v.kilometraje) ? `🛣️ Kilometraje: ${fmtKm(v.kilometraje)}` : '',
    v.combustible ? `⛽ ${v.combustible}` : '',
    v.transmision ? `⚙️ ${v.transmision}` : '',
    v.color ? `🎨 ${v.color}` : ''
  ].filter(Boolean);

  const partes = [
    `🚗 ${nombreVehiculo(v).toUpperCase()} ${v.anio ? '· ' + v.anio : ''}`,
    '',
    ...datos,
    '',
    v.descripcion ? v.descripcion.trim() : '',
    '',
    `💰 Precio: ${fmtCLP(v.precio)}`,
    '',
    '📩 Escríbenos al directo para más información o coordinar una prueba.',
    '',
    HASHTAGS
  ];
  return partes.filter((linea, i) => linea !== '' || (partes[i - 1] !== '' && i < partes.length - 1)).join('\n').trim();
}

// URL pública de solo lectura del vehículo (para compartir en FB o WhatsApp).
function urlPublica(v) {
  const url = new URL(window.location.href);
  url.search = '?v=' + encodeURIComponent(v.id);
  url.hash = '';
  return url.toString();
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// Compartir manual: Web Share API si existe; si no, Facebook intent / copiar + abrir IG.
async function compartirVehiculo(v, red) {
  const caption = generarCaption(v);
  const url = urlPublica(v);

  if (navigator.share) {
    try {
      await navigator.share({ title: nombreVehiculo(v), text: caption, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  if (red === 'facebook') {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'noopener,noreferrer');
  } else if (red === 'whatsapp') {
    window.open('https://wa.me/?text=' + encodeURIComponent(caption + '\n' + url), '_blank', 'noopener,noreferrer');
  } else {
    const ok = await copiar(caption + '\n\n' + url);
    avisar(ok ? 'Texto copiado. Pégalo en tu historia o publicación de Instagram.' : 'No se pudo copiar el texto.', !ok);
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  }
}

// Publicación automática: dispara el workflow de GitHub Actions.
async function publicarAhora(publicacionId) {
  if (!githubActivo) {
    avisar('Conecta GitHub para publicar automáticamente. Mientras tanto usa los botones de compartir.', true);
    return false;
  }
  avisar('Enviando a GitHub Actions…');
  try {
    await dispararWorkflow(publicacionId);
    avisar('Enviado. Se publicará en aproximadamente 1 minuto.');
    return true;
  } catch (e) {
    avisar('No se pudo iniciar la publicación: ' + e.message, true);
    return false;
  }
}

function redesTexto(redes) {
  return (redes || []).map((r) => (r === 'facebook' ? 'Facebook' : r === 'instagram' ? 'Instagram' : r)).join(' + ') || '—';
}
