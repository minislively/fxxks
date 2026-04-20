#!/usr/bin/env node
/**
 * Layer 2 Direct Executor - Uses current API key with configured endpoint
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.OPENAI_BASE_URL || '<api-base-url>').replace(/^https?:\/\//, '').replace(/\/.*$/, '');

if (!API_KEY) {
  console.error('[Layer2 Executor] ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

console.log(`[Layer2 Executor] Using endpoint: ${BASE_URL}`);
console.log(`[Layer2 Executor] Key format: ${API_KEY.substring(0, 10)}...`);

// Test connection first
const testReq = https.request({
  hostname: BASE_URL,
  path: '/v1/models',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${API_KEY}` }
}, (res) => {
  console.log(`[Layer2 Executor] Connection test: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    console.log('[Layer2 Executor] ✅ Connection valid, ready for CASE-1 execution');
  } else {
    console.error('[Layer2 Executor] ❌ Connection failed');
  }
});

testReq.on('error', (e) => console.error(`[Layer2 Executor] Error: ${e.message}`));
testReq.end();
