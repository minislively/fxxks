#!/usr/bin/env python3
"""Full benchmark suite - paired vanilla vs fooks runs for frontend repos."""

import argparse
import hashlib
import subprocess
import os
import re
import time
import json
import shutil
import sys
from pathlib import Path
from datetime import datetime

# Auto-detect paths
SCRIPT_DIR = Path(__file__).parent.resolve()
BENCHMARK_DIR = SCRIPT_DIR.parent.resolve()
FOOKS_DIR = BENCHMARK_DIR.parent.parent.resolve()  # fooks repo root
DEFAULT_REPORTS_DIR = BENCHMARK_DIR / "reports"
REPORT_SCHEMA_VERSION = "frontend-harness.v2-context-mode"
CONTEXT_POLICY_VERSION = "context-policy.v1"
RUNTIME_FILE_PREFIXES = (".codex/", ".fooks/", ".omx/", "node_modules/")

# Test repos location (can be overridden via env var)
REPOS_DIR = Path(os.environ.get("BENCHMARK_REPOS_DIR", Path.home() / "Workspace/fooks-test-repos"))

# OMX binary (can be overridden via env var)
OMX_BIN = Path(os.environ.get("OMX_BIN", Path.home() / "Workspace/oh-my-codex/dist/cli/omx.js"))
CODEX_BIN = os.environ.get("CODEX_BIN", "codex")

# Verify paths exist
if not FOOKS_DIR.exists():
    print(f"Error: fooks directory not found at {FOOKS_DIR}")
    sys.exit(1)

FOOKS_CLI = FOOKS_DIR / "dist/cli/index.js"
if not FOOKS_CLI.exists():
    print(f"Error: fooks CLI not found at {FOOKS_CLI}")
    print("Please build fooks first: npm run build")
    sys.exit(1)

# Test configuration
REPOS = {
    "shadcn-ui": REPOS_DIR / "ui",
    "cal.com": REPOS_DIR / "cal.com",
    "documenso": REPOS_DIR / "documenso",
    "formbricks": REPOS_DIR / "formbricks",
    "nextjs": REPOS_DIR / "nextjs",
    "tailwindcss": REPOS_DIR / "tailwindcss",
    "saleor-storefront": REPOS_DIR / "saleor-storefront",
}

# Task definitions
TASKS = [
    {
        "id": "T1",
        "name": "Button Relocation",
        "difficulty": "easy",
        "prompt": "Find the main submit/action button in a component and move it to the right side using flexbox justify-end. Make minimal changes - only move the button position. Report which file you modified."
    },
    {
        "id": "T2",
        "name": "Style Modification",
        "difficulty": "easy",
        "prompt": "Locate the primary button component and change its background color to blue (bg-blue-600 or equivalent). Keep all other functionality intact. Report which file you modified."
    },
    {
        "id": "T3",
        "name": "Loading State Addition",
        "difficulty": "medium",
        "prompt": "Add an isLoading prop to the main button component. When true, show 'Loading...' text and disable the button. Use existing patterns. Report which file you modified."
    },
    {
        "id": "T4",
        "name": "Component Extraction",
        "difficulty": "medium",
        "prompt": "Find a component with inline header JSX (title, subtitle, actions). Extract this into a separate Header component with appropriate props. Create a new file for the Header component. Report which files you modified/created."
    },
    {
        "id": "T5",
        "name": "Form Validation",
        "difficulty": "hard",
        "prompt": "Find an email input field in a form component. Add email format validation that shows a red error message below the input when the email is invalid. Use useState for validation state and regex for email validation. Report which file you modified."
    }
]

# Map tasks to appropriate repos (simplified for benchmark)
TASK_REPO_MAPPING = {
    "T1": ["shadcn-ui", "cal.com", "nextjs", "tailwindcss"],
    "T2": ["shadcn-ui", "cal.com", "nextjs", "tailwindcss"],
    "T3": ["shadcn-ui", "cal.com", "nextjs", "tailwindcss"],
    "T4": ["shadcn-ui", "documenso", "nextjs"],
    "T5": ["shadcn-ui", "cal.com", "nextjs", "tailwindcss"]
}

DEFAULT_TEST_CASES = [
    ("T1", "shadcn-ui"),  # Button Relocation
    ("T2", "shadcn-ui"),  # Style Modification
    ("T5", "shadcn-ui"),  # Form Validation (hard)
    ("T1", "cal.com"),    # Button on large repo
    ("T5", "cal.com"),    # Form Validation on large repo
]

ROUND1_NOTES = {
    "tokenEstimate": {
        "scope": "tsx-only proxy",
        "method": "Sample TSX files, run `fooks extract --model-payload`, scale sampled bytes to repo-level proxy.",
    },
    "environmentParity": {
        "runner": "Selected with --runner; vanilla and fooks variants use the same runner.",
        "prompt": "Identical task text for vanilla and fooks variants.",
        "codexHome": "Each variant uses an isolated CODEX_HOME with auth.json and config.toml symlinked from the same host account.",
        "variantDifference": "The fooks variant either runs fooks init/scan/attach before the same agent command or records an exact-file first-turn bypass when no fooks context would be injected; vanilla does not.",
    }
}

def build_task_index():
    return {task["id"]: task for task in TASKS}

def resolve_reports_dir(explicit_reports_dir=None):
    reports_dir = explicit_reports_dir or os.environ.get("BENCHMARK_REPORTS_DIR")
    if reports_dir:
        return Path(reports_dir).expanduser().resolve()
    return DEFAULT_REPORTS_DIR

