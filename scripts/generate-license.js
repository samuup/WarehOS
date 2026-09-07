/**
 * Genera una clave de licencia WarehOS.
 *
 * Uso:
 *   node scripts/generate-license.js <machineHash> <cliente> [dias]
 *
 * - machineHash: el código de máquina que muestra la app en Configuración > Licencia.
 * - cliente: nombre del cliente (aparecerá en Configuración).
 * - dias: vigencia en días. Omítelo o usa 0 para licencia perpetua.
 *
 * La clave se genera firmando el payload con la clave privada en
 * keys/license-private-key.pem. Ese archivo NO debe distribuirse ni
 * incluirse en el instalador.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = path.join(__dirname, '..', 'keys', 'license-private-key.pem');

function fail(message) {
  console.error('Error: ' + message);
  console.error('Uso: node scripts/generate-license.js <machineHash> <cliente> [dias]');
  process.exit(1);
}

const [, , machineHash, customer, daysArg] = process.argv;

if (!machineHash) fail('Falta el código de máquina (machineHash).');
if (!customer) fail('Falta el nombre del cliente.');

let expiresAt = null;
if (daysArg !== undefined) {
  const days = parseInt(daysArg, 10);
  if (Number.isNaN(days) || days <= 0) fail('El parámetro dias debe ser un número entero positivo (o omitirlo para licencia perpetua).');
  expiresAt = new Date(Date.now() + days * 86400000).toISOString();
}

if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  fail('No se encontró la clave privada en keys/license-private-key.pem.');
}

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

const payload = {
  machine: machineHash,
  edition: 'pro',
  customer,
  issuedAt: new Date().toISOString(),
  expiresAt,
};

const payloadJson = JSON.stringify(payload);
const signature = crypto.sign('sha256', Buffer.from(payloadJson, 'utf8'), privateKey);
const licenseKey = Buffer.from(payloadJson, 'utf8').toString('base64') + '.' + signature.toString('base64');

console.log('===== CLAVE DE LICENCIA =====');
console.log(licenseKey);
console.log('=============================');
console.log('Cliente: ' + customer);
console.log('Vigencia: ' + (expiresAt ? 'hasta ' + expiresAt : 'perpetua'));