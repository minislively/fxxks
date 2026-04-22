'use strict';

const fs = require('fs');

const LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const DEFAULT_PROVIDER_PREFIXES = [
  'anthropic/',
  'claude-3-5-',
  'claude-3-',
  'claude-',
  'openai/',
  'azure/',
  'openrouter/openai/',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNonNegativeNumber(value) {
  if (typeof value === 'string' && value.trim() !== '') value = Number(value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function perTokenToPer1M(value) {
  const normalized = finiteNonNegativeNumber(value);
  return normalized === null ? null : normalized * 1_000_000;
}

function createModelCandidates(provider, model, providerPrefixes = DEFAULT_PROVIDER_PREFIXES) {
  const candidates = new Set();
  if (typeof model !== 'string' || model.trim() === '') return [];
  const normalizedModel = model.trim();
  candidates.add(normalizedModel);

  if (typeof provider === 'string' && provider.trim() !== '') {
    candidates.add(`${provider.trim()}/${normalizedModel}`);
  }

  for (const prefix of providerPrefixes) {
    candidates.add(`${prefix}${normalizedModel}`);
  }

  return Array.from(candidates);
}

function findPricingEntry(dataset, { provider, model, providerPrefixes } = {}) {
  if (!isObject(dataset)) return null;
  const candidates = createModelCandidates(provider, model, providerPrefixes);
  for (const candidate of candidates) {
    const entry = dataset[candidate];
    if (isObject(entry)) return { modelKey: candidate, pricing: entry, matchKind: 'exact-or-prefixed' };
  }

  const lowerEntries = new Map(
    Object.entries(dataset).map(([key, value]) => [key.toLowerCase(), { key, value }]),
  );
  for (const candidate of candidates) {
    const found = lowerEntries.get(candidate.toLowerCase());
    if (found && isObject(found.value)) {
      return { modelKey: found.key, pricing: found.value, matchKind: 'case-insensitive' };
    }
  }

  return null;
}

function pricingAssumptionFromLiteLLMCatalog({
  dataset,
  provider,
  model,
  sourceUrl = LITELLM_PRICING_URL,
  checkedDate = new Date().toISOString().slice(0, 10),
  currency = 'USD',
  providerPrefixes,
} = {}) {
  const reasons = [];
  const normalizedProvider = typeof provider === 'string' && provider.trim() !== '' ? provider.trim() : null;
  const normalizedModel = typeof model === 'string' && model.trim() !== '' ? model.trim() : null;

  if (!normalizedProvider) reasons.push('pricing provider is missing for catalog lookup');
  if (!normalizedModel) reasons.push('pricing model is missing for catalog lookup');
  if (!isObject(dataset)) reasons.push('pricing catalog is not an object');

  if (reasons.length) {
    return {
      pricing: {
        provider: normalizedProvider,
        model: normalizedModel,
        currency,
        sourceUrl,
        checkedDate,
        pricingSourceKind: 'litellm-pricing-catalog',
        note: 'Estimated API cost only; not an invoice, charge, or provider billing statement.',
      },
      reasons,
    };
  }

  const match = findPricingEntry(dataset, {
    provider: normalizedProvider,
    model: normalizedModel,
    providerPrefixes,
  });

  if (!match) {
    return {
      pricing: {
        provider: normalizedProvider,
        model: normalizedModel,
        currency,
        sourceUrl,
        checkedDate,
        pricingSourceKind: 'litellm-pricing-catalog',
        note: 'Estimated API cost only; not an invoice, charge, or provider billing statement.',
      },
      reasons: [`pricing catalog has no entry for ${normalizedProvider}/${normalizedModel}`],
    };
  }

  const inputPer1MTokens = perTokenToPer1M(match.pricing.input_cost_per_token);
  const outputPer1MTokens = perTokenToPer1M(match.pricing.output_cost_per_token);
  const cachedInputPer1MTokens = perTokenToPer1M(match.pricing.cache_read_input_token_cost);
  const cacheCreationInputPer1MTokens = perTokenToPer1M(match.pricing.cache_creation_input_token_cost);
  const missingRateReasons = [];
  if (inputPer1MTokens === null) missingRateReasons.push(`pricing catalog entry ${match.modelKey} lacks input_cost_per_token`);
  if (outputPer1MTokens === null) missingRateReasons.push(`pricing catalog entry ${match.modelKey} lacks output_cost_per_token`);

  return {
    pricing: {
      provider: normalizedProvider,
      model: normalizedModel,
      currency,
      inputPer1MTokens,
      outputPer1MTokens,
      cachedInputPer1MTokens,
      cacheCreationInputPer1MTokens,
      sourceUrl,
      checkedDate,
      pricingSourceKind: 'litellm-pricing-catalog',
      catalogModelKey: match.modelKey,
      catalogMatchKind: match.matchKind,
      note: 'Estimated API cost only; derived from provider usage tokens and a LiteLLM-shaped pricing catalog; not an invoice, charge, or provider billing statement.',
    },
    reasons: missingRateReasons,
  };
}

function readPricingCatalog(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function fetchPricingCatalog(url = LITELLM_PRICING_URL) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable; use --pricing-catalog=<json> instead');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch pricing catalog: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

module.exports = {
  LITELLM_PRICING_URL,
  createModelCandidates,
  findPricingEntry,
  pricingAssumptionFromLiteLLMCatalog,
  readPricingCatalog,
  fetchPricingCatalog,
};
