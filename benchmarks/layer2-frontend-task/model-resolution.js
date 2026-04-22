'use strict';

const DEFAULT_OPENAI_MODEL = 'gpt-5.4';

function parseCliArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (!arg.startsWith('--')) {
      acc._.push(arg);
      return acc;
    }
    const index = arg.indexOf('=');
    if (index === -1) {
      acc[arg.slice(2)] = true;
    } else {
      acc[arg.slice(2, index)] = arg.slice(index + 1);
    }
    return acc;
  }, { _: [] });
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function resolveOpenAIModel({ modelArg, env = process.env, defaultModel = DEFAULT_OPENAI_MODEL } = {}) {
  const cliModel = nonEmptyString(modelArg);
  if (cliModel) {
    return {
      provider: 'openai',
      model: cliModel,
      modelSource: 'cli --model',
      defaultModel,
    };
  }

  const envModel = nonEmptyString(env.OPENAI_MODEL);
  if (envModel) {
    return {
      provider: 'openai',
      model: envModel,
      modelSource: 'OPENAI_MODEL',
      defaultModel,
    };
  }

  return {
    provider: 'openai',
    model: defaultModel,
    modelSource: 'current default',
    defaultModel,
  };
}

module.exports = {
  DEFAULT_OPENAI_MODEL,
  parseCliArgs,
  resolveOpenAIModel,
};
