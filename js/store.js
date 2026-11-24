// Capa de datos: localStorage + sincronización con un JSON en GitHub.
// El token de GitHub vive solo en localStorage del navegador; nunca en el código.
const STORAGE_KEY = 'crm-vehiculos-v1';
const CONFIG_KEY = 'crm-github-config';

function estadoInicial() {
  return { vehiculos: [], leads: [], publicaciones: [], meta: { actualizado: null, version: 1 } };
}

let data = estadoInicial();
let config = { ...githubConfig };
let githubActivo = false;
let shaActual = null;

function leerConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    config = { ...githubConfig, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) {
    config = { ...githubConfig };
  }
}

function guardarConfig(cambios) {
  config = { ...config, ...cambios };
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
  catch (e) { avisar('No se pudo guardar la configuración en el navegador.', true); }
  return config;
}

function configCompleta() {
  return !!(config.owner && config.repo && config.token);
}

function cargarLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return estadoInicial();
    const parsed = JSON.parse(raw);
    return { ...estadoInicial(), ...parsed };
  } catch (e) {
    console.warn('No se pudo leer el almacenamiento local:', e);
    return estadoInicial();
  }
}

function guardarLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.warn('No se pudo guardar en local:', e); }
}

function nuevoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function aBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  bytes.forEach((b) => { binario += String.fromCharCode(b); });
  return btoa(binario);
}

function deBase64(base64) {
  const binario = atob(String(base64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function headersGitHub() {
  return {
    'Authorization': 'Bearer ' + config.token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

function urlArchivo() {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.ruta}`;
}

async function iniciarGitHub() {
  leerConfig();
  data = cargarLocal();
  githubActivo = configCompleta();
  if (githubActivo) await recargarDatos();
  return githubActivo;
}

// Traer el JSON del repo. Si no existe, lo crea con los datos actuales.
async function recargarDatos() {
  if (!githubActivo) return;
  try {
    const res = await fetch(urlArchivo() + `?ref=${encodeURIComponent(config.branch || 'main')}`, { headers: headersGitHub() });
    if (res.status === 404) {
      shaActual = null;
      await guardar();
    } else if (!res.ok) {
      throw new Error('GitHub ' + res.status + ' ' + (await res.text()).slice(0, 120));
    } else {
      const json = await res.json();
      shaActual = json.sha;
      const remoto = JSON.parse(deBase64(json.content));
      // Los leads son datos personales: se mantienen solo en este navegador.
      const leadsLocales = data.leads || [];
      data = { ...estadoInicial(), ...remoto, leads: leadsLocales };
      guardarLocal();
    }
  } catch (e) {
    avisar('No se pudo sincronizar con GitHub: ' + e.message, true);
  }
  if (typeof render === 'function') render();
}

// Guardar en local y, si está conectado, hacer commit del JSON en GitHub.
async function guardar() {
  data.meta = data.meta || {};
  data.meta.actualizado = new Date().toISOString();
  guardarLocal();
  if (!githubActivo) return;

  // Al repo público solo van vehículos y publicaciones. Los leads no se suben.
  const payload = { vehiculos: data.vehiculos, publicaciones: data.publicaciones, meta: data.meta };
  const cuerpo = {
    message: 'Actualizar CRM desde la app',
    content: aBase64(JSON.stringify(payload, null, 2)),
    branch: config.branch || 'main'
  };
  if (shaActual) cuerpo.sha = shaActual;
  try {
    const res = await fetch(urlArchivo(), {
      method: 'PUT',
      headers: headersGitHub(),
      body: JSON.stringify(cuerpo)
    });
    if (!res.ok) throw new Error('GitHub ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const json = await res.json();
    shaActual = json.content && json.content.sha;
  } catch (e) {
    avisar('Error al guardar en GitHub: ' + e.message, true);
  }
}

function requiereEditor() {
  if (githubActivo && !configCompleta()) {
    avisar('Conecta GitHub desde Configuración para editar.', true);
    return false;
  }
  return true;
}

// Disparar el workflow de publicación. Con publicacionId vacío procesa toda la cola.
async function dispararWorkflow(publicacionId) {
  if (!githubActivo) throw new Error('GitHub no está conectado.');
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/actions/workflows/publicar.yml/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headersGitHub(),
    body: JSON.stringify({ ref: config.branch || 'main', inputs: { publicacionId: publicacionId || '' } })
  });
  if (!res.ok) throw new Error('GitHub ' + res.status + ' ' + (await res.text()).slice(0, 160));
  return true;
}

function avisar(mensaje, esError) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = mensaje;
  el.classList.remove('hidden');
  el.style.background = esError ? '#a8332a' : '#1b2733';
  clearTimeout(avisar._t);
  avisar._t = setTimeout(() => el.classList.add('hidden'), 4200);
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
