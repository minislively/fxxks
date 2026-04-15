#!/usr/bin/env python3
"""Setup script for fooks benchmark harness - prepares environment"""

import subprocess
import sys
from pathlib import Path

def check_command(cmd, name):
    """Check if command is available"""
    result = subprocess.run(["which", cmd], capture_output=True)
    if result.returncode != 0:
        print(f"❌ {name} not found. Please install {name} first.")
        return False
    print(f"✓ {name} found")
    return True

def check_fooks():
    """Check fooks CLI"""
    fooks_cli = Path(__file__).parent.parent.parent.parent / "dist/cli/index.js"
    if not fooks_cli.exists():
        print(f"❌ fooks CLI not found at {fooks_cli}")
        print("   Please build fooks first: npm run build")
        return False
    print(f"✓ fooks CLI found")
    return True

def check_omx():
    """Check oh-my-codex"""
    # Try to find omx in PATH
    result = subprocess.run(["which", "omx"], capture_output=True)
    if result.returncode == 0:
        print(f"✓ omx found in PATH")
        return True
    
    # Check common locations
    home = Path.home()
    possible_paths = [
        home / "Workspace/oh-my-codex/dist/cli/omx.js",
        home / ".nvm/versions/node/*/bin/omx",
    ]
    
    for p in possible_paths:
        if p.exists() or list(p.parent.glob(p.name)):
            print(f"✓ omx found at {p}")
            return True
    
    print("❌ omx not found. Please install oh-my-codex:")
    print("   git clone https://github.com/minislively/oh-my-codex ~/Workspace/oh-my-codex")
    print("   cd ~/Workspace/oh-my-codex && npm install && npm run build")
    return False

def check_test_repos():
    """Check if test repos are cloned"""
    test_repos_dir = Path.home() / "Workspace/fooks-test-repos"
    
    if not test_repos_dir.exists():
        print(f"❌ Test repos directory not found at {test_repos_dir}")
        print("   Creating directory and cloning repos...")
        test_repos_dir.mkdir(parents=True, exist_ok=True)
        
        repos = [
            ("shadcn-ui/ui", "ui"),
            ("calcom/cal.com", "cal.com"),
            ("documenso/documenso", "documenso"),
            ("formbricks/formbricks", "formbricks"),
            ("vercel/next.js", "nextjs"),
            ("tailwindlabs/tailwindcss", "tailwindcss"),
        ]
        
        for repo, name in repos:
            print(f"\n   Cloning {name}...")
            subprocess.run(
                ["gh", "repo", "clone", repo, str(test_repos_dir / name), "--", "--depth", "1"],
                capture_output=True
            )
        return False
    
    # Check individual repos
    required = ["ui", "cal.com", "documenso", "formbricks", "nextjs", "tailwindcss"]
    missing = []
    for repo in required:
        if not (test_repos_dir / repo).exists():
            missing.append(repo)
    
    if missing:
        print(f"⚠️  Missing repos: {', '.join(missing)}")
        print(f"   Clone them manually or run setup again")
        return False
    
    print(f"✓ Test repos found at {test_repos_dir}")
    return True

def check_codex_auth():
    """Check Codex authentication"""
    codex_home = Path.home() / ".codex"
    auth_json = codex_home / "auth.json"
    config_toml = codex_home / "config.toml"
    
    if not auth_json.exists():
        print(f"❌ Codex auth not found. Run 'codex login' first.")
        return False
    
    if not config_toml.exists():
        print(f"⚠️  Codex config.toml not found. Using defaults.")
    else:
        # Check for base_url config
        content = config_toml.read_text()
        if "openai_base_url" in content:
            print(f"✓ Codex config with custom base_url found")
        else:
            print(f"✓ Codex config found (using default API)")
    
    return True

def main():
    print("="*60)
    print("Fooks Benchmark Harness - Environment Setup Check")
    print("="*60)
    
    checks = [
        ("Git", lambda: check_command("git", "git")),
        ("Node.js", lambda: check_command("node", "node")),
        ("npm", lambda: check_command("npm", "npm")),
        ("Python 3", lambda: check_command("python3", "python3")),
        ("gh CLI", lambda: check_command("gh", "gh CLI")),
        ("fooks CLI", check_fooks),
        ("oh-my-codex", check_omx),
        ("Test Repositories", check_test_repos),
        ("Codex Auth", check_codex_auth),
    ]
    
    results = []
    for name, check_fn in checks:
        print(f"\nChecking {name}...")
        results.append((name, check_fn()))
    
    print("\n" + "="*60)
    print("Setup Check Summary")
    print("="*60)
    
    all_passed = True
    for name, passed in results:
        status = "✓ PASS" if passed else "❌ FAIL"
        print(f"{name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "="*60)
    if all_passed:
        print("✅ All checks passed! Ready to run benchmarks.")
        print("\nRun a quick test:")
        print("  cd runners && python3 quick-test.py")
        return 0
    else:
        print("❌ Some checks failed. Fix issues above before running benchmarks.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