def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", choices=sorted(REPOS.keys()), help="Run one repo only")
    parser.add_argument("--task", choices=sorted(build_task_index().keys()), help="Run one task only")
    parser.add_argument(
        "--runner",
        choices=["omx", "codex"],
        default="omx",
        help="Agent runner to benchmark. Use codex for direct Codex CLI without OMX orchestration.",
    )
    parser.add_argument("--task-prompt", help="Override the selected task prompt for one-off benchmark runs")
    parser.add_argument("--reports-dir", help="Override the directory used to save benchmark reports")
    parser.add_argument("--dry-run", action="store_true", help="Print resolved configuration and exit")
    parser.add_argument("--list-cases", action="store_true", help="Print the selected task/repo cases and exit")
    return parser.parse_args()

def resolve_test_cases(args):
    if bool(args.repo) != bool(args.task):
        raise SystemExit("--repo and --task must be provided together for a single-case run")
    if args.repo and args.task:
        return [(args.task, args.repo)]
    return DEFAULT_TEST_CASES

def resolve_task(task_id, prompt_override=None):
    task = build_task_index().get(task_id)
    if not task:
        raise KeyError(f"Unknown task id: {task_id}")
    resolved = dict(task)
    if prompt_override:
        resolved["prompt"] = prompt_override
    return resolved

def classify_task_context(task):
    """Classify benchmark task prompts for report-level interpretation.

    The Python harness cannot call the TypeScript policy during dry-run without
    building/running the package, so it records an equivalent task taxonomy for
    product report interpretation. Exact file prompts are intentionally rare in
    public tasks; ambiguous prompts are where fooks should have room to win.
    """
    prompt = task.get("prompt", "")
    has_explicit_file = bool(re.search(r"[A-Za-z0-9_./\\-]+\.(tsx|jsx)\b", prompt))
    if has_explicit_file:
        return {
            "taskClass": "targeted-edit",
            "promptSpecificity": "exact-file",
            "expectedContextPolicy": "light",
            "expectedFirstTurnRuntimeContext": "no-op",
            "expectedFooksPrepare": "bypass",
        }
    if task.get("id") in {"T4", "T5"}:
        return {
            "taskClass": "ambiguous-multi-file",
            "promptSpecificity": "ambiguous",
            "expectedContextPolicy": "auto",
            "expectedFirstTurnRuntimeContext": "auto",
            "expectedFooksPrepare": "scan-attach",
        }
    return {
        "taskClass": "ambiguous-single-file",
        "promptSpecificity": "ambiguous",
        "expectedContextPolicy": "auto",
        "expectedFirstTurnRuntimeContext": "auto",
        "expectedFooksPrepare": "scan-attach",
    }

def variant_context_metadata(task, variant):
    classification = classify_task_context(task)
    if variant == "vanilla":
        context_mode = "no-op"
        reason = "vanilla-baseline-no-fooks-context"
        max_files = 0
        selected_files = 0
    else:
        context_mode = classification.get("expectedFirstTurnRuntimeContext", classification["expectedContextPolicy"])
        reason = (
            "fooks-first-turn-exact-file-record-only"
            if classification["promptSpecificity"] == "exact-file" and context_mode == "no-op"
            else f"fooks-{classification['promptSpecificity']}-policy"
        )
        max_files = 1 if context_mode == "light" else 5 if context_mode == "auto" else 0
        # The harness records expected single-turn runtime metadata here.
        # Runtime-observed selected file counts belong to the fooks hook/run
        # context policy and should be measured separately from top-level
        # extraction policy.
        selected_files = 0 if context_mode in {"auto", "no-op"} else max_files
    return {
        "contextMode": context_mode,
        "contextModeReason": reason,
        "contextBudget": {
            "maxFiles": max_files,
            "selectedFiles": selected_files,
            "totalBytes": 0,
            "skippedFiles": 0,
        },
        "contextPolicyVersion": CONTEXT_POLICY_VERSION,
        "contextBudgetSource": "expected-policy",
    }

def expected_fooks_prepare_strategy(task):
    classification = classify_task_context(task)
    return classification.get("expectedFooksPrepare", "scan-attach")


def should_bypass_fooks_prepare(task):
    return expected_fooks_prepare_strategy(task) == "bypass"


def is_caps_lock_task(task):
    prompt = task.get("prompt", "").lower()
    return "caps lock" in prompt or "capslock" in prompt


def check_patch_contains(patch_text, *patterns):
    return any(re.search(pattern, patch_text, flags=re.IGNORECASE) for pattern in patterns)


def evaluate_caps_lock_acceptance(files, patch_text, prompt):
    locale_files = [f for f in files if f.startswith("apps/web/locales/") and f.endswith(".json")]
    prompt_lower = prompt.lower()
    locale_scope_requested = any(term in prompt_lower for term in ["all locale", "all translation", "all language", "translate"])
    target_file = "apps/web/modules/auth/login/components/login-form.tsx"
    checks = [
        {
            "name": "target_login_form_changed",
            "passed": target_file in files,
        },
        {
            "name": "caps_lock_state",
            "passed": check_patch_contains(patch_text, r"isCapsLock", r"capsLock"),
        },
        {
            "name": "get_modifier_state",
            "passed": check_patch_contains(patch_text, r"getModifierState\([\"']CapsLock[\"']\)"),
        },
        {
            "name": "password_input_handlers",
            "passed": check_patch_contains(patch_text, r"onKeyDown") and check_patch_contains(patch_text, r"onKeyUp"),
        },
        {
            "name": "inline_warning_text",
            "passed": check_patch_contains(patch_text, r"caps_lock", r"Caps Lock is on"),
        },
        {
            "name": "red_tailwind_warning",
            "passed": check_patch_contains(patch_text, r"text-red-"),
        },
        {
            "name": "accessible_announcement",
            "passed": check_patch_contains(patch_text, r"role=\{?[\"'](?:alert|status)[\"']\}?", r"aria-live"),
        },
        {
            "name": "locale_scope_capped",
            "passed": locale_scope_requested or len(locale_files) <= 1,
            "details": f"locale_files={len(locale_files)}",
        },
        {
            "name": "file_scope_capped",
            "passed": len(files) <= 2,
            "details": f"files={len(files)}",
        },
    ]
    score = sum(1 for check in checks if check["passed"])
    return {
        "available": True,
        "kind": "caps-lock-login-warning",
        "score": score,
        "max_score": len(checks),
        "passed": score == len(checks),
        "checks": checks,
    }


