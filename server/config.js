/**
 * @fileoverview Shared configuration, environment variable loader, and limits.
 * Uses zero external dependencies; loads .env if present.
 */

const path = require('path');
const fs = require('fs');

/**
 * Lightweight .env parser for environments without pre-loaded env variables.
 */
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val.replace(/^["']|["']$/g, '');
          }
        }
      }
    } catch (_) {
      // Gracefully ignore file read errors
    }
  }
}

loadEnvFile();

/**
 * Server and application runtime constants.
 */
const PORT = parseInt(process.env.PORT, 10) || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_TIMEOUT_MS = 15000; // 15s outbound timeout
const MAX_BODY_BYTES = 10 * 1024; // 10KB request body limit
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

module.exports = {
  PORT,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  MAX_BODY_BYTES,
  PUBLIC_DIR
};
