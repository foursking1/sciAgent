#!/usr/bin/env python3
"""
Helper CLI for managing the Claudeception skill locally.

Typical usage:

    python scripts/wrapper.py install --scope user
    python scripts/wrapper.py install --scope project --project-root C:\\repo
"""

import argparse
import json
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path
from typing import Optional

REPO_URL = "https://github.com/blader/Claudeception.git"
SKILL_FOLDER_NAME = "claudeception"
HOOK_SCRIPT_NAME = "claudeception-activator.sh"


def run(cmd: list[str], cwd: Optional[Path] = None) -> None:
    """Run a shell command and stream output."""
    try:
        subprocess.run(cmd, cwd=cwd, check=True)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Command {cmd[0]!r} was not found. Install it before continuing."
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"Command {' '.join(cmd)} failed with exit code {exc.returncode}"
        ) from exc


def resolve_base_dir(scope: str, project_root: Optional[str]) -> Path:
    if scope == "user":
        return Path.home() / ".claude"
    root = Path(project_root) if project_root else Path.cwd()
    return root / ".claude"


def ensure_repo(repo_url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        run(["git", "-C", str(destination), "pull", "--ff-only"])
    else:
        run(["git", "clone", repo_url, str(destination)])


def copy_hook(repo_dir: Path, hooks_dir: Path) -> Path:
    hooks_dir.mkdir(parents=True, exist_ok=True)
    src = repo_dir / "scripts" / HOOK_SCRIPT_NAME
    if not src.exists():
        raise RuntimeError(f"Hook script missing at {src}")
    dst = hooks_dir / HOOK_SCRIPT_NAME
    shutil.copy2(src, dst)
    try:
        current_mode = os.stat(dst).st_mode
        os.chmod(
            dst,
            current_mode
            | stat.S_IXUSR
            | stat.S_IXGRP
            | stat.S_IXOTH,
        )
    except OSError:
        # chmod is best-effort, especially on Windows filesystems.
        pass
    return dst


def ensure_settings(settings_path: Path, command_path: Path) -> None:
    if settings_path.exists():
        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"settings.json at {settings_path} is invalid JSON."
            ) from exc
    else:
        data = {}

    hooks = data.setdefault("hooks", {})
    user_prompt = hooks.setdefault("UserPromptSubmit", [])
    command_posix = command_path.as_posix()
    for block in user_prompt:
        for hook in block.get("hooks", []):
            if hook.get("type") == "command" and hook.get("command") == command_posix:
                settings_path.write_text(
                    json.dumps(data, indent=2), encoding="utf-8"
                )
                return

    user_prompt.append(
        {
            "hooks": [
                {
                    "type": "command",
                    "command": command_posix,
                }
            ]
        }
    )
    settings_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def install(args: argparse.Namespace) -> None:
    base_dir = resolve_base_dir(args.scope, args.project_root)
    skills_dir = base_dir / "skills"
    repo_dir = skills_dir / SKILL_FOLDER_NAME
    hooks_dir = base_dir / "hooks"
    settings_path = base_dir / "settings.json"

    print(f"Installing Claudeception into {repo_dir}")
    ensure_repo(args.repo_url, repo_dir)

    print(f"Copying hook script into {hooks_dir}")
    hook_path = copy_hook(repo_dir, hooks_dir)

    print(f"Updating {settings_path} with hook reference")
    ensure_settings(settings_path, hook_path)

    print("Claudeception installation complete.")
    print("Next: restart Codex so the hook executes on the next prompt.")


def status(args: argparse.Namespace) -> None:
    base_dir = resolve_base_dir(args.scope, args.project_root)
    repo_dir = base_dir / "skills" / SKILL_FOLDER_NAME
    hook_path = base_dir / "hooks" / HOOK_SCRIPT_NAME
    settings_path = base_dir / "settings.json"

    print(f"Base directory: {base_dir}")
    print(f"Repo present: {'yes' if repo_dir.exists() else 'no'} ({repo_dir})")
    if repo_dir.exists():
        try:
            result = subprocess.run(
                ["git", "-C", str(repo_dir), "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                check=True,
            )
            print(f"  current commit: {result.stdout.strip()}")
        except Exception:
            print("  unable to read git commit (git missing?)")

    print(f"Hook script present: {'yes' if hook_path.exists() else 'no'} ({hook_path})")
    print(f"settings.json present: {'yes' if settings_path.exists() else 'no'}")
    if settings_path.exists():
        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            user_prompt = data.get("hooks", {}).get("UserPromptSubmit", [])
            hook_found = any(
                hook.get("command") == hook_path.as_posix()
                for block in user_prompt
                for hook in block.get("hooks", [])
            )
            print(f"Hook referenced in settings.json: {'yes' if hook_found else 'no'}")
        except json.JSONDecodeError:
            print("settings.json is invalid JSON.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Manage local Claudeception installations."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    install_parser = subparsers.add_parser(
        "install", help="Clone/update the repo, copy the hook, and update settings.json"
    )
    install_parser.add_argument(
        "--scope",
        choices=["user", "project"],
        default="user",
        help="User scope installs into ~/.claude; project scope installs into <repo>/.claude",
    )
    install_parser.add_argument(
        "--project-root",
        help="Project root to use when --scope project is selected (defaults to CWD).",
    )
    install_parser.add_argument(
        "--repo-url",
        default=REPO_URL,
        help="Override the Claudeception git URL.",
    )
    install_parser.set_defaults(func=install)

    status_parser = subparsers.add_parser(
        "status", help="Show whether the repo, hook, and settings entry exist."
    )
    status_parser.add_argument(
        "--scope",
        choices=["user", "project"],
        default="user",
        help="Inspect ~/.claude (user) or <repo>/.claude (project).",
    )
    status_parser.add_argument(
        "--project-root",
        help="Project root when --scope project is selected (defaults to CWD).",
    )
    status_parser.set_defaults(func=status)

    return parser


def main(argv: Optional[list[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except RuntimeError as exc:
        print(f"[claudeception] {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
