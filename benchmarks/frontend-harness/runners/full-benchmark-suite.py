#!/usr/bin/env python3
"""Full benchmark suite - T1 to T5 on multiple repos"""

import subprocess
import os
import time
import json
import shutil
from pathlib import Path
from datetime import datetime

REPOS_DIR = Path("/home/bellman/Workspace/fooks-test-repos")
FOOKS_DIR = Path("/home/bellman/Workspace/fooks")
OMX_BIN = Path("/home/bellman/Workspace/oh-my-codex/dist/cli/omx.js")

# Test configuration
REPOS = {
    "shadcn-ui": REPOS_DIR / "ui",
    "cal.com": REPOS_DIR / "cal.com",
    "documenso": REPOS_DIR / "documenso",
    "formbricks": REPOS_DIR / "formbricks"
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
    "T1": ["shadcn-ui", "cal.com"],
    "T2": ["shadcn-ui", "cal.com"],
    "T3": ["shadcn-ui", "cal.com"],
    "T4": ["shadcn-ui", "documenso"],
    "T5": ["shadcn-ui", "cal.com"]
}

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
                ["node", str(FOOKS_DIR / "dist/cli/index.js"), "extract", str(f), "--model-payload"],
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
        "reduction_pct": (1 - estimated_compressed/estimated_raw) * 100 if estimated_raw > 0 else 0
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
    try:
        if worktree["codex_home"].exists():
            shutil.rmtree(worktree["codex_home"], ignore_errors=True)
        subprocess.run(["git", "worktree", "remove", "-f", str(worktree["path"])], capture_output=True)
        subprocess.run(["git", "branch", "-D", worktree["branch"]], cwd=repo_path, capture_output=True)
    except:
        pass

def run_vanilla_omx(worktree, task):
    """Run vanilla OMX"""
    start = time.time()
    
    cmd = [
        "node", str(OMX_BIN), "exec",
        "--cd", str(worktree["path"]),
        "--full-auto",
        f"Task: {task['name']}\n{task['prompt']}"
    ]
    
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600,
            env={**os.environ, "CODEX_HOME": str(worktree["codex_home"])}
        )
        duration = int((time.time() - start) * 1000)
        
        files_result = subprocess.run(
            ["git", "diff", "--name-only"], cwd=worktree["path"],
            capture_output=True, text=True
        )
        files = [f for f in files_result.stdout.strip().split('\n') if f]
        
        return {
            "success": result.returncode == 0,
            "duration_ms": duration,
            "files": len(files),
            "error": None if result.returncode == 0 else result.stderr[:200]
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "duration_ms": 600000, "files": 0, "error": "Timeout"}
    except Exception as e:
        return {"success": False, "duration_ms": int((time.time() - start) * 1000), "files": 0, "error": str(e)}

def run_fooks_omx(worktree, task):
    """Run fooks + OMX"""
    # Init fooks
    fooks_start = time.time()
    try:
        subprocess.run(["node", str(FOOKS_DIR / "dist/cli/index.js"), "init"],
                       cwd=worktree["path"], capture_output=True, timeout=30)
        subprocess.run(["node", str(FOOKS_DIR / "dist/cli/index.js"), "scan"],
                       cwd=worktree["path"], capture_output=True, timeout=120)
        fooks_scan_time = int((time.time() - fooks_start) * 1000)
    except:
        fooks_scan_time = 0
    
    # Run OMX
    start = time.time()
    cmd = [
        "node", str(OMX_BIN), "exec",
        "--cd", str(worktree["path"]),
        "--full-auto",
        f"Task: {task['name']} (with fooks context)\n{task['prompt']}"
    ]
    
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600,
            env={**os.environ, "CODEX_HOME": str(worktree["codex_home"])}
        )
        duration = int((time.time() - start) * 1000)
        
        files_result = subprocess.run(
            ["git", "diff", "--name-only"], cwd=worktree["path"],
            capture_output=True, text=True
        )
        files = [f for f in files_result.stdout.strip().split('\n') if f]
        
        return {
            "success": result.returncode == 0,
            "duration_ms": duration,
            "scan_time": fooks_scan_time,
            "total_time": fooks_scan_time + duration,
            "files": len(files),
            "error": None if result.returncode == 0 else result.stderr[:200]
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "duration_ms": 600000, "scan_time": fooks_scan_time, 
                "total_time": fooks_scan_time + 600000, "files": 0, "error": "Timeout"}
    except Exception as e:
        return {"success": False, "duration_ms": int((time.time() - start) * 1000),
                "scan_time": fooks_scan_time, "total_time": fooks_scan_time + int((time.time() - start) * 1000),
                "files": 0, "error": str(e)}

def run_benchmark(task, repo_name):
    """Run full benchmark for one task on one repo"""
    print(f"\n{'='*70}")
    print(f"[{task['id']}] {task['name']} ({task['difficulty']})")
    print(f"Repo: {repo_name}")
    print(f"{'='*70}")
    
    repo_path = REPOS[repo_name]
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
    res_v = run_vanilla_omx(wt_v, task)
    remove_worktree(wt_v, repo_path)
    results["vanilla"] = res_v
    print(f"    {'✓' if res_v['success'] else '✗'} {res_v['duration_ms']:,}ms, {res_v['files']} files")
    if res_v['error']:
        print(f"    Error: {res_v['error'][:100]}")
    
    time.sleep(3)
    
    # Fooks
    print("\n  [FOOKS] Running...")
    wt_f = create_worktree(repo_path, task['id'], "fooks")
    res_f = run_fooks_omx(wt_f, task)
    remove_worktree(wt_f, repo_path)
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
    print("="*70)
    print("Fooks Full Benchmark Suite")
    print("="*70)
    print(f"Start time: {datetime.now().isoformat()}")
    print(f"Tasks: T1-T5")
    print(f"Repos: shadcn-ui, cal.com, documenso, formbricks")
    print(f"Variants: Vanilla vs Fooks (with token estimates)")
    print("="*70)
    
    all_results = []
    
    # Run selected task-repo combinations
    test_cases = [
        ("T1", "shadcn-ui"),  # Button Relocation
        ("T2", "shadcn-ui"),  # Style Modification
        ("T5", "shadcn-ui"),  # Form Validation (hard)
        ("T1", "cal.com"),    # Button on large repo
        ("T5", "cal.com"),    # Form Validation on large repo
    ]
    
    for task_id, repo_name in test_cases:
        task = next((t for t in TASKS if t['id'] == task_id), None)
        if not task:
            continue
        
        try:
            result = run_benchmark(task, repo_name)
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
    report_path = Path("/home/bellman/Workspace/fooks-benchmark-harness/reports") / f"benchmark-full-{int(time.time())}.json"
    report_path.parent.mkdir(exist_ok=True)
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
            "results": all_results
        }, f, indent=2)
    
    print(f"\nReport saved: {report_path}")
    print("="*70)

if __name__ == "__main__":
    main()
