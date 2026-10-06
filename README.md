# Universo Gráfico – Cotizador & Cuentas de Cobro 🚀

Aplicación web progresiva (PWA) moderna, rápida e independiente desarrollada específicamente para el negocio de **diseño gráfico y desarrollo web** de **Universo Gráfico**.

Permite generar cotizaciones comerciales y cuentas de cobro con formato legal colombiano, cálculo automático de números a letras, consecutivos independientes por cliente, vista previa en tiempo real idéntica al documento impreso, exportación e impresión a PDF tamaño carta, envío directo por WhatsApp y **sincronización multidispositivo en la nube mediante Cloudflare Pages y Cloudflare D1 (SQLite en el Edge)**.

---

## 📁 Estructura del Proyecto

```text
cotizador universo grafico/
├── index.html                   # Aplicación completa (HTML, CSS y JS puros en un solo archivo)
├── manifest.webmanifest         # Manifiesto PWA para instalación en Android, iOS y PC
├── sw.js                        # Service Worker (Network-First para HTML, caché offline, excluye /api/)
├── schema.sql                   # Esquema SQLite para Cloudflare D1
├── wrangler.toml                # Configuración de despliegue en Cloudflare
├── README.md                    # Esta guía
├── functions/
│   └── api/
│       └── [[route]].js         # API Serverless en Cloudflare Pages Functions con D1
├── assets/
│   ├── logo.png                 # Logotipo oficial de Universo Gráfico
│   └── favicon.svg              # Ícono vectorial de planeta con anillos
└── icons/
    ├── icon-192.png             # Ícono PWA estándar (192x192)
    ├── icon-512.png             # Ícono PWA estándar (512x512)
    └── icon-512-maskable.png     # Ícono PWA adaptable (maskable) para Android
```

---

## ⚡ Cómo Desplegar en Cloudflare (Pages + D1)

Cloudflare te permite alojar la aplicación y la base de datos de manera 100% gratuita y ultrarrápida en su red Edge global.

### Opción A: Despliegue con Git (Recomendado y más fácil)

#### 1. Subir el proyecto a GitHub
Crea un repositorio en tu cuenta de GitHub (ejemplo: `cotizador-universo-grafico`) y sube esta carpeta:
```bash
git init
git add .
git commit -m "Universo Grafico Cotizador con Cloudflare D1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cotizador-universo-grafico.git
git push -u origin main
```

#### 2. Crear la Base de Datos D1 en Cloudflare
1. Entra a tu panel de [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. En el menú lateral izquierdo, ve a **Storage & Databases** > **D1 SQL Database**.
3. Haz clic en **Create database**.
4. Nómbrala: `ug-cotizador-db` y selecciona la región más cercana.
5. Haz clic en tu base de datos recién creada, ve a la pestaña **Console**, copia todo el contenido del archivo [`schema.sql`](file:///c:/Users/Jason/Desktop/cotizador%20universo%20grafico/schema.sql) y haz clic en **Execute**. Esto creará las tablas `usuarios` y `registros` e índices en segundos.

#### 3. Conectar Cloudflare Pages
1. En el menú lateral izquierdo de Cloudflare, ve a **Compute (Workers) & Pages** > **Create application** > pestaña **Pages** > **Connect to Git**.
2. Selecciona tu repositorio `cotizador-universo-grafico`.
3. Configuración de compilación:
   - **Framework preset:** `None`
   - **Build command:** (déjalo vacío)
   - **Build output directory:** `.` (o déjalo en blanco / raíz)
4. Haz clic en **Save and Deploy**.

#### 4. Enlazar la Base de Datos D1 a Cloudflare Pages
1. Una vez desplegado, entra a tu proyecto en Cloudflare Pages.
2. Ve a la pestaña **Settings** > **Functions**.
3. Baja hasta la sección **D1 database bindings** y haz clic en **Add binding**:
   - **Variable name:** `DB` (en mayúsculas, tal como está en el código)
   - **D1 database:** selecciona `ug-cotizador-db`
4. Ve a la pestaña **Deployments**, haz clic en los tres puntos `...` del último despliegue y selecciona **Retry deployment** (o haz un nuevo commit).

¡Listo! Tu app estará funcionando en tu subdominio `.pages.dev` (o con tu dominio propio) con backend serverless y base de datos SQLite distribuida.

---

### Opción B: Despliegue con la Terminal (Wrangler CLI)

Si prefieres usar la terminal con Node.js instalado:

1. Iniciar sesión en Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Crear la base de datos D1:
   ```bash
   npx wrangler d1 create ug-cotizador-db
   ```
   *Copia el `database_id` que te devuelve la terminal y pégalo en [`wrangler.toml`](file:///c:/Users/Jason/Desktop/cotizador%20universo%20grafico/wrangler.toml).*

3. Ejecutar el esquema SQL en la base de datos:
   ```bash
   npx wrangler d1 execute ug-cotizador-db --file=./schema.sql --remote
   ```

4. Desplegar a Cloudflare Pages:
   ```bash
   npx wrangler pages deploy . --project-name=cotizador-universo-grafico
   ```

---

## 🔑 Cómo Conectar y Sincronizar por Primera Vez

1. Abre tu aplicación en el navegador.
2. Ve al panel **Mis datos** o haz clic en el botón de estado en el menú lateral.
3. Haz clic en **Iniciar sesión / Conectar**.
4. Escribe tu correo electrónico y tu contraseña deseada.
5. **Autocreación de cuenta:** La primera vez que ingresas, la API de Cloudflare detecta que la base de datos está inicializándose y **crea automáticamente tu cuenta como administradora** con contraseña cifrada (SHA-256 + salt).
6. A partir de ese momento, cada vez que guardes una cotización, cuenta de cobro o modifiques el catálogo, se sincronizará automáticamente cada 60 segundos y cada vez que abras la app.

---

## 📲 Instalación PWA (PC, Android y iPhone)

- **Computador (Chrome o Edge):** Haz clic en el botón **📲 Instalar** en la barra superior o en el ícono de la barra de direcciones.
- **Android (Chrome):** Toca los tres puntos `⋮` y selecciona **Instalar aplicación** o pulsa el botón **Instalar App** del menú lateral.
- **iPhone (Safari):** Toca el botón Compartir (cuadrado con flecha hacia arriba) y selecciona **Agregar al inicio**.

---

## 🎨 Especificaciones de Marca Universo Gráfico

- **Fondo:** `#070A12` / `#0B0B14`
- **Tarjetas:** `#0F1420` / `#14141F`
- **Degradado Principal:** `linear-gradient(135deg, #EC4899, #8B5CF6)` (Rosa neón a Morado cósmico)
- **Acento Turquesa:** `#2AC5B4`
- **Texto Principal:** `#F1EFEA` / `#F4F4F8`
- **Texto Secundario:** `#8D94A6` / `#A1A1B5`
- **Impresión / PDF:** Fondo blanco profesional con márgenes amplios en tamaño Carta (`@media print`), encabezados de tabla en morado institucional y logotipo en bloque normal sin superposición.
