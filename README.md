# CRM Vehículos (GitHub Pages + GitHub Actions)

App para vender vehículos: **inventario + CRM de leads + calendario de publicaciones** en Facebook e Instagram.

Es una SPA sin framework ni build (HTML + CSS + JS). Funciona primero en **modo local** y, al conectar GitHub, sincroniza los datos en `datos/crm.json` y habilita la publicación automática mediante **GitHub Actions** + Graph API de Meta.

> Proyecto nuevo e independiente: no modifica la app del club (`cdl-contabilidad`).

## Estructura

```
index.html                  Interfaz (pestañas, modales, ficha pública)
css/styles.css              Estilos
js/github-config.js         owner / repo / rama del repositorio (sin secretos)
js/store.js                 localStorage + sincronización con GitHub API
js/publish.js               Caption, hashtags, compartir y disparar el workflow
js/app.js                   Render, formularios y acciones
scripts/publicar.js         Publica en Meta leyendo datos/crm.json
.github/workflows/publicar.yml  Workflow programado + manual
datos/crm.json              Vehículos y publicaciones (los leads NO se suben)
iniciar.bat                 Arranque local en Windows
```

---

## 1) Probar en local (sin cuentas)

1. Doble clic en `iniciar.bat`.
2. Abre `http://localhost:8000`.
3. Agrega un vehículo, un lead y una publicación de prueba.
4. Los botones **FB**, **IG** y **WA** comparten manualmente sin permisos de Meta.
5. En **Configuración → Exportar respaldo JSON** guardas una copia.

---

## 2) Publicar la app en GitHub Pages

1. Crea un repositorio en GitHub. En el **plan gratuito debe ser público** (GitHub Pages no funciona con repos privados en cuenta personal gratuita). El sitio publicado es accesible por quien tenga el enlace.
2. Sube **toda esta carpeta** al repositorio, incluidas las carpetas ocultas `.github` y `datos`.
   - Si usas GitHub web: *Add file → Upload files* y arrastra la carpeta completa.
3. En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → rama `main`, carpeta `/ (root)` → Save**.
4. Tu app quedará en `https://TU-USUARIO.github.io/TU-REPO/`.

> La carpeta `.github` está oculta: asegúrate de subirla, porque ahí vive el workflow.
>
> **Privacidad:** al repo público solo se suben `vehiculos` y `publicaciones` (datos de venta, públicos por naturaleza). Los **leads y sus notas se guardan únicamente en el navegador** y nunca se escriben en `datos/crm.json`. Si borras los datos del navegador, perderás los leads; usa *Exportar respaldo JSON* para guardarlos.

---

## 3) Conectar la app con GitHub

La app necesita un token para leer/escribir `datos/crm.json`. Se guarda **solo en tu navegador**, nunca en el código.

1. GitHub → tu avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Configura:
   - **Token name**: `CRM Vehículos`
   - **Expiration**: 90 días (o la que prefieras)
   - **Repository access**: *Only select repositories* → elige tu repo
   - **Permissions → Repository permissions**: `Contents: Read and write` y `Actions: Read and write`
3. Copia el token (`github_pat_...`).
4. En la app → **Configuración → Conexión con GitHub**:
   - Usuario u organización: tu usuario de GitHub
   - Nombre del repositorio: el nombre del repo
   - Rama: `main`
   - Ruta del JSON: `datos/crm.json`
   - Token: pega el `github_pat_...`
   - **Guardar conexión**
5. El badge arriba debe decir **GitHub · sincronizado**.

Desde entonces, cada cambio que hagas se guarda en `datos/crm.json` del repo (en la pestaña **Publicaciones** hay un botón *Sincronizar ahora* por si otro dispositivo cambió algo).

---

## 4) Credenciales de Meta (en GitHub Secrets)

GitHub aloja la app y ejecuta la publicación, pero **Meta da el permiso**. Necesitas:

1. **Página de Facebook** + cuenta de **Instagram Business** vinculadas (Business Suite).
2. App en https://developers.facebook.com/apps → crear app tipo **Business**.
3. Permisos en el *Graph API Explorer*: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
4. Token de larga duración de la Página, ID de la Página e ID de Instagram (`GET /{page-id}?fields=instagram_business_account`).

Luego, en tu repo: **Settings → Secrets and variables → Actions → New repository secret**, crea estos tres:

| Nombre | Valor |
|---|---|
| `META_PAGE_ACCESS_TOKEN` | Token de larga duración de la Página |
| `META_PAGE_ID` | ID de la Página de Facebook |
| `META_IG_USER_ID` | ID de la cuenta Instagram Business |

Los secretos nunca aparecen en el código ni en el navegador.

---

## 5) Publicar

1. Edita un vehículo y pon al menos **una foto con URL pública `https://...`**. La Graph API no acepta fotos locales ni base64. Puedes usar tu propio hosting, Firebase Storage o cualquier CDN.
2. **Publicaciones → + Programar publicación** → elige vehículo, redes, fecha y hora → **Guardar**.
3. Dos formas de enviar:
   - **Publicar ahora** en esa publicación: dispara el workflow por `workflow_dispatch` y publica solo esa.
   - Esperar a la hora programada: el workflow `schedule` corre cada 10 minutos (hora UTC) y publica las que estén pendientes y vencidas.
4. En ~1 minuto la app actualiza el estado a **publicado** (o guarda el error en **error**).
5. Puedes probar toda la cola con **Configuración → Probar publicación**.

Para ver el progreso: pestaña **Actions** del repo → *Publicar vehículos en Meta*.

---

## Ficha pública y botones manuales

- **Ver ficha** abre `?v=<id>`: página de solo lectura con precio, fotos y WhatsApp.
- **FB** usa elFacebook Sharer con esa URL pública.
- **IG** copia el texto + enlace y abre Instagram (IG no permite compartir texto por intent).
- **WA** abre WhatsApp con el texto y el enlace.

## Seguridad y límites

- El token de GitHub se guarda en `localStorage` del navegador; **no lo subas al repo**. Si usas un equipo compartido, desconéctate desde el botón **Desconectar**.
- Usa un repo **privado** si no quieres que se vea el historial de datos.
- Los fine-grained tokens vencen; cuando pase, genera uno nuevo y actualízalo en la app.
- GitHub Actions tiene una cuota gratuita de minutos; una publicación cada 10 min consume muy poco.
- Los textos se escapan con `esc()` antes de insertarse en el DOM.
- Instagram publica **imágenes** por ahora; videos/carruseles requerirían ampliar `scripts/publicar.js`.
- Las respuestas a comentarios/DMs (webhooks de Meta) no están incluidas.
- En Windows, si `python` no arranca el servidor, instala Python o ejecuta `py -m http.server 8000`.
