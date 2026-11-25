"""Independent standard-schema check: pip install 'jsonschema>=4,<5' then run here or from root."""
import copy
import json
from pathlib import Path
from jsonschema import Draft202012Validator

root = Path(__file__).resolve().parents[1]
schema = json.loads((root/'schema/project-v1.json').read_text())
project = json.loads((root/'fixtures/project.json').read_text())
Draft202012Validator.check_schema(schema)
validate = Draft202012Validator(schema)
validate.validate(project)
for path, value in [
    (['schemaVersion'], 2), (['canvas', 'width'], 20), (['fps', 'den'], 0),
    (['revision'], -1), (['mainTrack', 'clips'], []),
    (['mainTrack', 'clips', 0, 'inUs'], '0'), (['layers', 0, 'color'], 'blue'),
    (['layers', 1, 'kind'], 'audio'), (['layers', 1, 'unknown'], True),
    (['mainTrack','clips',1,'effects','light','exposure'], 400),
]:
    bad = copy.deepcopy(project)
    target = bad
    for part in path[:-1]:
        target = target[part]
    target[path[-1]] = value
    assert not validate.is_valid(bad), path
print('PASS JSON Schema 2020-12: metaschema, valid project, 10 negative mutations.')
