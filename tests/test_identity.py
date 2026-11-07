import json
from pathlib import Path
import struct
import unittest
import test_backend as backend_tests
ROOT = backend_tests.ROOT


def vdf_string(key, value):
    return b'\x01' + key.encode() + b'\0' + value.encode() + b'\0'


def vdf(shortcuts):
    result = b'\x00shortcuts\0'
    for i, shortcut in enumerate(shortcuts):
        result += b'\x00' + str(i).encode() + b'\0'
        result += b'\x02appid\0' + struct.pack('<I', int(shortcut['appid']))
        result += vdf_string('AppName', shortcut['name'])
        result += vdf_string('Exe', shortcut.get('exe', ''))
        result += vdf_string('StartDir', shortcut.get('startDir', ''))
        result += vdf_string('LaunchOptions', shortcut.get('launchOptions', '')) + b'\x08'
    return result + b'\x08\x08'


class IdentityTests(backend_tests.BackendTests):
    def setUp(self):
        super().setUp()
        self.fixture = json.loads((ROOT / 'tests/fixtures/mwiii-identity.json').read_text(encoding='utf8'))
        self.write(self.base / 'config/loginusers.vdf', '"users" { "76561197960265729" { "MostRecent" "1" } }')
        self.write(self.base / 'millennium/config/config.json', json.dumps({'plugins': {'enabledPlugins': ['library-customizer']}}))
        self.shortcuts_path = self.base / 'userdata/1/config/shortcuts.vdf'
        self.shortcuts_path.parent.mkdir(parents=True)
        self.shortcuts_path.write_bytes(vdf([self.fixture['shortcut'], {'appid':'2545026989','name':'Pinyon Fixture'}]))
        self.require('services.steam_shortcuts').registry_account = lambda: None

    def match(self, shortcut=None, candidates=None, manual=None):
        value = self.require('services.game_identity').resolve(self.to_lua(shortcut or self.fixture['shortcut']), self.to_lua(candidates if candidates is not None else self.fixture['candidates']), None if manual is None else self.to_lua(manual))
        return self.from_lua(value)

    def state(self): return self.require('services.config_store').load()

    def save(self, providers=None, **kwargs):
        data = {'accountId':'1', 'appid':'3531473258', 'token':self.state().token,
                'entry':{'achievementMode':'auto','providers':providers or {}}}
        data.update(kwargs)
        return self.from_lua(self.require('services.identity_service').save(self.to_lua(data)))

    def test_mwiii_shared_executable_cannot_select_mwii(self):
        result = self.match()
        self.assertEqual(result['selected']['id'], '3595270')
        wrong = next(c for c in result['candidates'] if c['id']=='1959007243')
        self.assertFalse(wrong['eligible'])
        self.assertIn('installment_or_year_mismatch', wrong['blockers'])
        self.assertIn('executable_path', wrong['reasons'])
        self.assertEqual(self.match(candidates=[self.fixture['candidates'][0]])['status'], 'conflict')
        self.assertEqual(self.match(shortcut={**self.fixture['shortcut'],'name':'MWIII'})['selected']['id'],'3595270')

    def test_ambiguity_and_manual_override_are_explicit(self):
        candidate = self.fixture['candidates'][1]
        duplicate = {**candidate, 'source':'Other source'}
        self.assertEqual(self.match(candidates=[candidate,duplicate])['status'], 'ambiguous')
        self.assertEqual(self.match(candidates=[candidate,duplicate], manual={'id':'3595270'})['status'], 'ambiguous')
        result = self.match(candidates=[candidate,duplicate], manual={'id':'3595270','source':'GBE Fork'})
        self.assertEqual(result['status'], 'manual')
        explicit = self.match(manual={'id':'1959007243','source':'Xbox PC'})
        self.assertEqual(explicit['status'], 'manual')
        self.assertIn('title_mismatch', explicit['warnings'])

    def test_normalization_paths_editions_origin_and_ids(self):
        engine = self.require('services.game_identity')
        self.assertEqual(engine.normalize('Árbol™ café'), engine.normalize('arbol cafe'))
        self.assertEqual(engine.normalize('cafe\u0301'), 'cafe')
        self.assertNotEqual(engine.normalize('東京'), engine.normalize('大阪'))
        self.assertEqual(engine.path('"D:\\Games\\Test\\.\\test.exe"'), 'd:/games/test/test.exe')
        self.assertEqual(engine.shortcut_id(-763494038), '3531473258')
        self.assertIsNone(engine.shortcut_id('3595270'))
        candidate={'id':'x','name':'Game Deluxe','provider':'awn','source':'GOG'}
        result=self.match(shortcut={'name':'Game','origin':'Steam'},candidates=[candidate])
        # Matching core title retains explicit blockers rather than selecting a different edition.
        self.assertEqual(result['status'],'conflict')
        self.assertIn('edition_mismatch',result['candidates'][0]['blockers'])
        self.assertIn('origin_mismatch',result['candidates'][0]['blockers'])
        selected_edition=self.match(shortcut={'name':'Game','edition':'Deluxe Edition','origin':'GOG'},candidates=[candidate])
        self.assertEqual(selected_edition['status'],'matched')
        wrong_id=self.match(shortcut={**self.fixture['shortcut'],'steamId':'123'},candidates=[{**self.fixture['candidates'][1],'steamId':'456'}])
        self.assertEqual(wrong_id['status'],'conflict')
        no_title=self.match(shortcut={**self.fixture['shortcut'],'name':''})
        self.assertNotIn('selected',no_title)
        explicit=self.match(shortcut={'name':'','steamId':'3595270'},candidates=[{**self.fixture['candidates'][1],'steamId':'3595270'}])
        self.assertEqual(explicit['selected']['id'],'3595270')

    def test_steam_and_sgdb_references_do_not_cross_namespaces(self):
        self.assertTrue(self.save({'steamgriddb':{'id':'900'}})['ok'])
        service=self.require('services.identity_service')
        sgdb=service.provider(self.to_lua({'appid':'3531473258','provider':'steamgriddb','candidates':[{'id':900,'name':'Different artwork title'}]}))
        self.assertEqual(sgdb.resolution.status,'manual')
        steam=service.provider(self.to_lua({'appid':'3531473258','provider':'steam','candidates':[{'id':3595270,'name':self.fixture['shortcut']['name']}]}))
        self.assertEqual(steam.resolution.status,'matched')
        self.assertEqual(steam.resolution.selected.id,'3595270')

    def test_migration_is_lazy_backed_up_and_preserves_all_unknown_data(self):
        self.config['preferences']['emptyList']=[]
        self.config['preferences']['emptyObject']={}
        self.config['preferences']['unset']=None
        self.config['preferences']['largeInteger']=9007199254740993
        self.write(self.old,json.dumps(self.config))
        original=self.old.read_bytes()
        state=self.state()
        self.assertTrue(state.needsMigration)
        self.assertFalse(self.new.exists())
        result=self.save({'awn':{'id':'3595270','source':'GBE Fork'},'steam':{'id':'3595270'},'steamgriddb':{'id':'900'},'retro':{'id':'700'}})
        self.assertTrue(result['ok'],result)
        config=json.loads(self.new.read_text())
        self.assertEqual(config['schemaVersion'],1)
        self.assertEqual(config['revision'],1)
        self.assertEqual(config['games']['2545026989']['iconMap'],self.game['iconMap'])
        self.assertEqual(len(config['games']['2545026989']['iconMap']),50)
        self.assertTrue(config['unknownFutureField']['keep'])
        self.assertEqual(config['preferences']['theme'],'legacy')
        self.assertEqual(config['preferences']['emptyList'],[])
        self.assertEqual(config['preferences']['emptyObject'],{})
        self.assertIsNone(config['preferences']['unset'])
        self.assertEqual(config['preferences']['largeInteger'],9007199254740993)
        self.assertEqual(self.old.read_bytes(),original)
        self.assertEqual(Path(str(self.new)+'.bak').read_bytes(),original)
        refs=config['identities']['1:shortcut:3531473258']['providers']
        self.assertEqual(refs['steamgriddb']['id'],'900')
        self.assertEqual(refs['awn']['id'],'3595270')

    def test_stale_token_account_switch_and_lock_do_not_overwrite(self):
        token=self.state().token
        self.assertTrue(self.save()['ok'])
        before=self.new.read_bytes()
        self.assertTrue(self.save(token=token)['conflict'])
        self.assertEqual(self.new.read_bytes(),before)
        self.assertFalse(self.save(accountId='2')['ok'])
        lock=Path(str(self.new)+'.lock');lock.mkdir()
        self.assertFalse(self.save()['ok'])
        self.assertEqual(self.new.read_bytes(),before)
        lock.rmdir()

    def test_write_failure_preserves_original_and_recovery_keeps_corrupt_bytes(self):
        store=self.require('services.config_store')
        atomic=self.require('utils.atomic_file')
        real_write=atomic.write
        self.lua.globals().real_write=real_write
        self.lua.globals().target_path=self.new.as_posix()
        self.lua.execute('require("utils.atomic_file").write=function(p,b) if p==target_path then return nil,"simulated disk failure" end return real_write(p,b) end')
        original=self.old.read_bytes()
        self.assertFalse(self.save()['ok'])
        self.assertFalse(self.new.exists())
        self.assertEqual(self.old.read_bytes(),original)
        atomic.write=real_write
        self.assertTrue(self.save()['ok'])
        self.new.write_text('{corrupt',encoding='utf8')
        state=self.state()
        self.assertFalse(state.ok)
        self.assertTrue(state.recoveryAvailable)
        recovered=self.from_lua(store.recover(state.token))
        self.assertTrue(recovered['ok'],recovered)
        self.assertEqual(self.new.read_bytes(),original)
        damaged=list(self.new.parent.glob('*.corrupt.*'))
        self.assertEqual(damaged[0].read_text(),'{corrupt')

    def test_manual_port_edit_preserves_icons_and_reset_restores_legacy(self):
        service=self.require('services.identity_service')
        request={'accountId':'1','appid':'2545026989','token':self.state().token,'entry':{'achievementMode':'port','providers':{},'port':{'title':'Edited title'}}}
        result=self.from_lua(service.save(self.to_lua(request)))
        self.assertTrue(result['ok'],result)
        config=self.state().config
        scoped=config.identities['1:shortcut:2545026989'].port
        self.assertEqual(self.from_lua(scoped.iconMap),self.game['iconMap'])
        self.assertEqual(scoped.title,'Edited title')
        request={'accountId':'1','appid':'2545026989','token':self.state().token,'reset':True}
        self.assertTrue(service.save(self.to_lua(request)).ok)
        config=self.state().config
        self.assertIsNone(config.identities['1:shortcut:2545026989'])
        self.assertEqual(self.from_lua(config.games['2545026989'].iconMap),self.game['iconMap'])

    def test_cache_invalidates_after_save(self):
        cache=self.require('utils.asset_cache')
        self.lua.execute('cache_reads=0; cache_loader=function() cache_reads=cache_reads+1; return cache_reads end')
        loader=self.lua.globals().cache_loader
        self.assertEqual(cache.get('test',600,loader),1)
        self.assertTrue(self.save()['ok'])
        self.assertEqual(cache.get('test',600,loader),2)

    def test_atomic_replace_supports_unicode_paths_and_backup_failure_is_safe(self):
        atomic=self.require('utils.atomic_file')
        target=self.base/'carpeta-é/設定.json'
        target.parent.mkdir()
        self.assertIs(atomic.write(target.as_posix(),'first'), True)
        self.assertIs(atomic.write(target.as_posix(),'second'), True)
        self.assertEqual(target.read_text(),'second')
        self.assertEqual(atomic.read(target.as_posix()),'second')
        self.lua.execute('require("utils.atomic_file").write=function() return nil,"backup disk full" end')
        original=self.old.read_bytes()
        result=self.save()
        self.assertFalse(result['ok'])
        self.assertIn('Backup failed',result['error'])
        self.assertFalse(self.new.exists())
        self.assertEqual(self.old.read_bytes(),original)

    def test_invalid_provider_and_missing_awn_reference_never_write(self):
        self.assertFalse(self.save({'steam':{'id':'not-a-number'}})['ok'])
        self.assertFalse(self.save(entry={'achievementMode':'awn','providers':{}})['ok'])
        self.assertFalse(self.new.exists())
        self.assertEqual(self.match(manual={'id':'unknown','source':'missing'})['status'],'missing')
        self.write(self.old,'{"games":[],"identities":{}}')
        self.assertFalse(self.state().ok)
        self.write(self.old,'{"games":{},"games":{}}')
        self.assertFalse(self.state().ok)

    def test_installation_guard_refuses_both_identities_and_invalid_schema(self):
        self.write(self.base/'millennium/config/config.json',json.dumps({'plugins':{'enabledPlugins':['org.awnext.steambridge','library-customizer']}}))
        self.assertTrue(self.require('services.installation_status').status().bothEnabled)
        self.assertFalse(self.save()['ok'])
        self.assertFalse(self.new.exists())
        self.write(self.new,json.dumps({'schemaVersion':999,'games':{}}))
        self.assertFalse(self.state().ok)
        self.write(Path(str(self.new)+'.bak'),self.old.read_text())
        state=self.state()
        self.assertFalse(state.recoveryAvailable)
        self.assertFalse(self.require('services.config_store').recover(state.token).ok)

    def test_account_fallback_without_live_confirmation_is_readonly(self):
        self.write(self.base/'config/loginusers.vdf','"users" { "76561197960265729" { "AutoLogin" "1" } }')
        service=self.require('services.identity_service')
        library=service.library(self.to_lua([]))
        self.assertEqual(library.accountSource,'autologin-readonly')
        self.assertFalse(library.writable)
        self.assertFalse(self.save()['ok'])
        self.require('services.steam_shortcuts').registry_account=lambda:'1'
        self.assertTrue(service.library(self.to_lua([])).writable)

    def test_other_accounts_cannot_consume_saved_bindings(self):
        self.assertTrue(self.save({'awn':{'id':'3595270','source':'GBE Fork'}})['ok'])
        config=self.state().config
        service=self.require('services.identity_service')
        other=service.resolve(self.to_lua(self.fixture['shortcut']),config,self.to_lua(self.fixture['candidates']),'2')
        self.assertNotEqual(other.resolution.status,'manual')
        self.assertIsNone(other.providers.awn)

    def test_provider_reference_changes_remove_old_source_and_keep_unknown_fields(self):
        config=self.config.copy()
        config['schemaVersion']=1
        config['identities']={'1:shortcut:3531473258':{'providers':{'awn':{'id':'old','source':'old-source','future':7}},'futureEntry':True}}
        self.write(self.new,json.dumps(config))
        self.assertTrue(self.save({'awn':{'id':'3595270','source':''}})['ok'])
        entry=self.state().config.identities['1:shortcut:3531473258']
        self.assertEqual(entry.providers.awn.source,'')
        self.assertEqual(entry.providers.awn.future,7)
        self.assertTrue(entry.futureEntry)
        self.assertTrue(self.save({})['ok'])
        self.assertIsNone(self.state().config.identities['1:shortcut:3531473258'].providers.awn)

    def test_regular_panel_delegates_to_official_awn_without_native_hooks(self):
        self.write(self.base/'awn/Cache/library_snapshot/library.json',json.dumps({'games':[{'appid':'3595270','name':self.fixture['shortcut']['name'],'source':'GBE Fork','achievement':{'total':1,'list':[{'name':'a'}]}}]}))
        self.write(self.base/'millennium/config/config.json',json.dumps({'plugins':{'enabledPlugins':['library-customizer','aw-next']}}))
        result=json.loads(self.require('services.achievement_resolver').get_achievements('3531473258',''))
        self.assertEqual(result['identityStatus'],'delegated')
        self.assertTrue(result['notConfigured'])
        # Disabling official AWN reuses the existing snapshot adapter, never official Steam achievement writes.
        self.write(self.base/'millennium/config/config.json',json.dumps({'plugins':{'enabledPlugins':['library-customizer']}}))
        result=json.loads(self.require('services.achievement_resolver').get_achievements('3531473258',''))
        self.assertEqual(result['total'],1)

    def test_vdf_inventory_removes_stale_ui_and_matches_backend_consistently(self):
        service=self.require('services.identity_service')
        root=self.base/'awn/Cache/library_snapshot/library.json'
        candidates=self.fixture['candidates']
        self.write(root,json.dumps({'games':[{'appid':c['id'],'name':c['name'],'source':c['source'],'exe':c['exe'],'gameDir':c['gameDir'],'achievement':{'total':1,'list':[{'name':'a'}]}} for c in candidates]}))
        # Personal fixture root is already the same isolated AWN directory.
        library=self.from_lua(service.library(self.to_lua([{'appid':'3531473258','name':'stale incorrect title'},{'appid':'3000000000','name':'deleted shortcut'}])))
        self.assertTrue(library['writable'])
        row=next(g for g in library['games'] if g['appid']=='3531473258')
        self.assertEqual(row['resolution']['selected']['id'],'3595270')
        self.assertNotIn('3000000000',[g['appid'] for g in library['games']])
        parsed=self.require('services.steam_shortcuts').list()[0]
        self.assertEqual(parsed['3531473258'].name,self.fixture['shortcut']['name'])
        self.assertFalse(self.lua.eval('function(s) return pcall(require("services.steam_shortcuts").parse,s) end')('\x00bad\x00')[0])


if __name__=='__main__': unittest.main(verbosity=2)
