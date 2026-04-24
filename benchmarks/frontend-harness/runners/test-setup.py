#!/usr/bin/env python3
"""Quick validation test for benchmark setup"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
OMX_BIN = Path(os.environ.get("OMX_BIN", REPO_ROOT.parent / "oh-my-codex" / "dist" / "cli" / "omx.js"))
FOOKS_DIR = Path(os.environ.get("FOOKS_DIR", REPO_ROOT))
REPOS_DIR = Path(os.environ.get("FOOKS_TEST_REPOS_DIR", REPO_ROOT.parent / "fooks-test-repos"))

def check_omx():
    """Test OMX can be invoked"""
    print("=== Testing OMX ===")
    try:
        result = subprocess.run(
            ["node", str(OMX_BIN), "--help"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print("  ✓ OMX help works")
            return True
        else:
            print(f"  ✗ OMX failed: {result.stderr[:200]}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def check_fooks():
    """Test fooks CLI"""
    print("\n=== Testing Fooks ===")
    fooks_cli = FOOKS_DIR / "dist/cli/index.js"
    if not fooks_cli.exists():
        print(f"  ✗ fooks CLI not found")
        return False
    
    try:
        result = subprocess.run(
            ["node", str(fooks_cli)],
            capture_output=True,
            text=True,
            timeout=5
        )
        if "Usage:" in result.stderr or result.returncode == 0:
            print("  ✓ fooks CLI works")
            return True
        else:
            print(f"  ✗ fooks failed: {result.stderr[:200]}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def check_repos():
    """Check test repos exist"""
    print("\n=== Testing Repos ===")
    repos = {
        "shadcn-ui": REPOS_DIR / "ui",
        "cal.com": REPOS_DIR / "cal.com",
        "documenso": REPOS_DIR / "documenso",
        "formbricks": REPOS_DIR / "formbricks",
        "nextjs": REPOS_DIR / "nextjs",
        "tailwindcss": REPOS_DIR / "tailwindcss",
    }
    
    all_ok = True
    for name, path in repos.items():
        if path.exists():
            # Check git repo
            git_dir = path / ".git"
            if git_dir.exists() or (path / ".git").is_symlink():
                print(f"  ✓ {name}: git repo OK")
            else:
                print(f"  ⚠ {name}: exists but no .git (worktree OK)")
        else:
            print(f"  ✗ {name}: NOT FOUND")
            all_ok = False
    
    return all_ok

def test_worktree_creation():
    """Test we can create and remove a worktree"""
    print("\n=== Testing Worktree Creation ===")
    
    # Use shadcn-ui as test
    repo_path = REPOS_DIR / "ui"
    if not repo_path.exists():
        print("  ✗ No repo to test with")
        return False
    
    try:
        # Create worktree
        result = subprocess.run(
            ["git", "worktree", "add", "-B", "test-benchmark", "/tmp/test-benchmark-worktree"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            print(f"  ✗ Failed to create worktree: {result.stderr[:200]}")
            return False
        
        print("  ✓ Created test worktree")
        
        # Remove worktree
        subprocess.run(
            ["git", "worktree", "remove", "-f", "/tmp/test-benchmark-worktree"],
            capture_output=True,
            timeout=5
        )
        subprocess.run(
            ["git", "branch", "-D", "test-benchmark"],
            cwd=repo_path,
            capture_output=True,
            timeout=5
        )
        
        print("  ✓ Cleaned up worktree")
        return True
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    print("="*60)
    print("Benchmark Setup Validation")
    print("="*60)
    
    checks = [
        ("OMX", check_omx()),
        ("Fooks", check_fooks()),
        ("Repos", check_repos()),
        ("Worktree", test_worktree_creation())
    ]
    
    print("\n" + "="*60)
    print("Validation Summary")
    print("="*60)
    
    all_passed = True
    for name, passed in checks:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n✓ All checks passed! Ready to run benchmark.")
        return 0
    else:
        print("\n✗ Some checks failed. Fix issues before running benchmark.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