def evaluate_acceptance(task, files, patch_text):
    if is_caps_lock_task(task):
        return evaluate_caps_lock_acceptance(files, patch_text, task.get("prompt", ""))
    return {"available": False, "reason": "no scorer for task prompt"}


def get_session_token_estimate(repo_path):
    """Estimate session-level token savings"""
    tsx_files = list(repo_path.rglob("*.tsx"))
    total_tsx = len(tsx_files)

    # Sample 30 files for quick estimation
    import random
    if len(tsx_files) > 30:
        sample = random.sample(tsx_files, 30)
    else:
        sample = tsx_files

    total_raw = 0
    total_compressed = 0

    for f in sample:
        try:
            raw_content = f.read_text()
            raw_size = len(raw_content)

            result = subprocess.run(
                ["node", str(FOOKS_CLI), "extract", str(f), "--model-payload"],
                capture_output=True, text=True, timeout=10
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)
                payload = data if 'mode' in data else data.get('modelPayload', {})
                compressed_size = len(json.dumps(payload))

                total_raw += raw_size
                total_compressed += compressed_size
        except:
            pass

    # Scale to full repo
    if len(sample) > 0:
        scale = total_tsx / len(sample)
        estimated_raw = total_raw * scale
        estimated_compressed = total_compressed * scale
    else:
        estimated_raw = 0
        estimated_compressed = 0

    return {
        "total_files": total_tsx,
        "raw_bytes": estimated_raw,
        "compressed_bytes": estimated_compressed,
        "raw_tokens": estimated_raw // 4,
        "compressed_tokens": estimated_compressed // 4,
        "tokens_saved": (estimated_raw - estimated_compressed) // 4,
        "reduction_pct": (1 - estimated_compressed/estimated_raw) * 100 if estimated_raw > 0 else 0,
        "scope": ROUND1_NOTES["tokenEstimate"]["scope"],
        "method": ROUND1_NOTES["tokenEstimate"]["method"],
    }

def create_worktree(repo_path, task_id, variant):
    """Create isolated worktree with .codex"""
    timestamp = int(time.time())
    branch_name = f"bm-{task_id}-{variant}-{timestamp}"
    worktree_path = REPOS_DIR / ".worktrees" / branch_name
    codex_home = worktree_path / ".codex"

    subprocess.run(
        ["git", "worktree", "add", "-B", branch_name, str(worktree_path)],
        cwd=repo_path, capture_output=True, text=True, check=True
    )
    codex_home.mkdir(parents=True, exist_ok=True)
    (codex_home / "auth.json").symlink_to(Path.home() / ".codex/auth.json")
    (codex_home / "config.toml").symlink_to(Path.home() / ".codex/config.toml")

    return {"path": worktree_path, "branch": branch_name, "codex_home": codex_home}

def remove_worktree(worktree, repo_path):
    """Clean up worktree"""
    worktree_path = worktree["path"]
    branch_name = worktree["branch"]
    status = {"removed": False, "branch_deleted": False, "error": None}

    try:
        # Do not delete .codex before asking git to remove the worktree. It may
        # contain symlinks to tracked paths in repos that ship their own .codex
        # directory; deleting it first leaves tracked deletions and makes
        # `git worktree remove` refuse cleanup.
        removed = subprocess.run(
            ["git", "worktree", "remove", "--force", "--force", str(worktree_path)],
            cwd=repo_path,
            capture_output=True,
            text=True,
        )
        status["removed"] = removed.returncode == 0
        if removed.returncode != 0:
            status["error"] = (removed.stderr or removed.stdout or "worktree removal failed")[:500]
            shutil.rmtree(worktree_path, ignore_errors=True)
            subprocess.run(["git", "worktree", "prune"], cwd=repo_path, capture_output=True)

        deleted = subprocess.run(
            ["git", "branch", "-D", branch_name],
            cwd=repo_path,
            capture_output=True,
            text=True,
        )
        status["branch_deleted"] = deleted.returncode == 0
    except Exception as e:
        status["error"] = str(e)

    return status

def is_runtime_path(file_path):
    return file_path.startswith(RUNTIME_FILE_PREFIXES)


def untracked_source_files(worktree_path):
    result = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=worktree_path,
        capture_output=True,
        text=True,
    )
    return [f for f in result.stdout.splitlines() if f and not is_runtime_path(f)]


def changed_files(worktree_path):
    files_result = subprocess.run(
        ["git", "diff", "--name-only", "--", ".", ":(exclude).codex", ":(exclude).fooks", ":(exclude).omx"],
        cwd=worktree_path,
        capture_output=True,
        text=True
    )
    files = [f for f in files_result.stdout.strip().split('\n') if f]
    return sorted(set(files + untracked_source_files(worktree_path)))

def mark_untracked_intent(worktree_path):
    """Make safe untracked source files visible to git diff without staging contents."""
    candidates = untracked_source_files(worktree_path)
    if candidates:
        subprocess.run(["git", "add", "-N", "--", *candidates], cwd=worktree_path, capture_output=True, text=True)


