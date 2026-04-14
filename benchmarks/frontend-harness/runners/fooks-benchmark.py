#!/usr/bin/env python3
"""
Fooks Frontend Benchmark Runner (Python version)
Uses OMX sessions for all coding work per 형님's rules
"""

import subprocess
import json
import os
import time
import shutil
import sys
from pathlib import Path
from datetime import datetime

# Auto-detect paths
SCRIPT_DIR = Path(__file__).parent.resolve()
BENCHMARK_DIR = SCRIPT_DIR.parent.resolve()
FOOKS_DIR = BENCHMARK_DIR.parent.parent.resolve()  # fooks repo root

# Test repos location (can be overridden via env var)
REPOS_DIR = Path(os.environ.get("BENCHMARK_REPOS_DIR", Path.home() / "Workspace/fooks-test-repos"))

# OMX binary (can be overridden via env var)
OMX_BIN = Path(os.environ.get("OMX_BIN", Path.home() / "Workspace/oh-my-codex/dist/cli/omx.js"))

# Verify paths
FOOKS_CLI = FOOKS_DIR / "dist/cli/index.js"
if not FOOKS_CLI.exists():
    print(f"Error: fooks CLI not found at {FOOKS_CLI}")
    print("Please build fooks first: npm run build")
    sys.exit(1)

REPOS = {
    "shadcn-ui": REPOS_DIR / "ui",
    "cal.com": REPOS_DIR / "cal.com",
    "documenso": REPOS_DIR / "documenso",
    "formbricks": REPOS_DIR / "formbricks"
}

# Task definitions matching the JSON
TASKS = [
    {
        "id": "T1",
        "name": "Button Relocation",
        "prompt": "Find the main submit/action button in the component and move it to the right side of its container using flexbox justify-end or equivalent. Make minimal changes - only move the button position.",
        "target_repos": ["shadcn-ui", "cal.com"],
        "difficulty": "easy"
    },
    {
        "id": "T2", 
        "name": "Style Modification",
        "prompt": "Locate the primary button component and change its background color to blue (bg-blue-600 or styled-components equivalent). Keep all other functionality intact.",
        "target_repos": ["shadcn-ui", "cal.com"],
        "difficulty": "easy"
    },
    {
        "id": "T3",
        "name": "Loading State Addition",
        "prompt": "Add an isLoading prop to the main button component. When true, show 'Loading...' text and disable the button. Use existing patterns in the codebase.",
        "target_repos": ["shadcn-ui", "cal.com"],
        "difficulty": "medium"
    }
]

