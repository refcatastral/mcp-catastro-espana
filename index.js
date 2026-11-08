#!/usr/bin/env node

/**
 * mcp-catastro-espana — Servidor MCP Oficial de RefCatastral.es
 * 
 * Permite a modelos de IA (Claude, Cursor, ChatGPT, etc.) consultar datos
 * catastrales, coordenadas, linderos y cartografía oficial de España conectándose
 * directamente con los servicios web abiertos de la Dirección General del Catastro
 * (DGC) y del IGN (PNOA).
 * 
 * 0% carga en servidores propios · 100% descentralizado en el cliente.
 * 
 * Desarrollado por RefCatastral.es (https://refcatastral.es)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Helpers para parsear XML ligero de Catastro ──────────────────────────────
function getXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

function getAllXmlTags(xml, tag) {
  const results = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function cleanRc(rc) {
  return (rc || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

// ── API Catastro Oficial: Coordenadas por Referencia Catastral ───────────────
async function fetchCoordsByRc(rc) {
  const rc14 = rc.substring(0, 14);
  const url = `http://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccoordenadas.asmx/Consulta_CPMRC?Provincia=&Municipio=&RC=${encodeURIComponent(rc14)}&SRS=EPSG:4326`;
  
  const res = await fetch(url, { headers: { "User-Agent": "RefCatastral-MCP/1.0" } });
  if (!res.ok) throw new Error(`Error HTTP Catastro: ${res.status}`);
  const xml = await res.text();

  const err = getXmlTag(xml, "des");
  if (err && xml.includes("<err>")) {
    return { error: err };
  }

  const lon = parseFloat(getXmlTag(xml, "xcen") || "0");
  const lat = parseFloat(getXmlTag(xml, "ycen") || "0");
  const direccion = getXmlTag(xml, "ldt") || "Dirección no disponible";

  return { lat, lon, direccion, rc: rc14 };
}

// ── API Catastro Oficial: Coordenadas GPS a Referencia Catastral (Inversa) ───
async function fetchRcByCoords(lat, lon) {
  const url = `http://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccoordenadas.asmx/Consulta_RCCOOR?Coordenada_X=${encodeURIComponent(lon)}&Coordenada_Y=${encodeURIComponent(lat)}&SRS=EPSG:4326`;
  
  const res = await fetch(url, { headers: { "User-Agent": "RefCatastral-MCP/1.0" } });
  if (!res.ok) throw new Error(`Error HTTP Catastro: ${res.status}`);
  const xml = await res.text();

  const err = getXmlTag(xml, "des");
  if (err && xml.includes("<err>")) {
    return { error: err };
  }

  const pc1 = getXmlTag(xml, "pc1") || "";
  const pc2 = getXmlTag(xml, "pc2") || "";
  const rc = (pc1 + pc2).trim();
  const direccion = getXmlTag(xml, "ldt") || "";

  return { rc, lat, lon, direccion };
}

// ── API Catastro Oficial: Datos descriptivos y físicos ───────────────────────
async function fetchDatosCatastro(rc) {
  const url = `http://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${encodeURIComponent(rc)}`;
  
  const res = await fetch(url, { headers: { "User-Agent": "RefCatastral-MCP/1.0" } });
  if (!res.ok) throw new Error(`Error HTTP Catastro: ${res.status}`);
  const xml = await res.text();

  const err = getXmlTag(xml, "des");
  if (err && xml.includes("<err>")) {
    return { error: err };
  }

  const tipoBien = getXmlTag(xml, "cn") === "UR" ? "Urbano" : (getXmlTag(xml, "cn") === "RU" ? "Rústico" : "Inmueble Especial");
  const provincia = getXmlTag(xml, "np") || "";
  const municipio = getXmlTag(xml, "nm") || "";
  const calle = getXmlTag(xml, "nv") || "";
  const num = getXmlTag(xml, "pnp") || "";
  const cp = getXmlTag(xml, "dp") || "";
  const uso = getXmlTag(xml, "luso") || "Residencial / No especificado";
  const supConstruida = getXmlTag(xml, "sfc") || null;
  const anioConstruccion = getXmlTag(xml, "ant") || null;

  return {
    rc,
    tipoBien,
    provincia,
    municipio,
    direccionCompleta: `${calle} ${num}`.trim(),
    codigoPostal: cp,
    usoPrincipal: uso,
    superficieM2: supConstruida,
    anioConstruccion
  };
}

// ── Servidor MCP ─────────────────────────────────────────────────────────────
const server = new Server(
  {
    name: "mcp-catastro-espana",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Lista de Herramientas Disponibles ─────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "consultar_referencia_catastral",
        description:
          "Consulta la información oficial física y geográfica de un inmueble o parcela en España a partir de su Referencia Catastral (14 o 20 caracteres). Devuelve dirección exacta, coordenadas WGS84, superficie en m², año de construcción, uso principal y enlaces directos al visor cartográfico de RefCatastral.es.",
        inputSchema: {
          type: "object",
          properties: {
            referencia: {
              type: "string",
              description:
                "Referencia Catastral de 14 caracteres (finca/parcela) o 20 caracteres (inmueble exacto con cargo y control). Ejemplo: '8914504TF4781S0007SG' o '32059A00500344'.",
            },
          },
          required: ["referencia"],
        },
      },
      {
        name: "coordenadas_a_referencia_catastral",
        description:
          "Geocodificación inversa catastral: localiza la Referencia Catastral y la dirección oficial correspondiente a unas coordenadas GPS (latitud y longitud WGS84) en cualquier punto de España.",
        inputSchema: {
          type: "object",
          properties: {
            latitud: {
              type: "number",
              description: "Latitud en formato decimal WGS84 (ej: 36.753905 o 40.416775).",
            },
            longitud: {
              type: "number",
              description: "Longitud en formato decimal WGS84 (ej: -5.813374 o -3.703790).",
            },
          },
          required: ["latitud", "longitud"],
        },
      },
      {
        name: "obtener_servicios_wms_cartografia",
        description:
          "Devuelve las especificaciones, URLs de endpoints WMS y capas oficiales de la Dirección General del Catastro (DGC) y del PNOA (IGN) para integrar mapas catastrales, parcelas, linderos y ortofotos aéreas en proyectos GIS, Leaflet, QGIS o aplicaciones web.",
        inputSchema: {
          type: "object",
          properties: {
            servicio: {
              type: "string",
              enum: ["todos", "catastro_wms", "pnoa_ortofoto", "edificios_inspire"],
              description: "Tipo de servicio cartográfico a consultar. Por defecto 'todos'.",
            },
          },
        },
      },
    ],
  };
});

// ── Ejecutor de Herramientas ──────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "consultar_referencia_catastral") {
      const rc = cleanRc(args.referencia);
      if (!rc || rc.length < 14) {
        return {
          content: [{ type: "text", text: "❌ Error: La referencia catastral debe tener al menos 14 caracteres alfanuméricos." }],
        };
      }

      const [coords, datos] = await Promise.all([
        fetchCoordsByRc(rc).catch(e => ({ error: e.message })),
        fetchDatosCatastro(rc).catch(e => ({ error: e.message })),
      ]);

      if (coords.error && datos.error) {
        return {
          content: [{ type: "text", text: `❌ No se encontró el inmueble en el Catastro Oficial. Motivo: ${coords.error || datos.error}` }],
        };
      }

      const lat = coords.lat || null;
      const lon = coords.lon || null;
      const dir = datos.direccionCompleta || coords.direccion || "No disponible";
      const mun = datos.municipio || "";
      const prov = datos.provincia || "";
      const uso = datos.usoPrincipal || "No especificado";
      const sup = datos.superficieM2 ? `${datos.superficieM2} m²` : "No desglosada";
      const anio = datos.anioConstruccion || "No disponible";
      const tipo = datos.tipoBien || "Inmueble";

      let responseText = `### 🏛️ Datos Catastrales Oficiales: ${rc}\n\n`;
      responseText += `* **Dirección:** ${dir} ${mun ? `(${mun}, ${prov})` : ""}\n`;
      if (datos.codigoPostal) responseText += `* **Código Postal:** ${datos.codigoPostal}\n`;
      responseText += `* **Tipo de Inmueble:** ${tipo}\n`;
      responseText += `* **Uso Principal:** ${uso}\n`;
      responseText += `* **Superficie Construida:** ${sup}\n`;
      responseText += `* **Año de Construcción:** ${anio}\n`;

      if (lat && lon) {
        responseText += `* **Coordenadas GPS (WGS84):** Lat ${lat.toFixed(6)}, Lon ${lon.toFixed(6)}\n`;
        responseText += `\n#### 🗺️ Herramientas de Cartografía y Visor Directo:\n`;
        responseText += `* 🛰️ **[Ver en Comparador de Ortofotos Históricas IGN](https://refcatastral.es/comparador-ortofotos/?ref=${rc}&lat=${lat}&lng=${lon}&z=18)**\n`;
        responseText += `* 📐 **[Ver Mapa Catastral de Parcelas y Linderos](https://refcatastral.es/visor-catastro/?ref=${rc}&lat=${lat}&lon=${lon}&z=18)**\n`;
      }

      responseText += `* 📄 **[Descargar Ficha y Croquis Oficial (PDF)](https://www1.sedecatastro.gob.es/CYCBienInmueble/SECImprimirCroquisYDatos.aspx?refcat=${rc})**\n\n`;
      responseText += `---\n*Fuente: Datos abiertos en tiempo real de la Dirección General del Catastro (Ministerio de Hacienda). Generado mediante el servidor MCP oficial de [RefCatastral.es](https://refcatastral.es).*`;

      return {
        content: [{ type: "text", text: responseText }],
      };
    }

    if (name === "coordenadas_a_referencia_catastral") {
      const lat = parseFloat(args.latitud);
      const lon = parseFloat(args.longitud);

      if (isNaN(lat) || isNaN(lon)) {
        return {
          content: [{ type: "text", text: "❌ Error: Debe proporcionar una latitud y longitud numéricas válidas." }],
        };
      }

      const res = await fetchRcByCoords(lat, lon);
      if (res.error) {
        return {
          content: [{ type: "text", text: `❌ Catastro no localizó ninguna parcela en esas coordenadas (${lat}, ${lon}). Motivo: ${res.error}` }],
        };
      }

      let responseText = `### 📍 Parcela Localizada por Coordenadas GPS\n\n`;
      responseText += `* **Coordenadas de Consulta:** Lat ${lat.toFixed(6)}, Lon ${lon.toFixed(6)}\n`;
      responseText += `* **Referencia Catastral (Parcela):** \`${res.rc}\`\n`;
      responseText += `* **Dirección Registrada:** ${res.direccion}\n\n`;
      responseText += `#### 🗺️ Explorar Parcela en RefCatastral:\n`;
      responseText += `* 🛰️ **[Abrir en Comparador de Ortofotos Aéreas](https://refcatastral.es/comparador-ortofotos/?ref=${res.rc}&lat=${lat}&lng=${lon}&z=18)**\n`;
      responseText += `* 📐 **[Consultar Linderos en Visor Catastro](https://refcatastral.es/visor-catastro/?ref=${res.rc}&lat=${lat}&lon=${lon}&z=18)**\n\n`;
      responseText += `---\n*Fuente: Servicio OVC Coordenadas de la Dirección General del Catastro. Distribuido por [RefCatastral.es](https://refcatastral.es).*`;

      return {
        content: [{ type: "text", text: responseText }],
      };
    }

    if (name === "obtener_servicios_wms_cartografia") {
      let responseText = `### 🗺️ Servicios Web de Mapas (WMS / INSPIRE) de Catastro y PNOA\n\n`;
      responseText += `Configuración lista para usar en QGIS, ArcGIS, Leaflet o OpenLayers:\n\n`;
      responseText += `#### 1. Cartografía Catastral Oficial (DGC)\n`;
      responseText += `* **URL Base WMS:** \`https://ovc.catastro.meh.es/Cartografia/WMS/BuscarFirmas.aspx\`\n`;
      responseText += `* **Capas principales:** \`Catastro\` (Global), \`PARCELA\` (Linderos y códigos), \`MASA\` (Manzanas y rústica).\n`;
      responseText += `* **Versión WMS:** 1.1.1 o 1.3.0 | **Sistemas de coordenadas:** EPSG:4326, EPSG:25830, EPSG:3857.\n\n`;

      responseText += `#### 2. Ortofotografía Aérea PNOA (IGN)\n`;
      responseText += `* **URL Base WMS:** \`https://www.ign.es/wms-inspire/pnoa-ma\`\n`;
      responseText += `* **Capa:** \`OI.OrthoimageCoverage\` (Máxima actualidad y resolución del territorio español).\n\n`;

      responseText += `#### 3. Edificios y Volúmenes 3D (INSPIRE DGC)\n`;
      responseText += `* **URL WMS:** \`http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx\`\n`;
      responseText += `* **URL WFS (Vectorial GML):** \`http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx\`\n\n`;

      responseText += `💡 *Puedes probar la combinación de estas capas interactivas sin necesidad de software GIS en:* [RefCatastral.es Comparador de Ortofotas](https://refcatastral.es/comparador-ortofotos/).`;

      return {
        content: [{ type: "text", text: responseText }],
      };
    }

    return {
      content: [{ type: "text", text: `Herramienta desconocida: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Error al ejecutar ${name}: ${error.message}` }],
      isError: true,
    };
  }
});

// ── Arranque del Servidor en Stdio ───────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RefCatastral MCP Server corriendo en stdio");
}

main().catch((err) => {
  console.error("Error fatal iniciando MCP Server:", err);
  process.exit(1);
});