def capture_artifact(worktree_path, artifact_dir, stem):
    """Persist patch, diffstat, and whitespace check before the worktree is removed."""
    artifact_dir.mkdir(parents=True, exist_ok=True)
    mark_untracked_intent(worktree_path)

    diff_pathspec = ["--", ".", ":(exclude).codex", ":(exclude).fooks", ":(exclude).omx"]
    patch = subprocess.run(["git", "diff", "--binary", *diff_pathspec], cwd=worktree_path, capture_output=True, text=True)
    diffstat = subprocess.run(["git", "diff", "--stat", *diff_pathspec], cwd=worktree_path, capture_output=True, text=True)
    diff_check = subprocess.run(["git", "diff", "--check", *diff_pathspec], cwd=worktree_path, capture_output=True, text=True)

    patch_path = artifact_dir / f"{stem}.patch"
    diffstat_path = artifact_dir / f"{stem}.diffstat"
    patch_path.write_text(patch.stdout)
    diffstat_path.write_text(diffstat.stdout)

    return {
        "patch_path": str(patch_path),
        "diffstat_path": str(diffstat_path),
        "patch_bytes": len(patch.stdout.encode()),
        "diffstat": diffstat.stdout,
        "diff_check": {
            "success": diff_check.returncode == 0,
            "stdout": output_tail(diff_check.stdout, 1000),
            "stderr": output_tail(diff_check.stderr, 1000),
        },
    }

def capture_artifact_with_acceptance(worktree_path, artifact_dir, stem, task, files):
    artifact = capture_artifact(worktree_path, artifact_dir, stem)
    patch_text = ""
    try:
        patch_text = Path(artifact["patch_path"]).read_text()
    except Exception:
        patch_text = ""
    artifact["acceptance"] = evaluate_acceptance(task, files, patch_text)
    return artifact


def detect_package_manager(worktree_path):
    """Detect package manager (npm, pnpm, yarn) based on lock files"""
    if (worktree_path / "pnpm-lock.yaml").exists() or (worktree_path / "pnpm-workspace.yaml").exists():
        return "pnpm"
    if (worktree_path / "yarn.lock").exists():
        return "yarn"
    return "npm"

def get_package_manager_cmd(package_manager, cmd_type="run"):
    """Get package manager command for running scripts or executing binaries"""
    if package_manager == "pnpm":
        if cmd_type == "exec":
            return ["pnpm", "exec"]
        return ["pnpm", "run"]
    if package_manager == "yarn":
        if cmd_type == "exec":
            return ["yarn", "exec"]
        return ["yarn", "run"]
    if cmd_type == "exec":
        return ["npx"]
    return ["npm", "run"]

def validate_typecheck(worktree_path):
    """Run TypeScript type check (tsc --noEmit) with package manager auto-detection"""
    package_manager = detect_package_manager(worktree_path)
    
    # Try to find tsc
    tsc_paths = [
        worktree_path / "node_modules/.bin/tsc",
        worktree_path / "node_modules/typescript/bin/tsc",
    ]
    tsc = None
    for p in tsc_paths:
        if p.exists():
            tsc = str(p)
            break
    
    # If no direct tsc, use package manager exec
    if not tsc:
        tsc_cmd = get_package_manager_cmd(package_manager, "exec") + ["tsc"]
    else:
        tsc_cmd = [tsc]
    
    # Check for tsconfig.json (at root or in apps/web for monorepos)
    tsconfig_paths = [
        worktree_path / "tsconfig.json",
        worktree_path / "apps/web/tsconfig.json",
        worktree_path / "packages/app/tsconfig.json",
    ]
    tsconfig = None
    for p in tsconfig_paths:
        if p.exists():
            tsconfig = p
            break
    
    if not tsconfig:
        return {"success": False, "error": "tsconfig.json not found", "skipped": True}
    
    # For turborepo workspaces, try turbo typecheck if available
    turbo_config = worktree_path / "turbo.json"
    if turbo_config.exists() and package_manager == "pnpm":
        # Check for typecheck task in turbo
        turbo_result = subprocess.run(
            ["pnpm", "exec", "turbo", "run", "typecheck", "--filter=./apps/web", "--no-daemon"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            timeout=120
        )
        if turbo_result.returncode == 0:
            return {
                "success": True,
                "method": "turbo",
                "package_manager": package_manager,
            }
        # If turbo typecheck fails, try direct tsc in apps/web
    
    # Run tsc with the found tsconfig
    cwd_for_tsc = tsconfig.parent if tsconfig != worktree_path / "tsconfig.json" else worktree_path
    result = subprocess.run(
        tsc_cmd + ["--noEmit", "--skipLibCheck"],
        cwd=cwd_for_tsc,
        capture_output=True,
        text=True,
        timeout=60
    )
    
    return {
        "success": result.returncode == 0,
        "error_count": result.stdout.count("error TS") if result.stdout else 0,
        "stderr": output_tail(result.stderr, 1000) if result.stderr else None,
        "stdout": output_tail(result.stdout, 1000) if result.stdout else None,
        "package_manager": package_manager,
        "method": "tsc",
        "tsconfig_path": str(tsconfig.relative_to(worktree_path)) if tsconfig else None,
    }

def validate_build(worktree_path):
    """Run build command if available with package manager auto-detection"""
    package_manager = detect_package_manager(worktree_path)
    
    # Check package.json for build script
    pkg_json = worktree_path / "package.json"
    if not pkg_json.exists():
        return {"success": False, "error": "package.json not found", "skipped": True}
    
    try:
        import json
        with open(pkg_json) as f:
            pkg = json.load(f)
        
        if not pkg.get("scripts", {}).get("build"):
            return {"success": False, "error": "build script not found", "skipped": True}
    except:
        return {"success": False, "error": "failed to parse package.json", "skipped": True}
    
    # For turborepo workspaces with pnpm, try turbo build
    turbo_config = worktree_path / "turbo.json"
    if turbo_config.exists() and package_manager == "pnpm":
        build_cmd = ["pnpm", "exec", "turbo", "run", "build", "--filter=./apps/web", "--no-daemon"]
        timeout = 600  # 10 min for turbo builds
    else:
        build_cmd = get_package_manager_cmd(package_manager, "run") + ["build"]
        timeout = 300  # 5 min for regular builds
    
    result = subprocess.run(
        build_cmd,
        cwd=worktree_path,
        capture_output=True,
        text=True,
        timeout=timeout
    )
    
    # Check for env-gated failures (missing required env vars)
    output_combined = (result.stdout or "") + (result.stderr or "")
    env_gated_signals = [
        "DATABASE_URL",
        "ENCRYPTION_KEY", 
        "REDIS_URL",
        "Invalid environment variables",
        "env var",
        "environment variable",
    ]
    is_env_gated = any(signal in output_combined for signal in env_gated_signals) and result.returncode != 0
    
    return {
        "success": result.returncode == 0,
        "env_gated": is_env_gated,
        "error": output_tail(result.stderr, 1000) if result.stderr else None,
        "stdout_tail": output_tail(result.stdout, 1000) if result.stdout else None,
        "package_manager": package_manager,
        "method": "turbo" if (turbo_config.exists() and package_manager == "pnpm") else "direct",
    }

def run_validation(worktree_path, validation_type="typecheck"):
    """Run validation based on type"""
    if validation_type == "typecheck":
        return validate_typecheck(worktree_path)
    elif validation_type == "build":
        return validate_build(worktree_path)
    return {"success": False, "error": "unknown validation type", "skipped": True}

def output_tail(value, limit=2000):
    if not value:
        return ""
    return value[-limit:]

def parse_tokens_used(output):
    if not output:
        return None
    match = re.search(r"tokens used\s*\n\s*([0-9,]+)", output, flags=re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))

