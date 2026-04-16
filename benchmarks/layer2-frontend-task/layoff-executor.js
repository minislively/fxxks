#!/usr/bin/env node
/**
 * Layofflabs Direct Executor - Uses current API key with correct endpoint
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = 'api.layofflabs.com';

if (!API_KEY) {
  console.error('[Layoff Executor] ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

console.log(`[Layoff Executor] Using endpoint: ${BASE_URL}`);
console.log(`[Layoff Executor] Key format: ${API_KEY.substring(0, 10)}...`);

// Test connection first
const testReq = https.request({
  hostname: BASE_URL,
  path: '/v1/models',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${API_KEY}` }
}, (res) => {
  console.log(`[Layoff Executor] Connection test: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    console.log('[Layoff Executor] ✅ Connection valid, ready for CASE-1 execution');
  } else {
    console.error('[Layoff Executor] ❌ Connection failed');
  }
});

testReq.on('error', (e) => console.error(`[Layoff Executor] Error: ${e.message}`));
testReq.end();
