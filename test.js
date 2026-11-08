// Test rápido de llamadas a Catastro
import { spawn } from 'child_process';

console.log('Probando llamada directa a las APIs de Catastro que usa el MCP...');

const url = 'http://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccoordenadas.asmx/Consulta_CPMRC?Provincia=&Municipio=&RC=8914504TF4781S&SRS=EPSG:4326';

try {
  const res = await fetch(url);
  const xml = await res.text();
  console.log('HTTP Status:', res.status);
  console.log('Contiene coordenadas:', xml.includes('<xcen>'));
  console.log('¡Test de conexión a Catastro exitoso!');
} catch (e) {
  console.error('Error:', e);
}