def agent_prompt(task):
    return f"Task: {task['name']}\n{task['prompt']}"

def runner_label(runner):
    if runner == "codex":
        return "codex exec --full-auto"
    return "omx exec --full-auto"

def agent_command(worktree_path, task, runner):
    prompt = agent_prompt(task)
    if runner == "codex":
        return [
            str(CODEX_BIN), "exec",
            "--cd", str(worktree_path),
            "--full-auto",
            prompt,
        ]
    return [
        "node", str(OMX_BIN), "exec",
        "--cd", str(worktree_path),
        "--full-auto",
        prompt
    ]

def command_metadata(worktree, task, runner):
    metadata = {
        "runner": runner_label(runner),
        "runner_key": runner,
        "cwd": str(worktree["path"]),
        "codex_home": str(worktree["codex_home"]),
        "prompt_sha256": hashlib.sha256(agent_prompt(task).encode()).hexdigest(),
    }
    if runner == "codex":
        metadata["codex_bin"] = str(CODEX_BIN)
    else:
        metadata["omx_bin"] = str(OMX_BIN)
    return metadata

def fooks_prepare(worktree, runner):
    start = time.time()
    steps = []
    env = {
        **os.environ,
        "FOOKS_ACTIVE_ACCOUNT": os.environ.get("FOOKS_ACTIVE_ACCOUNT", "minislively"),
        "FOOKS_CODEX_HOME": str(worktree["codex_home"]),
    }

    for step_name, cmd in [
        ("init", ["node", str(FOOKS_CLI), "init"]),
        ("scan", ["node", str(FOOKS_CLI), "scan"]),
        ("attach-codex", ["node", str(FOOKS_CLI), "attach", "codex"]),
    ]:
        step_start = time.time()
        result = subprocess.run(
            cmd,
            cwd=worktree["path"],
            capture_output=True,
            text=True,
            timeout=120,
            env=env,
        )
        steps.append({
            "name": step_name,
            "success": result.returncode == 0,
            "duration_ms": int((time.time() - step_start) * 1000),
            "stdout_tail": output_tail(result.stdout, 1000),
            "stderr_tail": output_tail(result.stderr, 1000),
        })
        if result.returncode != 0:
            return {
                "success": False,
                "duration_ms": int((time.time() - start) * 1000),
                "steps": steps,
                "error": (result.stderr or result.stdout or f"{step_name} failed")[:500],
            }

    return {
        "success": True,
        "duration_ms": int((time.time() - start) * 1000),
        "steps": steps,
        "error": None,
    }

def risk_level(order, *levels):
    return max(levels, key=lambda level: order.index(level))

