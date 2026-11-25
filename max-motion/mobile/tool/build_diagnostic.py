"""Show the Gradle failure in CI's Checks UI, not just the downloadable job log."""
from pathlib import Path
import sys

lines = Path(sys.argv[1]).read_text(errors='replace').splitlines()
start = next((i for i, line in enumerate(lines) if '* What went wrong:' in line), None)
message = '\n'.join(lines[max(start - 5, 0):start + 25] if start is not None else lines[-30:])
message = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
print('::error title=Android build::' + message)
