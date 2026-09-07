import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { get, run, persist } from './database';
import { computeTrialStatus, DEFAULT_TRIAL_DAYS, MS_PER_DAY } from '../shared/trialLogic';
import type { LicenseStatus } from '../shared/types';

const TRIAL_DAYS = DEFAULT_TRIAL_DAYS;

// 48 h de tolerancia: cubre cambios de horario (DST) y batería CMOS agotada,
// sin permitir retrocesos explotables.
const ROLLBACK_TOLERANCE_MS = 2 * MS_PER_DAY;

const TRIAL_SALT = 'warehos-trial-v1';
const TRIAL_FILE = 'trial.json';

const PUBLIC_KEY_PEM = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAx/P2kbrZ2E65JHQTZKrfxxmBHtTMu9BAhdp9OlhSTcjdDnnutPti
sSY/h6OvgcwJPv6Lo/AalSYWJzzcCw+4HzAYObgNEBygRC7SGdHWd2UCiEPBHHzW
qACzhvdHV8+2HZ8DkVLZ2Tdjm6caruUkgtAlcluFYmzdpMVOcRla/oA/T8w9D7r6
IckLpI1Uu1QSz1lLgFsOSNqpeTDeHbWaaKzpjujY0LLz6gy0fl9pcp4ndbzli6Ip
WMOUcciZdxjnJKwTyFgwIRL6XwBI2sF/aNlEAX85vVg30KSvl+dzRGLNRpPw2icW
/T7+AMG3nujXhjOc50095wcjzdeUu0sh4wIDAQAB
-----END RSA PUBLIC KEY-----`;

export interface LicensePayload {
  machine: string;
  edition: 'pro';
  customer: string;
  issuedAt: string;
  expiresAt: string | null;
}

interface VerifiedLicense {
  ok: boolean;
  reason?: string;
  payload?: LicensePayload;
}

export interface TrialState {
  firstRunMs: number | null;
  maxClockMs: number | null;
  tampered: boolean;
}

function trialChecksum(state: Pick<TrialState, 'firstRunMs' | 'maxClockMs' | 'tampered'>): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        firstRunMs: state.firstRunMs,
        maxClockMs: state.maxClockMs,
        tampered: state.tampered,
      }) +
        ':' +
        TRIAL_SALT,
    )
    .digest('hex');
}

function trialFilePath(): string {
  return path.join(app.getPath('userData'), TRIAL_FILE);
}

function toMs(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readDbState(): TrialState {
  const firstRun = get<{ value: string }>("SELECT value FROM app_state WHERE key = 'first_run'");
  const maxClock = get<{ value: string }>("SELECT value FROM app_state WHERE key = 'max_clock'");
  const tampered = get<{ value: string }>("SELECT value FROM app_state WHERE key = 'trial_tampered'");
  return {
    firstRunMs: toMs(firstRun?.value),
    maxClockMs: toMs(maxClock?.value),
    tampered: tampered?.value === '1',
  };
}

function readFileState(): TrialState {
  const empty: TrialState = { firstRunMs: null, maxClockMs: null, tampered: false };
  try {
    const filePath = trialFilePath();
    if (!fs.existsSync(filePath)) return empty;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TrialState & {
      checksum?: string;
    };
    if (
      typeof parsed.firstRunMs !== 'number' ||
      typeof parsed.maxClockMs !== 'number' ||
      typeof parsed.tampered !== 'boolean'
    ) {
      return empty;
    }
    const checksumOk = parsed.checksum === trialChecksum(parsed);
    return {
      firstRunMs: parsed.firstRunMs,
      maxClockMs: parsed.maxClockMs,
      tampered: parsed.tampered || !checksumOk,
    };
  } catch {
    return empty;
  }
}

function writeFileState(state: TrialState): void {
  const data = {
    firstRunMs: state.firstRunMs,
    maxClockMs: state.maxClockMs,
    tampered: state.tampered,
    checksum: trialChecksum(state),
  };
  const filePath = trialFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

function writeDbState(state: TrialState): void {
  const upsert = (key: string, value: string | null) => {
    if (value === null) return;
    run(
      "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  };
  upsert('first_run', state.firstRunMs != null ? String(state.firstRunMs) : null);
  upsert('max_clock', state.maxClockMs != null ? String(state.maxClockMs) : null);
  if (state.tampered) upsert('trial_tampered', '1');
  persist();
}

function mergeStates(a: TrialState, b: TrialState): TrialState {
  const firstRunCandidates = [a.firstRunMs, b.firstRunMs].filter((v): v is number => v != null);
  const maxClockCandidates = [a.maxClockMs, b.maxClockMs].filter((v): v is number => v != null);
  return {
    firstRunMs: firstRunCandidates.length ? Math.min(...firstRunCandidates) : null,
    maxClockMs: maxClockCandidates.length ? Math.max(...maxClockCandidates) : null,
    tampered: a.tampered || b.tampered,
  };
}

/**
 * Reúne el estado del trial desde la DB y el archivo espejo, aplica la marca de
 * agua (el tiempo "efectivo" nunca retrocede) y repara/actualiza ambas fuentes.
 */
function consolidateTrialState(): TrialState {
  const dbState = readDbState();
  const fileState = readFileState();
  const merged = mergeStates(dbState, fileState);

  const now = Date.now();
  if (merged.firstRunMs == null) {
    merged.firstRunMs = now;
    merged.maxClockMs = merged.maxClockMs ?? now;
  }
  if (merged.maxClockMs == null) {
    merged.maxClockMs = now;
  }
  if (now < merged.maxClockMs - ROLLBACK_TOLERANCE_MS) {
    merged.tampered = true;
  }
  if (now > merged.maxClockMs) {
    merged.maxClockMs = now;
  }

  const changed =
    (dbState.firstRunMs ?? -1) !== merged.firstRunMs ||
    (dbState.maxClockMs ?? -1) !== merged.maxClockMs ||
    dbState.tampered !== merged.tampered ||
    (fileState.firstRunMs ?? -1) !== merged.firstRunMs ||
    (fileState.maxClockMs ?? -1) !== merged.maxClockMs ||
    fileState.tampered !== merged.tampered;

  if (changed) {
    writeDbState(merged);
    writeFileState(merged);
  }

  return merged;
}

export function refreshTrialWatermark(): void {
  consolidateTrialState();
}

function machineSeed(): string {
  const ifaces = os.networkInterfaces();
  let mac = '';
  for (const name of Object.keys(ifaces)) {
    const list = ifaces[name] ?? [];
    const item = list.find((i) => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00');
    if (item) {
      mac = item.mac;
      break;
    }
  }
  return [os.hostname(), os.platform(), os.release(), mac].join('|');
}

export function getMachineHash(): string {
  return crypto.createHash('sha256').update(machineSeed()).digest('hex');
}

export function verifyLicenseKey(key: string): VerifiedLicense {
  const cleaned = key.trim();
  const dot = cleaned.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'Formato de clave inválido' };

  const payloadB64 = cleaned.slice(0, dot);
  const sigB64 = cleaned.slice(dot + 1);

  let payloadJson: string;
  try {
    payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
  } catch {
    return { ok: false, reason: 'Clave corrupta' };
  }

  let payload: LicensePayload;
  try {
    payload = JSON.parse(payloadJson) as LicensePayload;
  } catch {
    return { ok: false, reason: 'Clave corrupta' };
  }

  const publicKey = crypto.createPublicKey(PUBLIC_KEY_PEM);
  let signature: Buffer;
  try {
    signature = Buffer.from(sigB64, 'base64');
  } catch {
    return { ok: false, reason: 'Clave corrupta' };
  }

  const valid = crypto.verify('sha256', Buffer.from(payloadJson, 'utf8'), publicKey, signature);
  if (!valid) return { ok: false, reason: 'La clave de licencia no es válida (firma incorrecta)' };

  if (payload.machine !== getMachineHash()) {
    return { ok: false, reason: 'Esta clave no corresponde a esta máquina' };
  }

  if (payload.expiresAt) {
    const exp = new Date(payload.expiresAt).getTime();
    if (Number.isNaN(exp)) return { ok: false, reason: 'Clave con vigencia inválida' };
    if (exp < Date.now()) return { ok: false, reason: 'La licencia ha expirado' };
  }

  return { ok: true, payload };
}

export function getLicenseStatus(): LicenseStatus {
  // Seam de E2E: permite probar los flujos Pro (importación, exportaciones,
  // backup) sin una clave firmada real. Solo activo si la variable está definida.
  if (process.env.WAREHOS_FORCE_PRO === '1') {
    return {
      edition: 'pro',
      trialDays: TRIAL_DAYS,
      trialDaysLeft: TRIAL_DAYS,
      activated: true,
      machineHash: getMachineHash(),
      customer: 'E2E',
      expiresAt: null,
      tampered: false,
    };
  }
  const machineHash = getMachineHash();
  const trial = consolidateTrialState();
  const nowMs = trial.maxClockMs ?? Date.now();
  const { trialDaysLeft, expired } = computeTrialStatus({
    firstRunMs: trial.firstRunMs ?? nowMs,
    nowMs,
    trialDays: TRIAL_DAYS,
  });

  const stored = get<{ value: string }>("SELECT value FROM app_state WHERE key = 'license'");
  if (stored) {
    const verified = verifyLicenseKey(stored.value);
    if (verified.ok && verified.payload) {
      return {
        edition: 'pro',
        trialDays: TRIAL_DAYS,
        trialDaysLeft,
        activated: true,
        machineHash,
        customer: verified.payload.customer,
        expiresAt: verified.payload.expiresAt,
        tampered: trial.tampered,
      };
    }
  }

  return {
    edition: expired ? 'trial_expired' : 'trial',
    trialDays: TRIAL_DAYS,
    trialDaysLeft,
    activated: false,
    machineHash,
    tampered: trial.tampered,
  };
}

export function activateLicense(key: string): { ok: true } | { ok: false; reason: string } {
  const verified = verifyLicenseKey(key);
  if (!verified.ok) return { ok: false, reason: verified.reason ?? 'Clave inválida' };
  run(
    "INSERT INTO app_state (key, value) VALUES ('license', ?) " +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key.trim()],
  );
  persist();
  return { ok: true };
}