def assess_benchmark_risks(results):
    """Attach conservative interpretation risk levels for round-1 evidence."""
    order = ["low", "medium", "high", "critical"]
    successful_pairs = [
        r for r in results
        if r.get("vanilla", {}).get("success") and r.get("fooks", {}).get("success")
    ]
    same_files = all(
        r.get("vanilla", {}).get("files_list") == r.get("fooks", {}).get("files_list")
        and bool(r.get("vanilla", {}).get("files_list"))
        for r in successful_pairs
    )
    same_prompt = all(
        r.get("vanilla", {}).get("command", {}).get("prompt_sha256")
        == r.get("fooks", {}).get("command", {}).get("prompt_sha256")
        for r in successful_pairs
    )
    same_runner = all(
        r.get("vanilla", {}).get("command", {}).get("runner")
        == r.get("fooks", {}).get("command", {}).get("runner")
        for r in successful_pairs
    )
    runner_names = sorted({
        r.get("vanilla", {}).get("command", {}).get("runner", "unknown")
        for r in successful_pairs
    })
    cleanup_ok = all(
        r.get("vanilla", {}).get("cleanup", {}).get("removed")
        and r.get("fooks", {}).get("cleanup", {}).get("removed")
        for r in successful_pairs
    )
    actual_tokens_available = all(
        r.get("vanilla", {}).get("tokens_used") is not None
        and r.get("fooks", {}).get("tokens_used") is not None
        for r in successful_pairs
    )
    actual_token_regressions = [
        r for r in successful_pairs
        if actual_tokens_available and r["fooks"]["tokens_used"] > r["vanilla"]["tokens_used"]
    ]
    acceptance_available = any(
        r.get("fooks", {}).get("artifact", {}).get("acceptance", {}).get("available")
        for r in successful_pairs
    )
    fooks_acceptance_failures = [
        r for r in successful_pairs
        if r.get("fooks", {}).get("artifact", {}).get("acceptance", {}).get("available")
        and not r.get("fooks", {}).get("artifact", {}).get("acceptance", {}).get("passed")
    ]
    scope_regressions = [
        r for r in successful_pairs
        if len(r.get("fooks", {}).get("files_list", [])) > max(2, len(r.get("vanilla", {}).get("files_list", [])) + 1)
    ]

    risks = [
        {
            "name": "sample_size",
            "level": "high" if len(successful_pairs) < 3 else "medium" if len(successful_pairs) < 5 else "low",
            "evidence": f"{len(successful_pairs)} successful paired benchmark(s).",
            "interpretation": "Use as round-1 proof only; repeat N>=3 before claiming stable performance.",
        },
        {
            "name": "environment_parity",
            "level": "low" if same_prompt and same_files and same_runner else "medium",
            "evidence": f"same_prompt={same_prompt}, same_files={same_files}, same_runner={same_runner}, runner={','.join(runner_names)}",
            "interpretation": "Both variants use the same selected runner with isolated CODEX_HOME; fooks may prepare native context or explicitly bypass exact-file first-turn preparation.",
        },
        {
            "name": "orchestration_overhead",
            "level": "low" if runner_names == ["codex exec --full-auto"] else "medium",
            "evidence": f"runner={','.join(runner_names)}",
            "interpretation": "Direct Codex is the cleaner product benchmark; OMX runner includes orchestration overhead and policy surface.",
        },
        {
            "name": "cleanup_reproducibility",
            "level": "low" if cleanup_ok else "high",
            "evidence": f"cleanup_removed={cleanup_ok}",
            "interpretation": "Worktree residue can contaminate reruns if cleanup fails.",
        },
        {
            "name": "wall_clock_noise",
            "level": "medium" if len(successful_pairs) == 1 else "low",
            "evidence": "Single-run wall-clock timing includes model/service variability.",
            "interpretation": "Prefer median and p95 over repeated identical tasks.",
        },
        {
            "name": "artifact_quality_scope",
            "level": "high" if fooks_acceptance_failures or scope_regressions else "low" if acceptance_available else "medium",
            "evidence": (
                f"acceptance_available={acceptance_available}, fooks_acceptance_failures={len(fooks_acceptance_failures)}, scope_regressions={len(scope_regressions)}"
            ),
            "interpretation": "Do not cite wins unless fooks passes task acceptance and avoids broader edit scope than vanilla.",
        },
        {
            "name": "runtime_token_claim",
            "level": "high" if actual_token_regressions else "medium" if actual_tokens_available else "critical",
            "evidence": (
                "Actual OMX/Codex tokens available; fooks used more runtime tokens in "
                f"{len(actual_token_regressions)}/{len(successful_pairs)} pair(s)."
                if actual_tokens_available
                else "Actual OMX/Codex tokens were not parsed."
            ),
            "interpretation": "Do not claim runtime token reduction from this run; keep proxy compression and actual tokens separate.",
        },
    ]

    return {
        "overall": risk_level(order, *(risk["level"] for risk in risks)) if risks else "critical",
        "scale": {
            "low": "Safe to cite with caveat.",
            "medium": "Useful but should be repeated.",
            "high": "Round-1 directional evidence only.",
            "critical": "Do not cite without fixing measurement.",
        },
        "risks": risks,
    }

def run_vanilla_agent(worktree, task, runner):
    """Run vanilla agent runner"""
    start = time.time()

    cmd = agent_command(worktree["path"], task, runner)

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600,
            env={**os.environ, "CODEX_HOME": str(worktree["codex_home"])}
        )
        duration = int((time.time() - start) * 1000)

        files = changed_files(worktree["path"])

        return {
            "success": result.returncode == 0,
            "duration_ms": duration,
            "files": len(files),
            "files_list": files,
            "tokens_used": parse_tokens_used(result.stderr),
            "command": command_metadata(worktree, task, runner),
            **variant_context_metadata(task, "vanilla"),
            "stdout_tail": output_tail(result.stdout),
            "stderr_tail": output_tail(result.stderr, 1000),
            "error": None if result.returncode == 0 else result.stderr[:200],
            "validation": {
                "typecheck": run_validation(worktree["path"], "typecheck") if files else {"skipped": True, "reason": "no files changed"},
                "build": {"skipped": True, "reason": "build validation not run for vanilla"}
            }
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "duration_ms": 600000, "files": 0, "files_list": [], "error": "Timeout"}
    except Exception as e:
        return {"success": False, "duration_ms": int((time.time() - start) * 1000), "files": 0, "files_list": [], "error": str(e)}

