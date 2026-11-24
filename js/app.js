// Interfaz: render, formularios y acciones. Toda la lógica de datos vive en store.js.
const ESTADOS_VEH = ['Disponible', 'Reservado', 'Vendido'];
const ESTADOS_LEAD = ['Nuevo', 'Contactado', 'Interesado', 'Cita', 'Vendido', 'Descartado'];
let tabActiva = 'inventario';

function valor(form, nombre) {
  const el = form.elements[nombre];
  return el ? String(el.value || '').trim() : '';
}

function campo(nombre, etiqueta, valorInicial = '', tipo = 'text', extra = '', full = false) {
  return `<div class="campo ${full ? 'full' : ''}">
    <label for="f_${nombre}">${esc(etiqueta)}</label>
    <input id="f_${nombre}" name="${nombre}" type="${tipo}" value="${esc(valorInicial)}" ${extra}>
  </div>`;
}

function area(nombre, etiqueta, valorInicial = '', full = true) {
  return `<div class="campo ${full ? 'full' : ''}">
    <label for="f_${nombre}">${esc(etiqueta)}</label>
    <textarea id="f_${nombre}" name="${nombre}">${esc(valorInicial)}</textarea>
  </div>`;
}

function selectCampo(nombre, etiqueta, opciones, actual = '', full = false) {
  const opts = opciones.map((o) => {
    const value = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    return `<option value="${esc(value)}" ${value === actual ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
  return `<div class="campo ${full ? 'full' : ''}">
    <label for="f_${nombre}">${esc(etiqueta)}</label>
    <select id="f_${nombre}" name="${nombre}">${opts}</select>
  </div>`;
}

function abrirModal(titulo, camposHTML, onSubmit, guardarTexto = 'Guardar') {
  document.getElementById('modalTitulo').textContent = titulo;
  const form = document.getElementById('modalForm');
  form.innerHTML = camposHTML + `<div class="form-actions">
    <button type="button" class="btn" id="modalCancelar">Cancelar</button>
    <button type="submit" class="btn primary">${esc(guardarTexto)}</button>
  </div>`;
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modalCancelar').onclick = cerrarModal;
  form.onsubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };
  const primer = form.querySelector('input,select,textarea');
  if (primer) primer.focus();
}

function cerrarModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modalForm').innerHTML = '';
}

function fotoHTML(v, clase) {
  const fotos = (v.fotos || []).filter(Boolean);
  if (!fotos.length) return `<div class="${clase}">🚙</div>`;
  return `<div class="${clase}"><img src="${esc(fotos[0])}" alt="${esc(nombreVehiculo(v))}" loading="lazy" onerror="this.parentElement.textContent='🚙'"></div>`;
}

function vencido(lead) {
  if (!lead.proximo || lead.estado === 'Vendido' || lead.estado === 'Descartado') return false;
  return new Date(lead.proximo).getTime() < Date.now();
}

function dtLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- Formularios ---------- */

function abrirFormVehiculo(id) {
  const v = id ? data.vehiculos.find((x) => x.id === id) : null;
  const html = `<div class="campos">
    ${campo('patente', 'Patente', v?.patente || '', 'text', 'placeholder="ABC123"')}
    ${campo('marca', 'Marca', v?.marca || '')}
    ${campo('modelo', 'Modelo', v?.modelo || '')}
    ${campo('version', 'Versión / motor', v?.version || '')}
    ${campo('anio', 'Año', v?.anio || '', 'number', 'min="1950" max="2030"')}
    ${campo('kilometraje', 'Kilómetros', v?.kilometraje || '', 'number', 'min="0"')}
    ${campo('precio', 'Precio (CLP)', v?.precio || '', 'number', 'min="0" step="1"')}
    ${selectCampo('estado', 'Estado', ESTADOS_VEH, v?.estado || 'Disponible')}
    ${campo('combustible', 'Combustible', v?.combustible || '', 'text', 'placeholder="Bencina, Diésel, Eléctrico…"')}
    ${campo('transmision', 'Transmisión', v?.transmision || '', 'text', 'placeholder="Manual / Automática"')}
    ${campo('color', 'Color', v?.color || '')}
    ${area('descripcion', 'Descripción para las publicaciones', v?.descripcion || '')}
    ${area('fotos', 'Fotos (una URL https por línea)', (v?.fotos || []).join('\n'))}
  </div>`;

  abrirModal(v ? 'Editar vehículo' : 'Nuevo vehículo', html, (form) => {
    if (!requiereEditor()) return;
    const item = {
      id: v ? v.id : nuevoId(),
      patente: valor(form, 'patente').toUpperCase(),
      marca: valor(form, 'marca'),
      modelo: valor(form, 'modelo'),
      version: valor(form, 'version'),
      anio: Number(valor(form, 'anio')) || 0,
      kilometraje: Number(valor(form, 'kilometraje')) || 0,
      precio: Number(valor(form, 'precio')) || 0,
      estado: valor(form, 'estado') || 'Disponible',
      combustible: valor(form, 'combustible'),
      transmision: valor(form, 'transmision'),
      color: valor(form, 'color'),
      descripcion: valor(form, 'descripcion'),
      fotos: valor(form, 'fotos').split('\n').map((s) => s.trim()).filter(Boolean),
      creado: v ? v.creado : new Date().toISOString()
    };
    if (!item.marca && !item.patente) return avisar('Ingresa al menos patente o marca.', true);
    if (v) data.vehiculos[data.vehiculos.findIndex((x) => x.id === v.id)] = item;
    else data.vehiculos.unshift(item);
    guardar(); cerrarModal(); render(); avisar('Vehículo guardado.');
  });
}

function abrirFormLead(id) {
  const l = id ? data.leads.find((x) => x.id === id) : null;
  const opciones = [{ value: '', label: 'Sin vehículo asociado' }, ...data.vehiculos.map((v) => ({ value: v.id, label: nombreVehiculo(v) + (v.patente ? ' · ' + v.patente : '') }))];
  const html = `<div class="campos">
    ${campo('nombre', 'Nombre del interesado', l?.nombre || '')}
    ${campo('telefono', 'Teléfono / WhatsApp', l?.telefono || '', 'tel')}
    ${campo('email', 'Correo', l?.email || '', 'email')}
    ${selectCampo('vehiculoId', 'Vehículo de interés', opciones, l?.vehiculoId || '')}
    ${selectCampo('estado', 'Estado', ESTADOS_LEAD, l?.estado || 'Nuevo')}
    ${campo('proximo', 'Próximo seguimiento', l?.proximo || '', 'date')}
    ${area('notas', 'Notas', l?.notas || '')}
  </div>`;

  abrirModal(l ? 'Editar lead' : 'Nuevo lead', html, (form) => {
    if (!requiereEditor()) return;
    const item = {
      id: l ? l.id : nuevoId(),
      nombre: valor(form, 'nombre'),
      telefono: valor(form, 'telefono'),
      email: valor(form, 'email'),
      vehiculoId: valor(form, 'vehiculoId'),
      estado: valor(form, 'estado') || 'Nuevo',
      proximo: valor(form, 'proximo'),
      notas: valor(form, 'notas'),
      interacciones: l ? l.interacciones || [] : [],
      creado: l ? l.creado : new Date().toISOString()
    };
    if (!item.nombre) return avisar('Ingresa el nombre del interesado.', true);
    if (l) data.leads[data.leads.findIndex((x) => x.id === l.id)] = item;
    else data.leads.unshift(item);
    guardar(); cerrarModal(); render(); avisar('Lead guardado.');
  });
}

function abrirFormPublicacion(id, vehiculoIdPre) {
  const p = id ? data.publicaciones.find((x) => x.id === id) : null;
  const vehPre = p
    ? data.vehiculos.find((v) => v.id === p.vehiculoId)
    : (data.vehiculos.find((v) => v.id === vehiculoIdPre) || data.vehiculos[0]);
  if (!data.vehiculos.length) return avisar('Primero agrega un vehículo al inventario.', true);
  const opciones = data.vehiculos.map((v) => ({ value: v.id, label: nombreVehiculo(v) + (v.patente ? ' · ' + v.patente : '') }));
  const captionInicial = p ? p.caption : (vehPre ? generarCaption(vehPre) : '');
  const fechaInicial = p && p.fecha ? dtLocal(new Date(p.fecha)) : dtLocal(new Date(Date.now() + 86400000));
  const fb = !p || (p.redes || []).includes('facebook');
  const ig = !p || (p.redes || []).includes('instagram');

  const html = `<div class="campos">
    ${selectCampo('vehiculoId', 'Vehículo', opciones, p ? p.vehiculoId : (vehiculoIdPre || data.vehiculos[0].id), true)}
    <div class="campo full"><label>Redes sociales</label>
      <div class="checks">
        <label><input type="checkbox" name="redes" value="facebook" ${fb ? 'checked' : ''}> Facebook</label>
        <label><input type="checkbox" name="redes" value="instagram" ${ig ? 'checked' : ''}> Instagram</label>
      </div>
    </div>
    ${campo('fecha', 'Fecha y hora de publicación', fechaInicial, 'datetime-local', '', true)}
    ${area('caption', 'Texto de la publicación', captionInicial)}
  </div>`;

  abrirModal(p ? 'Editar publicación' : 'Programar publicación', html, (form) => {
    if (!requiereEditor()) return;
    const redes = Array.from(form.querySelectorAll('input[name="redes"]:checked')).map((el) => el.value);
    if (!redes.length) return avisar('Selecciona al menos una red.', true);
    const fechaRaw = valor(form, 'fecha');
    const item = {
      id: p ? p.id : nuevoId(),
      vehiculoId: valor(form, 'vehiculoId'),
      redes,
      fecha: fechaRaw ? new Date(fechaRaw).toISOString() : '',
      caption: valor(form, 'caption'),
      estado: p ? p.estado : 'pendiente',
      creado: p ? p.creado : new Date().toISOString()
    };
    if (p) data.publicaciones[data.publicaciones.findIndex((x) => x.id === p.id)] = item;
    else data.publicaciones.push(item);
    guardar(); cerrarModal(); render(); avisar('Publicación guardada.');
  });
}

/* ---------- Render ---------- */

function renderVehiculos() {
  const el = document.getElementById('listaVehiculos');
  const q = (document.getElementById('buscarVeh').value || '').toLowerCase();
  const estado = document.getElementById('filtroEstadoVeh').value;
  const items = data.vehiculos.filter((v) =>
    (!q || [v.patente, v.marca, v.modelo, v.version].join(' ').toLowerCase().includes(q)) &&
    (!estado || v.estado === estado)
  );
  if (!items.length) {
    el.innerHTML = `<div class="vacio">No hay vehículos con esos filtros. Presiona <strong>+ Nuevo vehículo</strong> para agregar uno.</div>`;
    return;
  }
  el.innerHTML = items.map((v) => `<article class="card">
    ${fotoHTML(v, 'foto')}
    <div class="card-body">
      <div class="etiquetas"><span class="tag ${(v.estado || '').toLowerCase()}">${esc(v.estado)}</span></div>
      <h3>${esc(nombreVehiculo(v))}</h3>
      <div class="patente">${esc(v.patente || 'Sin patente')} ${v.anio ? '· ' + esc(v.anio) : ''}</div>
      <div class="specs">
        ${fmtKm(v.kilometraje) ? `<span>${esc(fmtKm(v.kilometraje))}</span>` : ''}
        ${v.combustible ? `<span>${esc(v.combustible)}</span>` : ''}
        ${v.transmision ? `<span>${esc(v.transmision)}</span>` : ''}
        ${v.color ? `<span>${esc(v.color)}</span>` : ''}
      </div>
      ${v.descripcion ? `<div class="desc">${esc(v.descripcion)}</div>` : ''}
      <div class="precio">${esc(fmtCLP(v.precio))}</div>
    </div>
    <div class="card-actions">
      <button class="btn small" data-act="ver-veh" data-id="${v.id}">Ver ficha</button>
      <button class="btn small" data-act="pub-veh" data-id="${v.id}">Programar</button>
      <button class="btn small" data-act="share-fb" data-id="${v.id}">FB</button>
      <button class="btn small" data-act="share-ig" data-id="${v.id}">IG</button>
      <button class="btn small" data-act="share-wa" data-id="${v.id}">WA</button>
      <button class="btn small" data-act="edit-veh" data-id="${v.id}">Editar</button>
      <button class="btn small danger" data-act="del-veh" data-id="${v.id}">Borrar</button>
    </div>
  </article>`).join('');
}

function renderLeads() {
  const el = document.getElementById('listaLeads');
  const q = (document.getElementById('buscarLead').value || '').toLowerCase();
  const estado = document.getElementById('filtroEstadoLead').value;
  const items = data.leads.filter((l) =>
    (!q || [l.nombre, l.telefono, l.email].join(' ').toLowerCase().includes(q)) &&
    (!estado || l.estado === estado)
  );
  if (!items.length) {
    el.innerHTML = `<div class="vacio">No hay leads con esos filtros. Registra a tus interesados con <strong>+ Nuevo lead</strong>.</div>`;
    return;
  }
  el.innerHTML = items.map((l) => {
    const v = data.vehiculos.find((x) => x.id === l.vehiculoId);
    const interacciones = l.interacciones || [];
    return `<article class="card">
      <div class="card-body">
        <div class="etiquetas"><span class="tag ${(l.estado || '').toLowerCase()}">${esc(l.estado)}</span>${vencido(l) ? '<span class="tag descartado">Seguimiento vencido</span>' : ''}</div>
        <h3>${esc(l.nombre)}</h3>
        <div class="specs">
          ${l.telefono ? `<span><a href="https://wa.me/${esc(l.telefono.replace(/\D/g, ''))}" target="_blank" rel="noopener">📞 ${esc(l.telefono)}</a></span>` : ''}
          ${l.email ? `<span>✉️ ${esc(l.email)}</span>` : ''}
        </div>
        <p style="margin:6px 0;font-size:13px">Interés: <strong>${v ? esc(nombreVehiculo(v)) : 'Sin vehículo asignado'}</strong></p>
        ${l.proximo ? `<p style="margin:6px 0;font-size:13px" class="${vencido(l) ? 'vencido' : ''}">📆 Seguimiento: ${esc(l.proximo)}</p>` : ''}
        ${l.notas ? `<div class="notas">${esc(l.notas)}</div>` : ''}
        ${interacciones.length ? `<div class="interacciones"><strong>Últimas interacciones:</strong><br>${interacciones.slice(-3).reverse().map((i) => `${esc(i.fecha)} — ${esc(i.texto)}`).join('<br>')}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn small" data-act="interaccion" data-id="${l.id}">+ Interacción</button>
        <button class="btn small" data-act="edit-lead" data-id="${l.id}">Editar</button>
        <button class="btn small danger" data-act="del-lead" data-id="${l.id}">Borrar</button>
      </div>
    </article>`;
  }).join('');
}

function renderPublicaciones() {
  const el = document.getElementById('listaPublicaciones');
  const items = [...data.publicaciones].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  if (!items.length) {
    el.innerHTML = `<div class="vacio">Aún no hay publicaciones. Programa una desde el inventario o con <strong>+ Programar publicación</strong>.</div>`;
    return;
  }
  el.innerHTML = items.map((p) => {
    const v = data.vehiculos.find((x) => x.id === p.vehiculoId);
    const fecha = p.fecha ? new Date(p.fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';
    return `<article class="pub">
      <div class="pub-head">
        <div><strong>${v ? esc(nombreVehiculo(v)) : 'Vehículo eliminado'}</strong><br>
          <span style="font-size:12px;color:var(--gris)">📅 ${esc(fecha)} · ${esc(redesTexto(p.redes))}</span></div>
        <span class="tag ${p.estado === 'publicado' ? 'disponible' : p.estado === 'error' ? 'descartado' : 'reservado'}">${esc(p.estado)}</span>
      </div>
      ${p.error ? `<p style="color:var(--rojo);font-size:12px">${esc(p.error)}</p>` : ''}
      <div class="pub-caption">${esc(p.caption || (v ? generarCaption(v) : ''))}</div>
      <div class="pub-actions">
        <button class="btn small verde" data-act="publicar-pub" data-id="${p.id}">Publicar ahora</button>
        <button class="btn small" data-act="copiar-pub" data-id="${p.id}">Copiar texto</button>
        <button class="btn small" data-act="share-pub-fb" data-id="${p.id}">Compartir FB</button>
        <button class="btn small" data-act="share-pub-ig" data-id="${p.id}">Compartir IG</button>
        <button class="btn small" data-act="edit-pub" data-id="${p.id}">Editar</button>
        <button class="btn small danger" data-act="del-pub" data-id="${p.id}">Borrar</button>
      </div>
    </article>`;
  }).join('');
}

function renderConfig() {
  const el = document.getElementById('contenidoConfig');
  el.innerHTML = `
    <div class="config-card">
      <h3>🐙 Conexión con GitHub</h3>
      <p>${githubActivo
        ? `Sincronizado con <code>${esc(config.owner)}/${esc(config.repo)}</code> (rama <code>${esc(config.branch)}</code>).`
        : 'Modo local: los datos quedan en este navegador. Conecta GitHub para sincronizarlos y habilitar la publicación automática.'}</p>
      <form id="formGitHub" class="campos">
        ${campo('owner', 'Usuario u organización', config.owner || '')}
        ${campo('repo', 'Nombre del repositorio', config.repo || '')}
        ${campo('branch', 'Rama', config.branch || 'main')}
        ${campo('ruta', 'Ruta del JSON', config.ruta || 'datos/crm.json', 'text', '', true)}
        ${campo('token', 'Token de acceso personal (PAT)', config.token ? '••••••••••••' : '', 'password', 'placeholder="github_pat_..." autocomplete="off"', true)}
        <div class="form-actions full">
          <button type="submit" class="btn primary">Guardar conexión</button>
          ${githubActivo ? '<button type="button" class="btn" data-act="sincronizar">Sincronizar ahora</button>' : ''}
        </div>
      </form>
      <p style="margin-top:10px">El token se guarda <strong>solo en este navegador</strong>. Crea un <em>fine-grained token</em> con permisos <code>Contents: read/write</code> y <code>Actions: write</code> sobre este repositorio. No lo pegues en archivos del repo.</p>
    </div>

    <div class="config-card">
      <h3>📲 Publicación automática (GitHub Actions)</h3>
      <p>${githubActivo
        ? 'El workflow <code>publicar.yml</code> corre cada 10 minutos y también cuando presionas <strong>Publicar ahora</strong>.'
        : 'Conecta GitHub para habilitar la publicación automática.'}</p>
      <p style="margin-top:10px">En tu repo: <strong>Settings → Secrets and variables → Actions → New repository secret</strong> y agrega:</p>
      <p><code>META_PAGE_ACCESS_TOKEN</code><br><code>META_PAGE_ID</code><br><code>META_IG_USER_ID</code></p>
      <div class="config-actions">
        <button class="btn" data-act="probar-publicacion">Probar publicación (toda la cola)</button>
      </div>
      <p style="margin-top:10px">Además necesitas Página de Facebook + Instagram Business vinculadas y una app de Meta con permisos <code>pages_manage_posts</code> e <code>instagram_content_publish</code>.</p>
    </div>

    <div class="config-card">
      <h3>🧩 Cómo usar el CRM</h3>
      <p><strong>1.</strong> Carga tus vehículos con foto (URL pública https).<br>
      <strong>2.</strong> Registra interesados en Leads y anota sus seguimientos (se guardan solo en este navegador).<br>
      <strong>3.</strong> Programa publicaciones o usa los botones FB / IG / WA en cada vehículo.<br>
      <strong>4.</strong> Las publicaciones programadas se envían solas cada 10 min desde GitHub Actions.</p>
    </div>

    <div class="config-card">
      <h3>💾 Respaldos</h3>
      <div class="config-actions">
        <button class="btn" data-act="exportar">Exportar respaldo JSON</button>
        <button class="btn" data-act="importar">Importar respaldo JSON</button>
        <button class="btn danger" data-act="borrar-local">Borrar todos los datos</button>
      </div>
    </div>`;

  const form = document.getElementById('formGitHub');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const tokenNuevo = valor(form, 'token');
    guardarConfig({
      owner: valor(form, 'owner'),
      repo: valor(form, 'repo'),
      branch: valor(form, 'branch') || 'main',
      ruta: valor(form, 'ruta') || 'datos/crm.json',
      token: tokenNuevo && tokenNuevo !== '••••••••••••' ? tokenNuevo : config.token
    });
    githubActivo = configCompleta();
    shaActual = null;
    render();
    if (githubActivo) {
      await recargarDatos();
      avisar('Conexión guardada y sincronizada.');
    } else {
      avisar('Conexión guardada. Falta el token para sincronizar.', true);
    }
  };
}

function renderPublica() {
  const vid = new URLSearchParams(location.search).get('v');
  const publica = document.getElementById('vistaPublica');
  const app = document.getElementById('app');
  const acciones = document.querySelector('.head-actions');
  if (!vid) {
    publica.classList.add('hidden');
    app.classList.remove('hidden');
    acciones.classList.remove('hidden');
    return;
  }
  const v = data.vehiculos.find((x) => x.id === vid);
  app.classList.add('hidden');
  acciones.classList.add('hidden');
  publica.classList.remove('hidden');
  if (!v) {
    publica.innerHTML = '<div class="vacio">Vehículo no encontrado. <a href="./">Volver al inicio</a></div>';
    return;
  }
  const fotos = (v.fotos || []).filter(Boolean);
  publica.innerHTML = `<article class="public-card">
    ${fotoHTML(v, 'foto')}
    <div class="body">
      <div class="etiquetas"><span class="tag ${(v.estado || '').toLowerCase()}">${esc(v.estado)}</span></div>
      <h1>${esc(nombreVehiculo(v))}</h1>
      <div class="patente">${esc(v.patente || '')} ${v.anio ? '· ' + esc(v.anio) : ''}</div>
      <div class="specs">
        ${fmtKm(v.kilometraje) ? `<span>${esc(fmtKm(v.kilometraje))}</span>` : ''}
        ${v.combustible ? `<span>${esc(v.combustible)}</span>` : ''}
        ${v.transmision ? `<span>${esc(v.transmision)}</span>` : ''}
        ${v.color ? `<span>${esc(v.color)}</span>` : ''}
      </div>
      ${v.descripcion ? `<p>${esc(v.descripcion)}</p>` : ''}
      <div class="public-precio">${esc(fmtCLP(v.precio))}</div>
      <div class="acciones">
        <button class="btn primary" data-act="share-wa" data-id="${v.id}">📲 Consultar por WhatsApp</button>
        <button class="btn" data-act="share-fb" data-id="${v.id}">Compartir en Facebook</button>
        <button class="btn" data-act="copiar-publica" data-id="${v.id}">Copiar texto</button>
        <a class="btn ghost" href="./">← Volver</a>
      </div>
      ${fotos.length > 1 ? `<div class="specs" style="margin-top:18px">${fotos.slice(1).map((f) => `<a href="${esc(f)}" target="_blank" rel="noopener"><img src="${esc(f)}" style="width:64px;height:64px;object-fit:cover;border-radius:6px" alt="Foto"></a>`).join('')}</div>` : ''}
    </div>
  </article>`;
}

function render() {
  renderPublica();
  renderVehiculos();
  renderLeads();
  renderPublicaciones();
  renderConfig();

  const badge = document.getElementById('estadoModo');
  badge.textContent = githubActivo ? 'GitHub · sincronizado' : 'Modo local';
  badge.className = 'badge' + (githubActivo ? ' activo' : '');
  document.getElementById('btnLogin').classList.toggle('hidden', githubActivo);
  document.getElementById('btnLogout').classList.toggle('hidden', !githubActivo);
}

/* ---------- Acciones ---------- */

function exportarJSON() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'crm-vehiculos-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  avisar('Respaldo descargado.');
}

function importarJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = () => {
    const archivo = input.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const obj = JSON.parse(lector.result);
        if (!obj || typeof obj !== 'object') throw new Error('Archivo inválido');
        if (!confirm('Esto reemplazará los datos actuales. ¿Continuar?')) return;
        data = { ...estadoInicial(), ...obj };
        guardar(); render(); avisar('Datos importados.');
      } catch (e) {
        avisar('No se pudo importar: ' + e.message, true);
      }
    };
    lector.readAsText(archivo);
  };
  input.click();
}

async function manejarAccion(act, id) {
  const v = data.vehiculos.find((x) => x.id === id);
  const l = data.leads.find((x) => x.id === id);
  const p = data.publicaciones.find((x) => x.id === id);

  switch (act) {
    case 'ver-veh': window.open(urlPublica(v), '_blank', 'noopener'); break;
    case 'edit-veh': abrirFormVehiculo(id); break;
    case 'pub-veh': abrirFormPublicacion(null, id); break;
    case 'del-veh':
      if (confirm('¿Borrar este vehículo?')) { data.vehiculos = data.vehiculos.filter((x) => x.id !== id); guardar(); render(); avisar('Vehículo borrado.'); }
      break;
    case 'share-fb': compartirVehiculo(v, 'facebook'); break;
    case 'share-ig': compartirVehiculo(v, 'instagram'); break;
    case 'share-wa': compartirVehiculo(v, 'whatsapp'); break;
    case 'copiar-publica': copiar(generarCaption(v) + '\n\n' + urlPublica(v)).then((ok) => avisar(ok ? 'Texto copiado.' : 'No se pudo copiar.', !ok)); break;

    case 'edit-lead': abrirFormLead(id); break;
    case 'del-lead':
      if (confirm('¿Borrar este lead?')) { data.leads = data.leads.filter((x) => x.id !== id); guardar(); render(); avisar('Lead borrado.'); }
      break;
    case 'interaccion': {
      if (!requiereEditor()) return;
      const texto = prompt('¿Qué pasó con este interesado?');
      if (!texto) return;
      l.interacciones = l.interacciones || [];
      l.interacciones.push({ fecha: new Date().toLocaleDateString('es-CL'), texto });
      guardar(); render(); avisar('Interacción registrada.');
      break;
    }

    case 'edit-pub': abrirFormPublicacion(id); break;
    case 'del-pub':
      if (confirm('¿Borrar esta publicación?')) { data.publicaciones = data.publicaciones.filter((x) => x.id !== id); guardar(); render(); avisar('Publicación borrada.'); }
      break;
    case 'copiar-pub': copiar(p.caption).then((ok) => avisar(ok ? 'Texto copiado.' : 'No se pudo copiar.', !ok)); break;
    case 'share-pub-fb': compartirVehiculo(v, 'facebook'); break;
    case 'share-pub-ig': compartirVehiculo(v, 'instagram'); break;
    case 'publicar-pub': {
      if (!requiereEditor()) return;
      const ok = await publicarAhora(p.id);
      if (ok) setTimeout(() => recargarDatos(), 25000);
      break;
    }

    case 'exportar': exportarJSON(); break;
    case 'importar': importarJSON(); break;
    case 'borrar-local':
      if (confirm('¿Borrar todos los datos? Esta acción no se puede deshacer.')) {
        data = estadoInicial(); guardar(); render(); avisar('Datos borrados.');
      }
      break;
    case 'sincronizar':
      await recargarDatos();
      avisar('Datos actualizados desde GitHub.');
      break;
    case 'probar-publicacion': {
      const ok = await publicarAhora('');
      if (ok) setTimeout(() => recargarDatos(), 25000);
      break;
    }
  }
}

