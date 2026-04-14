#!/usr/bin/env python3
"""Quick test - T1 on shadcn-ui only, with token measurement"""

import subprocess
import os
import time
import json
from pathlib import Path
from datetime import datetime

REPOS_DIR = Path("/home/bellman/Workspace/fooks-test-repos")
FOOKS_DIR = Path("/home/bellman/Workspace/fooks")
OMX_BIN = Path("/home/bellman/Workspace/oh-my-codex/dist/cli/omx.js")

repo_path = REPOS_DIR / "ui"

def get_fooks_token_estimate(worktree_path, sample_file="apps/v4/registry/new-york-v4/ui/button.tsx"):
    """Estimate token savings from fooks compression"""
    full_path = worktree_path / sample_file
    if not full_path.exists():
        # Find any button file
        buttons = list(worktree_path.rglob("button.tsx"))
        if buttons:
            full_path = buttons[0]
        else:
            return {"raw": 0, "compressed": 0, "savings_pct": 0, "tokens_saved": 0}
    
    try:
        result = subprocess.run(
            ["node", str(FOOKS_DIR / "dist/cli/index.js"), "extract", str(full_path), "--model-payload"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            with open(full_path, 'r') as f:
                raw_size = len(f.read())
            compressed_size = len(json.dumps(data))
            savings_pct = (1 - compressed_size/raw_size) * 100 if raw_size > 0 else 0
            tokens_saved = (raw_size - compressed_size) // 4
            return {
                "raw": raw_size,
                "compressed": compressed_size,
                "savings_pct": savings_pct,
                "tokens_saved": tokens_saved
            }
    except:
        pass
    return {"raw": 0, "compressed": 0, "savings_pct": 0, "tokens_saved": 0}

def create_worktree(variant):
    timestamp = int(time.time())
    branch_name = f"quick-test-{variant}-{timestamp}"
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

def remove_worktree(worktree):
    import shutil
    if worktree["codex_home"].exists():
        shutil.rmtree(worktree["codex_home"], ignore_errors=True)
    subprocess.run(["git", "worktree", "remove", "-f", str(worktree["path"])], capture_output=True)
    subprocess.run(["git", "branch", "-D", worktree["branch"]], cwd=repo_path, capture_output=True)

def run_omx(worktree, variant, task_name, task_prompt):
    print(f"  → Running OMX {variant}...")
    start = time.time()
    
    cmd = [
        "node", str(OMX_BIN), "exec",
        "--cd", str(worktree["path"]),
        "--full-auto",
        f"Task: {task_name}\n{task_prompt}\nReport which files you modified."
    ]
    
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600,
            env={**os.environ, "CODEX_HOME": str(worktree["codex_home"])}
        )
        duration = int((time.time() - start) * 1000)
        
        # Check modified files
        files_result = subprocess.run(
            ["git", "diff", "--name-only"], cwd=worktree["path"],
            capture_output=True, text=True
        )
        files = [f for f in files_result.stdout.strip().split('\n') if f]
        
        return {
            "success": result.returncode == 0,
            "duration_ms": duration,
            "files": files,
            "output": result.stdout[-500:] if result.stdout else ""
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "duration_ms": 300000, "error": "Timeout"}
    except Exception as e:
        return {"success": False, "duration_ms": int((time.time() - start) * 1000), "error": str(e)}

print("=" * 60)
print("Hard Benchmark Test - T5: Form Validation on shadcn-ui")
print("=" * 60)

# Vanilla
print("\n[VANILLA] Creating worktree...")
wt_vanilla = create_worktree("vanilla")
print(f"  Worktree: {wt_vanilla['path']}")
print(f"  CODEX_HOME: {wt_vanilla['codex_home']}")

# Measure vanilla context (estimate from file size)
vanilla_token_est = get_fooks_token_estimate(wt_vanilla["path"])
print(f"  Est. context (raw): {vanilla_token_est['raw']:,} bytes (~{vanilla_token_est['raw'] // 4:,} tokens)")

result_vanilla = run_omx(wt_vanilla, "vanilla", "Form Validation", 
    "Find an email input field in a form component. Add email format validation that shows a red error message below the input when the email is invalid. Use useState for validation state and regex for email validation. Make sure the form still submits only when email is valid.")
print(f"  Result: {'✓' if result_vanilla['success'] else '✗'} {result_vanilla.get('duration_ms', 0):,}ms, {len(result_vanilla.get('files', []))} files")
remove_worktree(wt_vanilla)

# Wait between runs
time.sleep(3)

# Fooks
print("\n[FOOKS] Creating worktree...")
wt_fooks = create_worktree("fooks")
print(f"  Worktree: {wt_fooks['path']}")
print(f"  CODEX_HOME: {wt_fooks['codex_home']}")

# Init fooks with timing
print("  Initializing fooks...")
fooks_start = time.time()
subprocess.run(["node", str(FOOKS_DIR / "dist/cli/index.js"), "init"], 
               cwd=wt_fooks["path"], capture_output=True, timeout=30)
subprocess.run(["node", str(FOOKS_DIR / "dist/cli/index.js"), "scan"],
               cwd=wt_fooks["path"], capture_output=True, timeout=120)
fooks_scan_time = int((time.time() - fooks_start) * 1000)
print(f"  Fooks scan: {fooks_scan_time:,}ms")

# Measure fooks compression
fooks_token_est = get_fooks_token_estimate(wt_fooks["path"])
print(f"  Est. context (compressed): {fooks_token_est['compressed']:,} bytes (~{fooks_token_est['compressed'] // 4:,} tokens)")
print(f"  Compression: {fooks_token_est['savings_pct']:.1f}%, ~{fooks_token_est['tokens_saved']:,} tokens saved")

result_fooks = run_omx(wt_fooks, "fooks", "Form Validation (with fooks context)", 
    "Find an email input field in a form component. Add email format validation that shows a red error message below the input when the email is invalid. Use useState for validation state and regex for email validation. Use fooks compressed context to efficiently find form components and understand the validation patterns used in this codebase.")
print(f"  Result: {'✓' if result_fooks['success'] else '✗'} {result_fooks.get('duration_ms', 0):,}ms, {len(result_fooks.get('files', []))} files")
remove_worktree(wt_fooks)

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
v_time = result_vanilla['duration_ms']
f_omx_time = result_fooks['duration_ms']
improvement = ((v_time - f_omx_time) / v_time * 100) if v_time > 0 else 0

print(f"\n=== Time ===")
print(f"Vanilla (total):  {v_time:,}ms, {len(result_vanilla.get('files', []))} files")
print(f"Fooks scan:       {fooks_scan_time:,}ms")
print(f"Fooks OMX (exec): {f_omx_time:,}ms, {len(result_fooks.get('files', []))} files")
print(f"Fooks (total):    {fooks_scan_time + f_omx_time:,}ms")
print(f"Execution diff:   {improvement:+.1f}%")

print(f"\n=== Context Size (sample file) ===")
print(f"Raw context:      {vanilla_token_est['raw']:,} bytes (~{vanilla_token_est['raw'] // 4:,} tokens)")
print(f"Compressed:       {fooks_token_est['compressed']:,} bytes (~{fooks_token_est['compressed'] // 4:,} tokens)")
print(f"Compression:      {fooks_token_est['savings_pct']:.1f}%")
print(f"Est. tokens saved: ~{fooks_token_est['tokens_saved']:,} tokens per file")

print(f"\nCODEX isolation:  ✓ (worktree별 isolated .codex)")
