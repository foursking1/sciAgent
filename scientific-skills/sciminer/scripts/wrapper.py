#!/usr/bin/env python3
"""Minimal local wrapper metadata for the in-project sciminer skill."""

from __future__ import annotations

import json


def main() -> None:
    payload = {
        "skill": "sciminer",
        "repo": "https://github.com/foursking1/sciminer",
        "commands": [
            "/extract <path> [schema]",
            "/extract <path> [schema] --parallel N",
            "/schema-creator",
            "document-ingestion",
        ],
        "note": "This wrapper is a local metadata shim so the project can bind data-extraction mode to the bundled sciminer skill.",
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
