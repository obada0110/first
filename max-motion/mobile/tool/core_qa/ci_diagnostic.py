"""Expose actionable Flutter diagnostics as a GitHub check annotation."""
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
title = sys.argv[2] if len(sys.argv) > 2 else "Flutter checks"
lines = path.read_text(errors="replace").splitlines()
patterns = re.compile(r"(^|\s)(error •|Error:|Exception:|FAIL|Failed|Target of URI|Couldn't resolve|No issues found|\[E\])", re.I)
selected = [line for line in lines if patterns.search(line)]
if not selected:
    selected = lines[-35:]
message = "\n".join(selected[-45:])[-5500:]
message = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
print(f"::error title={title}::{message}")
