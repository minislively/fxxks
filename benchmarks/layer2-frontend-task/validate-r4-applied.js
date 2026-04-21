#!/usr/bin/env node
/**
 * Validate an applied R4 Feature Module Split candidate.
 *
 * This is intentionally separate from the proposal-only smoke summarizer. A
 * candidate only passes this gate when the generated file tree exists on disk,
 * each generated module is bounded, barrel exports are coherent, TypeScript
 * accepts the generated files, and the local relative import graph has no
 * cycles. Optional target-project build/test commands can be supplied for a
 * stronger real-project acceptance artifact.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const REQUIRED_FILES = [
  'components/index.ts',
  'components/Combobox.tsx',
  'components/ComboboxInput.tsx',
  'components/ComboboxList.tsx',
  'components/ComboboxItem.tsx',
  'hooks/index.ts',
  'hooks/useCombobox.ts',
  'utils/index.ts',
  'utils/combobox-utils.ts',
  'types/index.ts',
  'types/combobox-types.ts',
];

const BARREL_EXPECTATIONS = {
  'components/index.ts': ['Combobox', 'ComboboxInput', 'ComboboxList', 'ComboboxItem'],
  'hooks/index.ts': ['useCombobox'],
  'utils/index.ts': ['combobox-utils'],
  'types/index.ts': ['combobox-types'],
};

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    const [key, ...rest] = arg.split('=');
    if (key.startsWith('--')) {
      acc[key.slice(2)] = rest.length > 0 ? rest.join('=') : true;
    }
    return acc;
  }, {});
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function displayPath(file) {
  const resolved = path.resolve(file);
  const cwd = path.resolve(process.cwd());
  const relative = path.relative(cwd, resolved);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return resolved;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function checkRequiredFiles(root) {
  const missing = REQUIRED_FILES.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    name: 'required file tree exists',
    passed: missing.length === 0,
    required: REQUIRED_FILES,
    missing,
  };
}

function checkLineLimits(root, maxLines) {
  const files = REQUIRED_FILES.filter((file) => fs.existsSync(path.join(root, file)));
  const measured = files.map((file) => {
    const lines = lineCount(read(path.join(root, file)));
    return { file, lines, passed: lines <= maxLines };
  });
  return {
    name: `generated files stay within ${maxLines} lines`,
    passed: measured.length === REQUIRED_FILES.length && measured.every((entry) => entry.passed),
    measured,
  };
}

function checkBarrels(root) {
  const measured = Object.entries(BARREL_EXPECTATIONS).map(([barrel, expectedNames]) => {
    const barrelPath = path.join(root, barrel);
    if (!fs.existsSync(barrelPath)) {
      return { file: barrel, passed: false, missing: expectedNames };
    }
    const source = read(barrelPath);
    const missing = expectedNames.filter((name) => {
      const importSafe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exportFromPattern = new RegExp(`export\\s+(?:\\*|\\{[^}]*\\})\\s+from\\s+['\"]\\./${importSafe}['\"]`);
      const namedPattern = new RegExp(`export\\s+\\{[^}]*\\b${importSafe}\\b[^}]*\\}`);
      return !exportFromPattern.test(source) && !namedPattern.test(source);
    });
    return { file: barrel, passed: missing.length === 0, missing };
  });
  return {
    name: 'barrel exports expose expected modules',
    passed: measured.every((entry) => entry.passed),
    measured,
  };
}

function allSourceFiles(root) {
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        out.push(fullPath);
      }
    }
  };
  visit(root);
  return out.sort();
}

function resolveRelativeImport(fromFile, specifier, fileSet) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  return candidates.find((candidate) => fileSet.has(path.resolve(candidate))) || null;
}

function importSpecifiers(source) {
  const specs = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[^'\"]+?\s+from\s+)?['\"]([^'\"]+)['\"]/g,
    /export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['\"]([^'\"]+)['\"]/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function findCycles(graph) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  const dfs = (node) => {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      if (start !== -1) cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) || []) dfs(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of graph.keys()) dfs(node);
  return cycles;
}

function checkCircularImports(root) {
  const files = allSourceFiles(root).map((file) => path.resolve(file));
  const fileSet = new Set(files);
  const graph = new Map();
  for (const file of files) {
    const deps = importSpecifiers(read(file))
      .map((specifier) => resolveRelativeImport(file, specifier, fileSet))
      .filter(Boolean);
    graph.set(file, deps);
  }
  const cycles = findCycles(graph).map((cycle) => cycle.map((file) => rel(root, file)));
  return {
    name: 'local relative import graph has no cycles',
    passed: cycles.length === 0,
    cycles,
  };
}

function runCommandGate(name, command, cwd, timeoutMs = 120000) {
  if (!command) {
    return { name, status: 'not-run', passed: true, required: false };
  }
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      shell: true,
    });
    return { name, status: 'passed', passed: true, required: true, command, output: output.slice(-4000) };
  } catch (error) {
    return {
      name,
      status: 'failed',
      passed: false,
      required: true,
      command,
      exitCode: error.status ?? null,
      output: `${error.stdout || ''}${error.stderr || ''}`.slice(-4000),
    };
  }
}

function findTypeScriptBin() {
  const local = path.resolve(__dirname, '..', '..', 'node_modules', 'typescript', 'bin', 'tsc');
  if (fs.existsSync(local)) return local;
  try {
    return execFileSync('npm', ['exec', '--', 'which', 'tsc'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function runAutoTypecheck(root) {
  const tsc = findTypeScriptBin();
  if (!tsc) {
    return {
      name: 'TypeScript accepts generated files',
      status: 'failed',
      passed: false,
      required: true,
      error: 'Unable to locate TypeScript compiler',
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fooks-r4-tsconfig-'));
  const tsconfigPath = path.join(tempDir, 'tsconfig.json');
  const files = allSourceFiles(root).map((file) => path.resolve(file));
  fs.writeFileSync(tsconfigPath, JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'Node16',
      moduleResolution: 'Node16',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      jsx: 'react-jsx',
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
    },
    files,
  }, null, 2));

  try {
    const output = execFileSync(process.execPath, [tsc, '--project', tsconfigPath, '--pretty', 'false'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });
    return {
      name: 'TypeScript accepts generated files',
      status: 'passed',
      passed: true,
      required: true,
      command: `node ${displayPath(tsc)} --project <temp-tsconfig> --pretty false`,
      output: output.slice(-4000),
    };
  } catch (error) {
    return {
      name: 'TypeScript accepts generated files',
      status: 'failed',
      passed: false,
      required: true,
      command: `node ${displayPath(tsc)} --project <temp-tsconfig> --pretty false`,
      exitCode: error.status ?? null,
      output: `${error.stdout || ''}${error.stderr || ''}`.slice(-4000),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runTypecheck(root, args) {
  const mode = args.typecheck || 'auto';
  if (mode === 'skip') {
    return { name: 'TypeScript accepts generated files', status: 'not-run', passed: true, required: false };
  }
  if (args['typecheck-command']) {
    return runCommandGate('TypeScript accepts generated files', args['typecheck-command'], args['command-cwd'] || root);
  }
  return runAutoTypecheck(root);
}

function validate(root, options = {}) {
  const maxLines = Number(options['max-lines'] || 200);
  const resolvedRoot = path.resolve(root);
  const requiredFileGate = checkRequiredFiles(resolvedRoot);
  const structuralGates = [
    requiredFileGate,
    checkLineLimits(resolvedRoot, maxLines),
    checkBarrels(resolvedRoot),
    checkCircularImports(resolvedRoot),
  ];
  const commandGates = [
    runTypecheck(resolvedRoot, options),
    runCommandGate('target project build command passes', options['build-command'], options['command-cwd'] || resolvedRoot),
    runCommandGate('target project test command passes', options['test-command'], options['command-cwd'] || resolvedRoot),
  ];
  const gates = [...structuralGates, ...commandGates];
  const requiredGates = gates.filter((gate) => gate.required !== false);
  const passed = requiredGates.every((gate) => gate.passed);
  return {
    status: passed ? 'applied-acceptance-validated' : 'applied-acceptance-failed',
    schemaVersion: 'layer2-r4-applied-acceptance.v1',
    timestamp: new Date().toISOString(),
    targetRoot: displayPath(resolvedRoot),
    maxLines,
    requiredFiles: REQUIRED_FILES,
    gates,
    summary: {
      requiredGateCount: requiredGates.length,
      passedRequiredGateCount: requiredGates.filter((gate) => gate.passed).length,
      optionalGateCount: gates.length - requiredGates.length,
    },
    claimBoundary: passed
      ? [
          'This validates an applied file tree on disk for the supplied candidate root.',
          'This does not by itself prove provider billing-token savings.',
          'This does not prove stable runtime-token/time wins without matched repeated runs.',
        ]
      : [
          'Do not claim applied-code acceptance until every required gate passes.',
          'Failure details are recorded in gates for retry/debugging.',
        ],
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root;
  if (!root) {
    console.error('Usage: node validate-r4-applied.js --root=<combobox-dir> [--output=<json>] [--typecheck=auto|skip] [--typecheck-command=<cmd>] [--build-command=<cmd>] [--test-command=<cmd>] [--command-cwd=<dir>]');
    process.exit(1);
  }

  const result = validate(root, args);
  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'applied-acceptance-validated') {
    process.exit(2);
  }
}

module.exports = { validate, REQUIRED_FILES, BARREL_EXPECTATIONS };

if (require.main === module) {
  main();
}
