import hashlib
import json
import sqlite3
from pathlib import Path
import unittest
import test_backend as base

class DiscoveryTests(base.BackendTests):
    def setUp(self):
        super().setUp()
        self.fixture=json.loads((base.ROOT/'tests/fixtures/discovery.json').read_text(encoding='utf8'))
        self.lua.globals().list_files=lambda path: self.to_lua([{'name':p.name} for p in Path(path).iterdir()])
        self.lua.globals().file_size=lambda path: Path(path).stat().st_size
        self.lua.execute('local fs=require("fs");fs.list=list_files;fs.file_size=file_size')
        self.ctx=self.require('services.discovery.sources').new()
        self.ctx.programData=(self.base/'ProgramData').as_posix()
        self.ctx.now='2026-11-06T12:00:00Z'
        self.ctx.windows=lambda _,provider:self.to_lua(self.fixture[provider])
        self.ctx.is_dir=lambda _,path:path in ['C:/Games/Epic','C:/Games/Ubisoft','C:/Games/GOG','D:/Games/GOG','C:/Games/Xbox'] or isinstance(path,str) and Path(path).is_dir()
        self.ctx.catalog=lambda _,path,kind:self.to_lua(self.fixture['titles' if kind=='gog_titles' else 'installs'])
        self.manifests=self.base/'ProgramData/Epic/EpicGamesLauncher/Data/Manifests'
        self.manifests.mkdir(parents=True)
        self.write(self.manifests/'game.item',json.dumps(self.fixture['epic']))
        self.db=self.base/'ProgramData/GOG.com/Galaxy/storage/galaxy-2.0.db'
        self.db.parent.mkdir(parents=True)
        self.db.write_bytes(b'placeholder-only-used-by-mock')

    def scan(self,id):return self.from_lua(self.require('services.discovery.library').scan(id,self.ctx))

    def test_preview_inventory_reports_failures_and_never_claims_live_verification(self):
        service=self.require('services.discovery.library')
        self.lua.execute('require("services.steam_shortcuts").list=function() return {},nil,"fixture inventory unavailable" end')
        inventory=self.from_lua(service.snapshot())['steamInventory']
        self.assertFalse(inventory['available'])
        self.assertFalse(inventory['liveVerified'])
        self.assertEqual(inventory['error'],'fixture inventory unavailable')
        self.lua.execute('require("services.steam_shortcuts").list=function() return {},"1",nil,"fixture-account" end')
        inventory=self.from_lua(service.snapshot())['steamInventory']
        self.assertTrue(inventory['available'])
        self.assertEqual(inventory['scope'],'persisted_shortcuts_only')
        self.assertFalse(self.new.exists())

    def test_epic_metadata_and_path_escape_no_ownership_inference(self):
        result=self.scan('epic')
        row=result['records'][0]
        self.assertEqual(row['providerId'],'store:game-1:alpha')
        self.assertEqual(row['installed'],'installed')
        self.assertEqual(row['licenses'][0]['type'],'unknown')
        self.assertEqual(row['lastChecked'],'2026-11-06T12:00:00Z')
        self.assertIsNone(self.ctx.contained(self.ctx,'C:/Games','../outside.exe'))
        self.assertIsNone(self.ctx.contained(self.ctx,'C:/Games','C:/elsewhere.exe'))
        self.write(self.manifests/'broken.item','{bad')
        self.assertEqual(self.scan('epic')['status'],'partial')
        self.fixture['epic']['InstallLocation']='Z:/Missing'
        self.write(self.manifests/'game.item',json.dumps(self.fixture['epic']))
        self.assertEqual(self.scan('epic')['records'][0]['installed'],'unknown')

    def test_gog_cached_not_installed_titles_and_multiple_installations(self):
        result=self.scan('gog')
        self.assertEqual(len(result['records']),2)
        game=next(row for row in result['records'] if row['providerId']=='100')
        self.assertEqual(len(game['installations']),2)
        cached=next(row for row in result['records'] if row['providerId']=='200')
        self.assertTrue(cached['catalogOnly'])
        self.assertEqual(cached['installed'],'unknown')
        self.assertEqual(cached['licenses'][0]['entitlement'],'unknown')

    def test_xbox_gamepass_are_not_interchangeable_license_sources(self):
        result=self.scan('xbox')
        self.assertEqual(result['records'][0]['installations'][0]['launch']['kind'],'shell_app')
        self.assertEqual(result['records'][0]['licenses'][0]['type'],'unknown')
        gamepass=self.scan('gamepass')
        self.assertEqual(gamepass['status'],'limited')
        self.assertEqual(gamepass['records'],{})

    def test_identity_candidates_are_not_merged_across_stores(self):
        service=self.require('services.discovery.library')
        for id in ['epic','ubisoft','gog']:service.scan(id,self.ctx)
        snapshot=self.from_lua(service.snapshot())
        groups={group['id']:group for group in snapshot['providers']}
        self.assertEqual(len(groups['epic']['records']),1)
        self.assertTrue(groups['epic']['records'][0]['identity']['candidates'])
        self.assertNotEqual(groups['epic']['records'][0]['id'],groups['ubisoft']['records'][0]['id'])
        self.assertFalse(self.new.exists())

    def test_failure_isolation_and_stale_observation_retention(self):
        service=self.require('services.discovery.library')
        first=self.scan('ubisoft')
        self.ctx.windows=self.lua.eval('function() error("fixture locked source") end')
        failed=self.scan('ubisoft')
        self.assertTrue(failed['stale'])
        self.assertEqual(failed['records'],first['records'])
        self.assertEqual(failed['status'],'error')
        self.assertEqual(self.scan('epic')['status'],'ready')
        self.assertFalse(service.refresh('unknown').ok)

    def test_replaceable_adapter_preserves_distinct_license_and_installation_records(self):
        self.lua.execute('''local adapter=require("services.discovery.epic")
            local model=require("services.discovery.model")
            adapter.scan=function(ctx)
                local a=model.record("epic","same","Game","fixture",ctx.now)
                local b=model.record("epic","same","Game Deluxe","fixture",ctx.now)
                a.licenses={{id="a",type="purchase",entitlement="fixture",source="fixture"}}
                b.licenses={{id="b",type="subscription",entitlement="fixture",source="fixture"}}
                model.install(a,"C:/One",true,"fixture")
                model.install(b,"D:/Two",true,"fixture")
                return {records={a,b},errors={},limitations={},coverage="fixture"}
            end''')
        result=self.scan('epic')
        self.assertEqual(len(result['records']),1)
        self.assertEqual(len(result['records'][0]['licenses']),2)
        self.assertEqual(len(result['records'][0]['installations']),2)
        self.assertEqual(result['records'][0]['game']['aliases'],['Game Deluxe'])

    def test_shared_executable_cannot_merge_mwiii_with_mwii(self):
        self.lua.execute('''local model=require("services.discovery.model")
            require("services.discovery.epic").scan=function(ctx)
                local row=model.record("epic","mw3","MWIII","fixture",ctx.now)
                model.install(row,"C:/Shared",true,"fixture",{kind="executable",target="C:/Shared/cod.exe"})
                return {records={row},errors={},limitations={},coverage="fixture"}
            end
            require("services.discovery.ubisoft").scan=function(ctx)
                local row=model.record("ubisoft","mw2","MWII","fixture",ctx.now)
                model.install(row,"C:/Shared",true,"fixture",{kind="executable",target="C:/Shared/cod.exe"})
                return {records={row},errors={},limitations={},coverage="fixture"}
            end''')
        service=self.require('services.discovery.library')
        service.scan('epic',self.ctx);service.scan('ubisoft',self.ctx)
        snapshot=self.from_lua(service.snapshot())
        epic=next(group for group in snapshot['providers'] if group['id']=='epic')['records'][0]
        self.assertEqual(epic['identity']['candidates'],{})
        self.assertEqual(epic['identity']['conflicts'][0]['name'],'MWII')
        self.assertIn('installment_or_year_mismatch',epic['identity']['conflicts'][0]['blockers'])

    def test_native_sqlite_reads_metadata_without_creating_sidecars(self):
        self.db.unlink()
        with sqlite3.connect(self.db) as db:
            db.execute('CREATE TABLE LimitedDetails(productId TEXT,title TEXT)')
            db.execute('CREATE TABLE InstalledBaseProducts(productId TEXT,installationPath TEXT)')
            db.execute('CREATE TABLE ProductAuthorizations(secretToken TEXT)')
            db.execute('INSERT INTO LimitedDetails VALUES (?,?)',('9007199254740993','Cached Game'))
            db.execute('INSERT INTO InstalledBaseProducts VALUES (?,?)',('9007199254740993','C:/Games'))
        db.close()
        before=hashlib.sha256(self.db.read_bytes()).hexdigest()
        reader=self.require('services.discovery.sqlite_catalog')
        rows=self.from_lua(reader.read(self.db.as_posix(),'gog_titles'))
        self.assertEqual(rows[0]['id'],'9007199254740993')
        self.assertEqual(hashlib.sha256(self.db.read_bytes()).hexdigest(),before)
        self.assertEqual(sorted(p.name for p in self.db.parent.iterdir()),['galaxy-2.0.db'])
        with self.assertRaises(Exception):reader.read(self.db.as_posix(),'ProductAuthorizations')
        Path(str(self.db)+'-wal').write_bytes(b'fixture')
        with self.assertRaises(Exception):reader.read(self.db.as_posix(),'gog_titles')

if __name__=='__main__': unittest.main(verbosity=2)