def create_worktree(repo_name: str, task_id: str, variant: str) -> dict:
    """Create isolated git worktree for testing with .codex isolation"""
    repo_path = REPOS[repo_name]
    timestamp = int(time.time())
    branch_name = f"benchmark-{repo_name}-{task_id}-{variant}-{timestamp}"
    worktree_path = REPOS_DIR / ".worktrees" / branch_name
    codex_home = worktree_path / ".codex"
    
    try:
        subprocess.run(
            ["git", "worktree", "add", "-B", branch_name, str(worktree_path)],
            cwd=repo_path,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Create isolated .codex folder with auth and config symlinks
        codex_home.mkdir(parents=True, exist_ok=True)
        (codex_home / "auth.json").symlink_to(Path.home() / ".codex/auth.json")
        (codex_home / "config.toml").symlink_to(Path.home() / ".codex/config.toml")
        
        return {
            "success": True,
            "path": worktree_path,
            "branch": branch_name,
            "codex_home": codex_home
        }
    except subprocess.CalledProcessError as e:
        return {
            "success": False,
            "error": e.stderr
        }

def remove_worktree(worktree: dict) -> bool:
    """Clean up worktree and .codex folder"""
    try:
        # Clean up .codex folder explicitly
        codex_home = worktree.get("codex_home")
        if codex_home and codex_home.exists():
            import shutil
            shutil.rmtree(codex_home, ignore_errors=True)
        
        subprocess.run(
            ["git", "worktree", "remove", "-f", str(worktree["path"])],
            capture_output=True,
            check=True
        )
        subprocess.run(
            ["git", "branch", "-D", worktree["branch"]],
            cwd=REPOS["shadcn-ui"].parent,  # Any repo with .git
            capture_output=True,
            check=False
        )
        return True
    except:
        return False

def run_vanilla_omx(worktree: dict, task: dict) -> dict:
    """Run OMX session WITHOUT fooks (vanilla Codex)"""
    print(f"  → [VANILLA] Starting OMX session...")
    
    start_time = time.time()
    
    try:
        # Create OMX session with vanilla Codex
        # Disable fooks by not using fooks worktrees
        cmd = [
            str(OMX_BIN),
            "exec",
            "--cd", str(worktree["path"]),
            "--full-auto",
            f"""Task: {task['name']}

{task['prompt']}

Requirements:
1. Make minimal changes - only what's asked
2. Report which files you modified
3. Use existing patterns from the codebase
4. Run any available tests to verify"""
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 min timeout
            env={**os.environ, "CODEX_HOME": str(worktree["codex_home"])}
        )
        
        duration = int((time.time() - start_time) * 1000)
        
        # Check what files were modified
        try:
            files_result = subprocess.run(
                ["git", "diff", "--name-only"],
                cwd=worktree["path"],
                capture_output=True,
                text=True
            )
            files_modified = [f for f in files_result.stdout.strip().split('\n') if f]
        except:
            files_modified = []
        
        return {
            "success": result.returncode == 0,
            "duration_ms": duration,
            "files_modified": len(files_modified),
            "files_list": files_modified,
            "stdout": result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout,
            "stderr": result.stderr[-500:] if result.stderr else ""
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "duration_ms": 600000,
            "error": "Timeout after 10 minutes"
        }
    except Exception as e:
        return {
            "success": False,
            "duration_ms": int((time.time() - start_time) * 1000),
            "error": str(e)
        }

def run_fooks_omx(worktree: dict, task: dict) -> dict:
    """Run OMX session WITH fooks enabled"""
    print(f"  → [FOOKS] Starting OMX session with fooks...")
    
    start_time = time.time()
    
    try:
        # Initialize fooks first
        fooks_init = subprocess.run(
            ["node", str(FOOKS_CLI), "init"],
            cwd=worktree["path"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        # Run fooks scan
        fooks_scan = subprocess.run(
            ["node", str(FOOKS_CLI), "scan"],
            cwd=worktree["path"],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # Now run OMX with fooks context
        cmd = [
            str(OMX_BIN),
            "exec", 
            "--cd", str(worktree["path"]),
            "--full-auto",
            f"""Task: {task['name']} (with fooks context)

{task['prompt']}

The codebase has been scanned with fooks. Use the compressed context 
to understand the component structure efficiently.

Requirements:
1. Make minimal changes - only what's asked  
2. Report which files you modified
3. Use existing patterns from the codebase
4. Run any available tests to verify"""
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            env={**os.environ, "CODEX_HOME": str(worktree["codex_home"])}
        )
        
        duration = int((time.time() - start_time) * 1000)
        
        # Check what files were modified
        try:
            files_result = subprocess.run(
                ["git", "diff", "--name-only"],
                cwd=worktree["path"],
                capture_output=True,
                text=True
            )
            files_modified = [f for f in files_result.stdout.strip().split('\n') if f]
        except:
            files_modified = []
        
        return {
            "success": result.returncode == 0,
            "duration_ms": duration,
            "files_modified": len(files_modified),
            "files_list": files_modified,
            "fooks_init": fooks_init.returncode == 0,
            "fooks_scan": fooks_scan.returncode == 0,
            "stdout": result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout,
            "stderr": result.stderr[-500:] if result.stderr else ""
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "duration_ms": 600000,
            "error": "Timeout after 10 minutes"
        }
    except Exception as e:
        return {
            "success": False,
            "duration_ms": int((time.time() - start_time) * 1000),
            "error": str(e)
        }

def run_benchmark(task: dict, repo_name: str, variant: str) -> dict:
    """Run a single benchmark"""
    print(f"\n{'='*60}")
    print(f"Benchmark: {task['id']} - {task['name']} ({variant.upper()})")
    print(f"Repo: {repo_name}")
    print(f"{'='*60}")
    
    # Create worktree
    print(f"  Creating worktree...")
    worktree = create_worktree(repo_name, task["id"], variant)
    
    if not worktree["success"]:
        print(f"  ✗ Failed to create worktree: {worktree.get('error', 'unknown')}")
        return None
    
    print(f"  ✓ Worktree: {worktree['path']}")
    print(f"  ✓ CODEX_HOME: {worktree['codex_home']}")
    
    # Run appropriate variant
    if variant == "vanilla":
        result = run_vanilla_omx(worktree, task)
    else:
        result = run_fooks_omx(worktree, task)
    
    # Cleanup
    print(f"  Cleaning up worktree...")
    remove_worktree(worktree)
    
    # Display results
    if result["success"]:
        print(f"  ✓ SUCCESS: {result['duration_ms']}ms, {result['files_modified']} files")
    else:
        print(f"  ✗ FAILED: {result.get('error', 'unknown error')}")
    
    return {
        "task_id": task["id"],
        "task_name": task["name"],
        "repo": repo_name,
        "variant": variant,
        "timestamp": datetime.now().isoformat(),
        **result
    }

def generate_report(results: list):
    """Generate comparison report"""
    print(f"\n{'='*60}")
    print("BENCHMARK COMPLETE - Generating Report")
    print(f"{'='*60}")
    
    vanilla = [r for r in results if r and r.get("variant") == "vanilla"]
    fooks = [r for r in results if r and r.get("variant") == "fooks"]
    
    vanilla_success = [r for r in vanilla if r.get("success")]
    fooks_success = [r for r in fooks if r.get("success")]
    
    # Calculate metrics
    def calc_avg(data, key):
        if not data:
            return 0
        return sum(r.get(key, 0) for r in data) / len(data)
    
    report = {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "total_tasks": len(results),
            "vanilla": {
                "runs": len(vanilla),
                "success": len(vanilla_success),
                "success_rate": len(vanilla_success) / len(vanilla) if vanilla else 0,
                "avg_duration_ms": calc_avg(vanilla_success, "duration_ms"),
                "avg_files_modified": calc_avg(vanilla_success, "files_modified")
            },
            "fooks": {
                "runs": len(fooks),
                "success": len(fooks_success),
                "success_rate": len(fooks_success) / len(fooks) if fooks else 0,
                "avg_duration_ms": calc_avg(fooks_success, "duration_ms"),
                "avg_files_modified": calc_avg(fooks_success, "files_modified")
            }
        },
        "results": results
    }
    
    # Calculate improvement
    v_avg = report["summary"]["vanilla"]["avg_duration_ms"]
    f_avg = report["summary"]["fooks"]["avg_duration_ms"]
    if v_avg > 0:
        time_improvement = ((v_avg - f_avg) / v_avg) * 100
    else:
        time_improvement = 0
    
    # Save report
    report_path = BASE_DIR / "reports" / f"benchmark-{int(time.time())}.json"
    report_path.parent.mkdir(exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary table
    print("\n## Summary\n")
    print(f"{'Metric':<20} {'Vanilla':<15} {'Fooks':<15} {'Improvement':<15}")
    print("-" * 70)
    print(f"{'Success Rate':<20} {report['summary']['vanilla']['success_rate']:.0%}{'':<10} {report['summary']['fooks']['success_rate']:.0%}{'':<10} -")
    print(f"{'Avg Duration':<20} {v_avg:.0f}ms{'':<8} {f_avg:.0f}ms{'':<8} {time_improvement:+.1f}%")
    print(f"{'Avg Files Modified':<20} {report['summary']['vanilla']['avg_files_modified']:.1f}{'':<12} {report['summary']['fooks']['avg_files_modified']:.1f}")
    
    print(f"\n📊 Report saved: {report_path}")
    
    return report

def main():
    print("="*60)
    print("Fooks Frontend Benchmark - OMX Session Mode")
    print("="*60)
    print(f"OMX binary: {OMX_BIN}")
    print(f"FOOKS dir: {FOOKS_DIR}")
    print("="*60)
    
    # Verify OMX is available
    if not OMX_BIN.exists():
        print(f"\n✗ ERROR: omx not found at {OMX_BIN}")
        print("Please ensure omx is installed and in PATH")
        return
    
    results = []
    
    # Run limited benchmark (1-2 tasks for testing)
    test_tasks = TASKS[:2]  # Limit to 2 tasks for testing
    
    for task in test_tasks:
        for repo in task["target_repos"][:1]:  # Limit to 1 repo per task
            # Vanilla first
            result = run_benchmark(task, repo, "vanilla")
            if result:
                results.append(result)
            
            time.sleep(2)  # Cool down between runs
            
            # Fooks
            result = run_benchmark(task, repo, "fooks")
            if result:
                results.append(result)
            
            time.sleep(3)  # Cool down between tasks
    
    # Generate report
    report = generate_report(results)
    
    print("\n" + "="*60)
    print("Benchmark complete!")
    print("="*60)

if __name__ == "__main__":
    main()
