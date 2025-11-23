#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const repoRoot = path.resolve(scriptDir, '..');
const rootEnvPath = path.join(repoRoot, '.env');
const backendDir = path.join(repoRoot, 'backend-identity');
const backendEnvPath = path.join(backendDir, '.env');
const backendEnvExamplePath = path.join(backendDir, '.env.example');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { lines: [], map: {} };
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const map = {};
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      return;
    }
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1);
    map[key] = value;
  });
  return { lines, map };
}

function upsertEnvLine(lines, key, value) {
  const desired = `${key}=${value}`;
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = desired;
  } else {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(desired);
  }
}

function ensureMnemonicNote(lines) {
  const comment = '# poner aquí la mnemonic real en local';
  const mnemonicIndex = lines.findIndex((line) => line.trim().startsWith('BACKEND_MNEMONIC='));
  if (mnemonicIndex >= 0) {
    const nextLine = lines[mnemonicIndex + 1];
    if (nextLine?.trim() !== comment) {
      lines.splice(mnemonicIndex + 1, 0, comment);
    }
    return;
  }
  if (!lines.some((line) => line.trim() === comment)) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(comment);
  }
}

function ensureBackendEnvFile() {
  if (fs.existsSync(backendEnvPath)) {
    return;
  }
  if (!fs.existsSync(backendEnvExamplePath)) {
    throw new Error('backend-identity/.env.example no existe. No puedo crear backend-identity/.env.');
  }
  fs.copyFileSync(backendEnvExamplePath, backendEnvPath);
  console.log('Copié backend-identity/.env.example a backend-identity/.env.');
}

function main() {
  if (!fs.existsSync(rootEnvPath)) {
    throw new Error('No existe .env en la raíz. Ejecuta primero node scripts/update_env_from_publish.js');
  }

  const rootEnv = parseEnvFile(rootEnvPath).map;
  const packageId = rootEnv.EUID_PACKAGE_ID || rootEnv.COUNTER_PACKAGE_ID;
  const authority = rootEnv.AUTHORITY_ADDRESS;
  const network = rootEnv.SUI_NETWORK || 'testnet';

  if (!packageId || !authority) {
    throw new Error('Faltan EUID_PACKAGE_ID o AUTHORITY_ADDRESS en la raíz. Corre de nuevo update_env_from_publish.js.');
  }

  ensureBackendEnvFile();
  const backendEnv = parseEnvFile(backendEnvPath);
  upsertEnvLine(backendEnv.lines, 'SUI_NETWORK', network);
  upsertEnvLine(backendEnv.lines, 'EUID_PACKAGE_ID', packageId);
  upsertEnvLine(backendEnv.lines, 'AUTHORITY_ADDRESS', authority);
  ensureMnemonicNote(backendEnv.lines);
  const contents = backendEnv.lines.join('\n').replace(/\n*$/, '\n');
  fs.writeFileSync(backendEnvPath, contents, 'utf8');

  console.log('backend-identity/.env actualizado con la configuración de testnet.');
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
