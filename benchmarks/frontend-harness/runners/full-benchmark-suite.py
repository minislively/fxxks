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
        "variantDifference": "The fooks variant runs fooks init/scan/attach before the same agent command; vanilla does not.",
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

def changed_files(worktree_path):
    files_result = subprocess.run(
        ["git", "diff", "--name-only"], cwd=worktree_path,
        capture_output=True, text=True
    )
    return [f for f in files_result.stdout.strip().split('\n') if f]

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
            "interpretation": "Both variants use the same selected runner with isolated CODEX_HOME; fooks additionally prepares native fooks context.",
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
            "stdout_tail": output_tail(result.stdout),
            "stderr_tail": output_tail(result.stderr, 1000),
            "error": None if result.returncode == 0 else result.stderr[:200]
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "duration_ms": 600000, "files": 0, "files_list": [], "error": "Timeout"}
    except Exception as e:
        return {"success": False, "duration_ms": int((time.time() - start) * 1000), "files": 0, "files_list": [], "error": str(e)}

def run_fooks_agent(worktree, task, runner):
    """Run fooks-prepared agent runner"""
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
            "stdout_tail": output_tail(result.stdout),
            "stderr_tail": output_tail(result.stderr, 1000),
            "error": None if result.returncode == 0 else result.stderr[:200]
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "duration_ms": 600000, "scan_time": fooks_scan_time,
                "total_time": fooks_scan_time + 600000, "files": 0, "files_list": [], "error": "Timeout"}
    except Exception as e:
        return {"success": False, "duration_ms": int((time.time() - start) * 1000),
                "scan_time": fooks_scan_time, "total_time": fooks_scan_time + int((time.time() - start) * 1000),
                "files": 0, "files_list": [], "error": str(e)}

def run_benchmark(task, repo_name, runner):
    """Run full benchmark for one task on one repo"""
    print(f"\n{'='*70}")
    print(f"[{task['id']}] {task['name']} ({task['difficulty']})")
    print(f"Repo: {repo_name}")
    print(f"Runner: {runner_label(runner)}")
    print(f"{'='*70}")

    repo_path = REPOS[repo_name]
    if not repo_path.exists():
        raise FileNotFoundError(f"Repository checkout not found at {repo_path}")
    results = {"task": task['id'], "task_name": task['name'], "repo": repo_name,
               "difficulty": task['difficulty'], "timestamp": datetime.now().isoformat()}

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
            resolved_tasks.append({
                "task": task["id"],
                "task_name": task["name"],
                "repo": repo_name,
                "repo_path": str(REPOS[repo_name]),
                "repo_exists": REPOS[repo_name].exists(),
                "prompt": task["prompt"],
            })
        print(json.dumps({
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

    for task_id, repo_name in test_cases:
        task = resolve_task(task_id, args.task_prompt if (args.repo and args.task == task_id) else None)

        try:
            result = run_benchmark(task, repo_name, args.runner)
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
    report_path = reports_dir / f"benchmark-full-{int(time.time())}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
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