/* ---------- Eventos e inicio ---------- */

function cambiarTab(nombre) {
  tabActiva = nombre;
  document.querySelectorAll('.tab-btn').forEach((x) => x.classList.toggle('activa', x.dataset.tab === nombre));
  document.querySelectorAll('.panel').forEach((x) => x.classList.toggle('activa', x.id === 'panel-' + nombre));
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab-btn');
  if (b) cambiarTab(b.dataset.tab);
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  manejarAccion(b.dataset.act, b.dataset.id);
});

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') cerrarModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

document.getElementById('btnNuevoVeh').onclick = () => abrirFormVehiculo(null);
document.getElementById('btnNuevoLead').onclick = () => abrirFormLead(null);
document.getElementById('btnNuevaPub').onclick = () => abrirFormPublicacion(null, null);
document.getElementById('buscarVeh').addEventListener('input', renderVehiculos);
document.getElementById('filtroEstadoVeh').addEventListener('change', renderVehiculos);
document.getElementById('buscarLead').addEventListener('input', renderLeads);
document.getElementById('filtroEstadoLead').addEventListener('change', renderLeads);
document.getElementById('btnLogin').onclick = () => {
  cambiarTab('config');
  setTimeout(() => document.getElementById('f_token')?.focus(), 60);
};
document.getElementById('btnLogout').onclick = () => {
  if (!confirm('¿Desconectar GitHub? El token se borrará de este navegador.')) return;
  guardarConfig({ token: '' });
  githubActivo = false;
  shaActual = null;
  render();
  avisar('GitHub desconectado. Los datos siguen guardados en este navegador.');
};

(async function init() {
  await iniciarGitHub();
  render();
})();
