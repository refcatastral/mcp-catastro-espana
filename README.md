# MCP Catastro España — Servidor Oficial de RefCatastral.es

[![NPM Version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/web-refcatastral.es-2563eb.svg)](https://refcatastral.es)

Servidor oficial **MCP (Model Context Protocol)** desarrollado por [RefCatastral.es](https://refcatastral.es) para conectar asistentes de inteligencia artificial (**Claude Desktop**, **Cursor**, **ChatGPT**, **VS Code**) con los datos abiertos y servicios cartográficos oficiales de la **Dirección General del Catastro (DGC)** y del **Instituto Geográfico Nacional (IGN)** de España.

> ⚡ **Arquitectura 100% Descentralizada:** Este servidor se ejecuta en local en tu equipo y consulta directamente las APIs públicas y abiertas del Ministerio de Hacienda. **No pasa por ningún servidor intermedio ni requiere claves privadas.**

---

## 🚀 Instalación Rápida

### 1. En Claude Desktop

Añade la siguiente configuración a tu archivo `claude_desktop_config.json`:

* **En macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
* **En Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "catastro-espana": {
      "command": "npx",
      "args": ["-y", "mcp-catastro-espana"]
    }
  }
}
```

### 2. En Cursor / Windsurf

En la configuración de MCP de Cursor (`Settings > Features > MCP > Add New MCP Server`):

* **Name:** `catastro-espana`
* **Type:** `command`
* **Command:** `npx -y mcp-catastro-espana`

---

## 🛠️ Herramientas Incluidas

El servidor dota a tu IA de 3 herramientas nativas especializadas:

### 1. `consultar_referencia_catastral`
Consulta los datos físicos y la localización oficial de cualquier inmueble en España a partir de su Referencia Catastral (de 14 o 20 caracteres).
* **Parámetros:** `referencia` (ej: `"8914504TF4781S0007SG"` o `"32059A00500344"`).
* **Devuelve:**
  * Dirección postal normalizada completa.
  * Coordenadas geográficas WGS84 (Latitud / Longitud).
  * Tipo de bien (Urbano o Rústico).
  * Uso principal registrado (Residencial, Comercial, Almacén...).
  * Superficie construida en m² y año de construcción.
  * Enlace directo al [Comparador de Ortofotos Históricas de RefCatastral](https://refcatastral.es/comparador-ortofotos/).
  * Enlace para descargar el croquis y la ficha técnica oficial en PDF.

### 2. `coordenadas_a_referencia_catastral`
Geocodificación inversa catastral: localiza la Referencia Catastral oficial y la dirección que corresponde a unas coordenadas GPS.
* **Parámetros:** `latitud` (ej: `36.753905`), `longitud` (ej: `-5.813374`).
* **Devuelve:** Referencia de parcela y dirección registrada en Catastro.

### 3. `obtener_servicios_wms_cartografia`
Proporciona las URLs oficiales de los servicios WMS e INSPIRE de la DGC y PNOA listas para configurar en proyectos de QGIS, Leaflet, OpenLayers o MapLibre.

---

## 💡 Ejemplos de Prompts para la IA

Una vez instalado, puedes pedirle a tu asistente:

* *"¿A qué dirección y superficie corresponde la referencia catastral 8914504TF4781S0007SG?"*
* *"Tengo las coordenadas 40.416775, -3.703790 en Madrid. ¿Cuál es su referencia catastral según el Catastro?"*
* *"Dame la URL de la capa WMS del Catastro de España para añadirla a mi mapa Leaflet."*

---

## 🌐 Enlaces y Recursos

* 🏠 **Portal Principal:** [RefCatastral.es](https://refcatastral.es)
* 🛰️ **Comparador de Ortofotos Aéreas (1973 - Actualidad):** [RefCatastral Ortofotos](https://refcatastral.es/comparador-ortofotos/)
* 📐 **Visor de Parcelas y Linderos:** [Visor Catastro RefCatastral](https://refcatastral.es/visor-catastro/)
* ⚖️ **Sede Oficial:** [Dirección General del Catastro (Ministerio de Hacienda)](https://www.catastro.meh.es/)

---

## 📄 Licencia

Licencia MIT © [RefCatastral.es](https://refcatastral.es). Libre para uso personal, profesional y comercial.

