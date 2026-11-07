"""Run production Lua modules with LuaJIT 2.1; Steam services are isolated mocks."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, str(ROOT / '.phase0/python'))
from lupa.luajit21 import LuaRuntime


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='library-customizer-')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.lua = LuaRuntime(unpack_returned_tuples=True)
        self.lua.globals().json_null = self.lua.eval('newproxy(true)')
        self.is_json_null = self.lua.eval('function(value) return value == json_null end')
        self.lua.execute("package.path = " + json.dumps((ROOT / 'plugin/backend/?.lua').as_posix()) + " .. ';' .. package.path")
        self.lua.globals().join_path = lambda *args: os.path.join(*args).replace('\\', '/')
        self.lua.globals().is_file = lambda p: Path(p).is_file()
        self.lua.globals().is_dir = lambda p: Path(p).is_dir()
        self.lua.globals().make_dirs = lambda p: (Path(p).mkdir(parents=True, exist_ok=True) or True)
        self.lua.globals().remove_file = lambda p: (Path(p).unlink(missing_ok=True) or True)
        self.lua.globals().make_directory = lambda p: (Path(p).mkdir() or True) if not Path(p).exists() else False
        self.lua.globals().remove_any = lambda p: (Path(p).rmdir() if Path(p).is_dir() else Path(p).unlink(missing_ok=True)) or True
        self.lua.globals().steam_root = self.base.as_posix()
        self.lua.globals().test_appdata = (self.base / 'appdata').as_posix()
        self.lua.globals().decode_json = lambda s: self.to_lua(json.loads(s))
        self.lua.globals().encode_json = lambda t: json.dumps(self.from_lua(t))
        self.lua.execute('''
            package.preload.fs = function() return {join=join_path, is_file=is_file, is_directory=is_dir, create_directories=make_dirs, create_directory=make_directory, remove=remove_any} end
            package.preload.millennium = function() return {steam_path=function() return steam_root end} end
            package.preload.http = function() return {get=function() error('Network forbidden in tests') end} end
            package.preload.utils = function() return {exec=function() error('Downloads forbidden in tests') end} end
            package.preload.logger = function() return {info=function() end,warn=function() end} end
            package.preload.json = function() return {decode=decode_json,encode=encode_json,null=json_null} end
            local getenv = os.getenv
            os.getenv = function(k) if k == 'APPDATA' then return test_appdata end return getenv(k) end
        ''')
        self.config = json.loads((ROOT / 'tests/fixtures/legacy-config.json').read_text())
        self.config['awnDataRoot'] = (self.base / 'awn').as_posix()
        self.game = self.config['games']['2545026989']
        self.game['stateRoot'] = (self.base / 'state').as_posix()
        self.old = self.base / 'millennium/plugins/org.awnext.steambridge.config.json'
        self.new = self.old.with_name('library-customizer.config.json')
        self.write(self.old, json.dumps(self.config))

    def to_lua(self, value):
        if value is None: return self.lua.globals().json_null
        if isinstance(value, dict): return self.lua.table_from({k: self.to_lua(v) for k, v in value.items()})
        if isinstance(value, list): return self.lua.table_from([self.to_lua(v) for v in value])
        return value

    def from_lua(self, value):
        if self.is_json_null(value): return None
        if hasattr(value, 'items'):
            items = dict(value.items())
            if items and all(isinstance(k, int) for k in items): return [self.from_lua(items[k]) for k in sorted(items)]
            return {k: self.from_lua(v) for k, v in items.items()}
        return value

    def write(self, path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf8')

    def require(self, name): return self.lua.eval('require')(name)

    def test_config_precedence_and_unknown_preferences(self):
        compat = self.require('services.product_compat')
        self.assertEqual(compat.config_path(), self.old.as_posix())
        self.write(self.new, json.dumps(self.config))
        self.assertEqual(compat.config_path(), self.new.as_posix())
        loaded = self.require('utils.file_reader').read_json(compat.config_path())
        self.assertTrue(loaded.unknownFutureField.keep)
        self.assertEqual(loaded.preferences.theme, 'legacy')
        self.write(self.new, '{broken')
        self.assertEqual(compat.config_path(), self.new.as_posix())
        self.assertIsNone(self.require('utils.file_reader').read_json(compat.config_path()))

    def test_secret_fallback_does_not_resurrect_after_migration(self):
        compat = self.require('services.product_compat')
        old = self.base / 'appdata/AWNext-SteamBridge/secrets/steamgriddb.bin'
        self.write(old, 'opaque-test-credential')
        self.assertEqual(compat.secret_read_path(), old.as_posix())
        new = self.base / 'appdata/library-customizer/secrets/steamgriddb.bin'
        new.parent.mkdir(parents=True)
        self.assertEqual(compat.secret_read_path(), new.as_posix())

    def test_production_toml_parser(self):
        result = self.require('parsers.toml')((ROOT / 'tests/fixtures/unlocks.toml').read_text())
        self.assertEqual(result['1'], 1700000000)
        self.assertEqual(result['2'], 0)
        self.assertEqual(result['3'], 0)
        self.assertIsNone(result['4'])

    def test_real_dpapi_credential_compatible_after_byte_copy(self):
        sgdb = self.require('services.steamgriddb')
        self.assertTrue(json.loads(sgdb.configure('fixture-key-never-sent-to-network'))['ok'])
        encrypted = (self.base / 'appdata/library-customizer/secrets/steamgriddb.bin').read_bytes()
        self.assertNotIn(b'fixture-key', encrypted)
        # A fresh runtime must decrypt the legacy path; then the copied path.
        self.setUp()
        old = self.base / 'appdata/AWNext-SteamBridge/secrets/steamgriddb.bin'
        old.parent.mkdir(parents=True)
        old.write_bytes(encrypted)
        sgdb = self.require('services.steamgriddb')
        self.assertTrue(json.loads(sgdb.status())['configured'])
        self.assertFalse(json.loads(sgdb.disconnect())['ok'])
        new = self.base / 'appdata/library-customizer/secrets/steamgriddb.bin'
        new.parent.mkdir(parents=True)
        new.write_bytes(encrypted)
        self.assertTrue(json.loads(sgdb.status())['configured'])
        self.assertTrue(json.loads(sgdb.disconnect())['ok'])
        self.assertFalse(json.loads(sgdb.status())['configured'])
        self.assertEqual(old.read_bytes(), encrypted)

    def test_x360_mapping_all_50_icons_legacy_and_new(self):
        self.assertEqual(self.game['titleId'], '4D5309C9')
        self.assertEqual(self.game['adapter'], 'x360recomp-toml')
        icon_map = self.game['iconMap']
        self.assertEqual(len(icon_map), 50)
        ids = list(icon_map)
        catalog = {'achievements': [{'achievement_id': i, 'localizations': [{'locale': {'identifier': 'en_US'}, 'name': 'Fixture ' + i, 'description': 'Fixture description'}]} for i in ids]}
        self.write(self.base / 'awn/steam_cache/x360recomp/4D5309C9.json', json.dumps(catalog))
        self.write(self.base / 'state/user/achievements/4D5309C9.toml', f'[unlocked.{ids[0]}]\nfiletime = 133444736000000000\n')
        for image_id in icon_map.values():
            path = self.base / f'awn/icon_cache/x360recomp/4D5309C9/{image_id}.png'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'\x89PNG\r\n\x1a\n' + image_id.encode())
        resolver = self.require('services.achievement_resolver')
        legacy = json.loads(resolver.get_achievements('2545026989', 'irrelevant title'))
        self.write(self.new, self.old.read_text())
        current = json.loads(resolver.get_achievements('2545026989', 'different title'))
        self.assertEqual(legacy, current)
        self.assertEqual(current['total'], 50)
        self.assertEqual(current['unlocked'], 1)
        import base64
        for row in current['achievements']:
            self.assertEqual(base64.b64decode(row['icon'].split(',')[1]), b'\x89PNG\r\n\x1a\n' + icon_map[row['id']].encode())
        self.assertTrue(json.loads(self.require('adapters.x360recomp').get_achievements('9999999999'))['notConfigured'])
        self.assertIn('error', json.loads(self.require('adapters.x360recomp').get_achievements('../unsafe')))

    def test_all_lua_sources_compile(self):
        compile_lua = self.lua.eval('function(s,n) local f,e=loadstring(s,n); if not f then error(e) end return true end')
        for path in (ROOT / 'plugin/backend').rglob('*.lua'):
            self.assertTrue(compile_lua(path.read_text(encoding='utf8'), str(path)))


if __name__ == '__main__': unittest.main(verbosity=2)
