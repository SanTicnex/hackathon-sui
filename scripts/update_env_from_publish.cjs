#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const repoRoot = path.resolve(scriptDir, '..');
const publishPath = path.join(repoRoot, 'frontend', 'move', 'counter', 'publish-testnet.json');
const envPath = path.join(repoRoot, '.env');
const envExamplePath = path.join(repoRoot, '.env.example');

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo ${filePath}. Ejecuta el script de deploy primero.`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function extractPackageId(data) {
  const publishedChange = (data.objectChanges || []).find((change) => change.type === 'published');
  if (publishedChange?.packageId) {
    return publishedChange.packageId;
  }
  throw new Error('No pude encontrar packageId en publish-testnet.json.');
}

function extractSigner(data) {
  return (
    data.effects?.sender ||
    data.certificate?.data?.sender ||
    data.transaction?.data?.sender ||
    data.effects?.gasObject?.owner?.AddressOwner ||
    data.effects?.gasObject?.owner?.SingleOwner ||
    null
  );
}

function ensureEnvFile() {
  if (fs.existsSync(envPath)) {
    return;
  }
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('Copié .env.example a .env porque no existía.');
    return;
  }
  fs.writeFileSync(envPath, '# Archivo .env generado automáticamente\n', 'utf8');
  console.log('Creé un .env vacío porque no existía plantilla.');
}

function upsertEnvEntry(lines, key, value) {
  const target = `${key}=${value}`;
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = target;
  } else {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(target);
  }
}

function ensureMnemonicComment(lines) {
  const todoLine = '# TODO: rellenar BACKEND_MNEMONIC';
  if (!lines.some((line) => line.trim() === todoLine)) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(todoLine);
  }
}

function writeEnvFile(updates) {
  ensureEnvFile();
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  Object.entries(updates).forEach(([key, value]) => {
    upsertEnvEntry(lines, key, value);
  });
  ensureMnemonicComment(lines);
  const contents = lines.join('\n').replace(/\n*$/, '\n');
  fs.writeFileSync(envPath, contents, 'utf8');
}

function main() {
  const publishData = readJsonFile(publishPath);
  const packageId = extractPackageId(publishData);
  const signer = extractSigner(publishData);
  if (!signer) {
    throw new Error('No pude determinar AUTHORITY_ADDRESS del JSON de publish.');
  }

  writeEnvFile({
    SUI_NETWORK: 'testnet',
    COUNTER_PACKAGE_ID: packageId,
    EUID_PACKAGE_ID: packageId,
    AUTHORITY_ADDRESS: signer,
  });

  console.log('.env actualizado con Sui testnet, packageId y authority address.');
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