def run_fooks_agent(worktree, task, runner):
    """Run fooks-prepared agent runner"""
    if should_bypass_fooks_prepare(task):
        prepare = {
            "success": True,
            "duration_ms": 0,
            "steps": [],
            "error": None,
            "bypassed": True,
            "reason": "exact-file-first-turn-no-context",
        }
    else:
        prepare = fooks_prepare(worktree, runner)
    fooks_scan_time = prepare["duration_ms"]
    if not prepare["success"]:
        return {
            "success": False,
            "duration_ms": 0,
            "scan_time": fooks_scan_time,
            "total_time": fooks_scan_time,
            "files": 0,
            "files_list": [],
            "prepare": prepare,
            "command": command_metadata(worktree, task, runner),
            **variant_context_metadata(task, "fooks"),
            "error": prepare["error"],
        }

    # Run selected agent
    start = time.time()
    cmd = agent_command(worktree["path"], task, runner)

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600,
            env={**os.environ, "CODEX_HOME": str(worktree["codex_home"])}
        )
        duration = int((time.time() - start) * 1000)

        files = changed_files(worktree["path"])

        return {
            "success": result.returncode == 0,
            "duration_ms": duration,
            "scan_time": fooks_scan_time,
            "total_time": fooks_scan_time + duration,
            "files": len(files),
            "files_list": files,
            "tokens_used": parse_tokens_used(result.stderr),
            "prepare": prepare,
            "command": command_metadata(worktree, task, runner),
            **variant_context_metadata(task, "fooks"),
            "stdout_tail": output_tail(result.stdout),
            "stderr_tail": output_tail(result.stderr, 1000),
            "error": None if result.returncode == 0 else result.stderr[:200],
            "validation": {
                "typecheck": run_validation(worktree["path"], "typecheck") if files else {"skipped": True, "reason": "no files changed"},
                "build": run_validation(worktree["path"], "build") if files else {"skipped": True, "reason": "no files changed"}
            }
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "duration_ms": 600000, "scan_time": fooks_scan_time,
                "total_time": fooks_scan_time + 600000, "files": 0, "files_list": [], "error": "Timeout"}
    except Exception as e:
        return {"success": False, "duration_ms": int((time.time() - start) * 1000),
                "scan_time": fooks_scan_time, "total_time": fooks_scan_time + int((time.time() - start) * 1000),
                "files": 0, "files_list": [], "error": str(e)}

def run_benchmark(task, repo_name, runner, artifact_dir):
    """Run full benchmark for one task on one repo"""
    print(f"\n{'='*70}")
    print(f"[{task['id']}] {task['name']} ({task['difficulty']})")
    print(f"Repo: {repo_name}")
    print(f"Runner: {runner_label(runner)}")
    print(f"{'='*70}")

    repo_path = REPOS[repo_name]
    if not repo_path.exists():
        raise FileNotFoundError(f"Repository checkout not found at {repo_path}")
    classification = classify_task_context(task)
    results = {"task": task['id'], "task_name": task['name'], "repo": repo_name,
               "difficulty": task['difficulty'], "timestamp": datetime.now().isoformat(),
               "repoClass": "external-oss-nextjs-tailwind" if repo_name in {"formbricks", "cal.com", "shadcn-ui", "documenso", "nextjs"} else "external-oss-frontend",
               "taskClass": classification["taskClass"],
               "promptSpecificity": classification["promptSpecificity"],
               "expectedContextPolicy": classification["expectedContextPolicy"],
               "expectedFirstTurnRuntimeContext": classification.get("expectedFirstTurnRuntimeContext", classification["expectedContextPolicy"]),
               "expectedFooksPrepare": classification.get("expectedFooksPrepare", "scan-attach")}

    # Token estimate (once per repo)
    print("  Calculating token estimates...")
    token_est = get_session_token_estimate(repo_path)
    results["tokens"] = token_est
    print(f"    Repo: {token_est['total_files']:,} TSX files")
    print(f"    Raw: ~{token_est['raw_tokens']:,.0f} tokens")
    print(f"    Compressed: ~{token_est['compressed_tokens']:,.0f} tokens")
    print(f"    Saved: ~{token_est['tokens_saved']:,.0f} tokens ({token_est['reduction_pct']:.1f}%)")

    # Vanilla
    print("\n  [VANILLA] Running...")
    wt_v = create_worktree(repo_path, task['id'], "vanilla")
    res_v = run_vanilla_agent(wt_v, task, runner)
    res_v["artifact"] = capture_artifact_with_acceptance(wt_v["path"], artifact_dir, f"{repo_name}-{task['id']}-vanilla", task, res_v.get("files_list", []))
    res_v["cleanup"] = remove_worktree(wt_v, repo_path)
    results["vanilla"] = res_v
    print(f"    {'✓' if res_v['success'] else '✗'} {res_v['duration_ms']:,}ms, {res_v['files']} files")
    if res_v['error']:
        print(f"    Error: {res_v['error'][:100]}")

    time.sleep(3)

    # Fooks
    print("\n  [FOOKS] Running...")
    wt_f = create_worktree(repo_path, task['id'], "fooks")
    res_f = run_fooks_agent(wt_f, task, runner)
    res_f["artifact"] = capture_artifact_with_acceptance(wt_f["path"], artifact_dir, f"{repo_name}-{task['id']}-fooks", task, res_f.get("files_list", []))
    res_f["cleanup"] = remove_worktree(wt_f, repo_path)
    results["fooks"] = res_f
    print(f"    {'✓' if res_f['success'] else '✗'} exec:{res_f['duration_ms']:,}ms + scan:{res_f['scan_time']:,}ms = {res_f['total_time']:,}ms, {res_f['files']} files")
    if res_f['error']:
        print(f"    Error: {res_f['error'][:100]}")

    # Calculate improvement
    if res_v['success'] and res_f['success'] and res_v['duration_ms'] > 0:
        exec_improvement = (res_v['duration_ms'] - res_f['duration_ms']) / res_v['duration_ms'] * 100
        total_improvement = (res_v['duration_ms'] - res_f['total_time']) / res_v['duration_ms'] * 100
    else:
        exec_improvement = 0
        total_improvement = 0

    results["improvement"] = {"exec": exec_improvement, "total": total_improvement}
    print(f"\n  Execution time diff: {exec_improvement:+.1f}%")
    print(f"  Total time diff: {total_improvement:+.1f}%")

    return results

