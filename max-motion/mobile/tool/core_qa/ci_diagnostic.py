"""Expose actionable Flutter/emulator diagnostics as a GitHub check annotation."""
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
title = sys.argv[2] if len(sys.argv) > 2 else "Flutter checks"
lines = path.read_text(errors="replace").splitlines()
markers = re.compile(
    r"error •|Error:|Exception|Expected:|Actual:|AssertionError|TestFailure|"
    r"Caused by|FAILED|FAILURE|NoSuchMethod|NoSuchField|Timed out|"
    r"PlatformException|SocketException|StateError|FlutterError",
    re.I,
)
selected: set[int] = set()
for index, line in enumerate(lines):
    if markers.search(line):
        selected.update(range(max(0, index - 3), min(len(lines), index + 7)))
if selected:
    excerpt = [lines[index] for index in sorted(selected)]
else:
    excerpt = lines[-80:]
message = "\n".join(excerpt)[-6000:]
message = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
print(f"::error title={title}::{message}")
