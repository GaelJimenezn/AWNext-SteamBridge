"""Optional read-only regression against the local Steam/AWN installation."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, str(ROOT / 'tests'))
from test_backend import BackendTests

runner = BackendTests(methodName='test_all_lua_sources_compile')
runner.setUp()
try:
    runner.lua.globals().steam_root = os.environ.get('LC_STEAM_ROOT', 'A:/launchers/Steam').replace('\\', '/')
    service = runner.require('services.identity_service')
    library = runner.from_lua(service.library(runner.to_lua([])))
    if not library.get('ok'):
        raise RuntimeError(library.get('error', 'Identity library unavailable'))
    mwiii = next(game for game in library['games'] if game['appid'] == '3531473258')
    selected = mwiii['resolution'].get('selected', {})
    assert selected.get('id') == '3595270', mwiii['resolution']
    assert selected.get('id') != '1959007243'
    achievements = json.loads(runner.require('services.achievement_resolver').get_achievements('2545026989', ''))
    assert achievements.get('total') == 70, achievements
    assert achievements.get('unlocked') == 16, achievements
    config = runner.require('services.config_store').load().config
    icons = runner.from_lua(config.games['2545026989'].iconMap)
    assert len(icons) == 50
    print(json.dumps({'readOnly': True, 'accountSource': library.get('accountSource'), 'mwiiiShortcut': '3531473258', 'selectedAwnId': selected['id'],
                      'x360recomp': {'total': achievements['total'], 'unlocked': achievements['unlocked'], 'iconMap': len(icons)},
                      'installation': library['installation']}, indent=2))
finally:
    runner.doCleanups()