def main():
    args = parse_args()
    reports_dir = resolve_reports_dir(args.reports_dir)
    test_cases = resolve_test_cases(args)

    if args.list_cases or args.dry_run:
        resolved_tasks = []
        for task_id, repo_name in test_cases:
            task = resolve_task(task_id, args.task_prompt if (args.repo and args.task == task_id) else None)
            classification = classify_task_context(task)
            resolved_tasks.append({
                "task": task["id"],
                "task_name": task["name"],
                "repo": repo_name,
                "repo_path": str(REPOS[repo_name]),
                "repo_exists": REPOS[repo_name].exists(),
                "prompt": task["prompt"],
                "taskClass": classification["taskClass"],
                "promptSpecificity": classification["promptSpecificity"],
                "expectedContextPolicy": classification["expectedContextPolicy"],
                "expectedFirstTurnRuntimeContext": classification.get("expectedFirstTurnRuntimeContext", classification["expectedContextPolicy"]),
                "expectedFooksPrepare": classification.get("expectedFooksPrepare", "scan-attach"),
            })
        print(json.dumps({
            "reportSchemaVersion": REPORT_SCHEMA_VERSION,
            "reportsDir": str(reports_dir),
            "defaultReportsDir": str(DEFAULT_REPORTS_DIR),
            "reposDir": str(REPOS_DIR),
            "runner": args.runner,
            "runnerLabel": runner_label(args.runner),
            "selectedCases": resolved_tasks,
            "availableRepos": sorted(REPOS.keys()),
            "availableTasks": sorted(build_task_index().keys()),
            "tokenEstimateNotes": ROUND1_NOTES["tokenEstimate"],
        }, indent=2))
        return 0

    print("="*70)
    print("Fooks Full Benchmark Suite")
    print("="*70)
    print(f"Start time: {datetime.now().isoformat()}")
    print(f"Tasks: {', '.join(sorted(build_task_index().keys()))}")
    print(f"Repos: {', '.join(sorted(REPOS.keys()))}")
    print(f"Runner: {runner_label(args.runner)}")
    print(f"Variants: Vanilla vs Fooks (with token estimates)")
    print(f"Reports dir: {reports_dir}")
    print("="*70)

    all_results = []
    report_timestamp = int(time.time())
    artifact_dir = reports_dir / "artifacts" / f"benchmark-full-{report_timestamp}"

    for task_id, repo_name in test_cases:
        task = resolve_task(task_id, args.task_prompt if (args.repo and args.task == task_id) else None)

        try:
            result = run_benchmark(task, repo_name, args.runner, artifact_dir)
            all_results.append(result)
        except Exception as e:
            print(f"\n  ✗ Benchmark failed: {e}")
            all_results.append({
                "task": task_id, "repo": repo_name, "error": str(e),
                "timestamp": datetime.now().isoformat()
            })

        # Cool down between tests
        time.sleep(5)

    # Generate final report
    print("\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)

    # Aggregate results
    vanilla_success = [r for r in all_results if r.get("vanilla", {}).get("success")]
    fooks_success = [r for r in all_results if r.get("fooks", {}).get("success")]

    v_times = [r["vanilla"]["duration_ms"] for r in vanilla_success]
    f_times = [r["fooks"]["duration_ms"] for r in fooks_success]
    f_total_times = [r["fooks"]["total_time"] for r in fooks_success]

    if v_times and f_times:
        avg_v = sum(v_times) / len(v_times)
        avg_f = sum(f_times) / len(f_times)
        avg_f_total = sum(f_total_times) / len(f_total_times)

        print(f"\nCompleted: {len(all_results)} benchmarks")
        print(f"Vanilla success: {len(vanilla_success)}/{len(all_results)}")
        print(f"Fooks success: {len(fooks_success)}/{len(all_results)}")
        print(f"\nAvg Vanilla time: {avg_v:,.0f}ms")
        print(f"Avg Fooks exec: {avg_f:,.0f}ms ({(avg_v-avg_f)/avg_v*100:+.1f}%)")
        print(f"Avg Fooks total: {avg_f_total:,.0f}ms ({(avg_v-avg_f_total)/avg_v*100:+.1f}%)")

    # Token summary
    avg_reduction = sum(r["tokens"]["reduction_pct"] for r in all_results if "tokens" in r) / len(all_results) if all_results else 0
    avg_saved = sum(r["tokens"]["tokens_saved"] for r in all_results if "tokens" in r) / len(all_results) if all_results else 0

    print(f"\nAvg token reduction: {avg_reduction:.1f}%")
    print(f"Avg tokens saved: ~{avg_saved:,.0f} per session")

    # Save report
    report_path = reports_dir / f"benchmark-full-{report_timestamp}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump({
            "reportSchemaVersion": REPORT_SCHEMA_VERSION,
            "timestamp": datetime.now().isoformat(),
            "artifactDir": str(artifact_dir),
            "summary": {
                "total_benchmarks": len(all_results),
                "vanilla_success": len(vanilla_success),
                "fooks_success": len(fooks_success),
                "avg_token_reduction": avg_reduction,
                "avg_tokens_saved": avg_saved
            },
            "notes": ROUND1_NOTES,
            "riskAssessment": assess_benchmark_risks(all_results),
            "results": all_results
        }, f, indent=2)

    print(f"\nReport saved: {report_path}")
    print("="*70)
    return 0

if __name__ == "__main__":
    sys.exit(main())
