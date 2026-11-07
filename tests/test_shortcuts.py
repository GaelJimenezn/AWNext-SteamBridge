import json
import unittest
import test_backend as base

class ShortcutTests(base.BackendTests):
    def setUp(self):
        super().setUp()
        self.lua.execute('''local fs=require("fs");local original_dir,original_file=fs.is_directory,fs.is_file
            fs.is_directory=function(path) return path=="C:/Games/Test" or path=="D:/Games/Test" or original_dir(path) end
            fs.is_file=function(path) return path=="C:/Games/Test/game.exe" or path=="D:/Games/Test/game.exe" or original_file(path) end
            local row={id="epic:one",provider="epic",providerId="one",name="Game Alpha",installations={
                {id="install-one",path="C:/Games/Test",status="installed",launch={kind="executable",target="C:/Games/Test/game.exe",verified=true}}},shortcuts={}}
            fixtureRow=row
            fixtureSnapshot={revision=7,providers={{id="epic",status="ready",records={row}}}}
            require("services.discovery.library").snapshot=function() return fixtureSnapshot end
            fixtureShortcuts={}
            require("services.steam_shortcuts").list=function() return fixtureShortcuts,"1",nil,"fixture" end
        ''')
        self.manager=self.require('services.shortcuts.manager')
        self.journal=self.require('services.shortcuts.journal')
        self.request={'revision':7,'items':[{'recordId':'epic:one','installationId':'install-one'}]}

    def plan(self):return self.manager.plan(self.to_lua(self.request))
    def simulate(self):return self.manager.simulate(self.to_lua(self.request))

    def test_proposal_has_no_real_write_gate_and_does_not_create_files(self):
        result=self.from_lua(self.simulate())
        self.assertEqual(result['results'][0]['status'],'would_create')
        self.assertTrue(result['results'][0]['id'].startswith('sim:'))
        self.assertFalse(result['writesEnabled'])
        self.assertTrue(all(value is False for value in result['plan']['gates'].values()))
        self.assertEqual(result['plan']['proposals'][0]['launcherCompatibility'],'unverified')
        self.assertFalse(self.new.exists())

    def test_missing_stale_or_forged_selection_is_rejected(self):
        self.request['revision']=6;self.assertFalse(self.plan().ok)
        self.request['revision']=7;self.request['items'][0]['installationId']='forged';self.assertFalse(self.plan().ok)
        self.request['items']=[];self.assertFalse(self.plan().ok)
        self.request['items']=[{'recordId':'epic:one','installationId':'install-one'}]*101;self.assertFalse(self.plan().ok)

    def test_duplicate_manual_shortcut_is_preserved_and_blocks_simulation(self):
        self.lua.execute('fixtureShortcuts["999"]={name="Game Alpha",exe="C:/Games/Test/game.exe"}')
        result=self.from_lua(self.simulate())
        self.assertEqual(result['results'][0]['status'],'blocked')
        self.assertEqual(self.from_lua(self.lua.globals().fixtureShortcuts)['999']['name'],'Game Alpha')
        self.assertTrue(result['plan']['proposals'][0]['duplicates'])

    def test_mwiii_shared_executable_conflict_does_not_associate_mwii(self):
        self.lua.execute('fixtureRow.name="Call of Duty Modern Warfare III";fixtureShortcuts["1959007243"]={name="Call of Duty Modern Warfare II",exe="C:/Games/Test/game.exe"}')
        proposal=self.from_lua(self.plan())['proposals'][0]
        self.assertFalse(proposal['simulationEligible'])
        self.assertEqual(proposal['conflicts'][0]['appid'],'1959007243')
        self.assertFalse(proposal['conflicts'][0]['evidence']['eligible'])

    def test_paths_commands_and_launcher_methods_fail_closed(self):
        for target in ['C:/Games/Test/../game.exe','C:/Games/Test/game.exe --evil','C:/Games/Test/game.cmd','C:/Games/Test/game.exe" & calc','https://bad/game.exe','C:/Games/Test/game.exe:stream']:
            self.lua.globals().fixtureRow.installations[1].launch.target=target
            self.assertFalse(self.plan().proposals[1].simulationEligible,target)
        self.lua.execute('fixtureRow.installations[1].launch={kind="shell_app",target="Package!App",verified=false}')
        self.assertFalse(self.plan().proposals[1].simulationEligible)

    def test_non_installed_stale_and_missing_inventory_never_simulate_creation(self):
        self.lua.execute('fixtureRow.installations[1].status="unknown"');self.assertFalse(self.plan().proposals[1].simulationEligible)
        self.lua.execute('fixtureRow.installations[1].status="installed";fixtureSnapshot.providers[1].stale=true');self.assertFalse(self.plan().proposals[1].simulationEligible)
        self.lua.execute('fixtureSnapshot.providers[1].stale=false;require("services.steam_shortcuts").list=function() return {},nil,"unavailable" end')
        self.assertFalse(self.plan().proposals[1].simulationEligible)

    def test_repeated_simulation_and_rollback_only_owned_unchanged_objects(self):
        plan=self.plan();first=self.journal.simulate(plan)
        repeated=self.journal.simulate(plan,first.journal)
        self.assertEqual(repeated.results[1].status,'already_recorded')
        op=next(iter(self.from_lua(first.journal)['operations'].values()));key=op['key']
        changed=self.journal.rollback(first.journal,self.to_lua([key,'manual']),self.to_lua({op['id']:'user-edited'}),'1')
        self.assertEqual(changed.results[1].status,'manual_change_preserved')
        self.assertEqual(changed.results[2].status,'not_owned')
        removed=self.journal.rollback(first.journal,self.to_lua([key]),self.to_lua({op['id']:op['fingerprint']}),'1')
        self.assertEqual(removed.results[1].status,'would_remove_owned')
        self.assertEqual(self.journal.rollback(removed.journal,self.to_lua([key]),self.to_lua({}),'1').results[1].status,'already_rolled_back')
        self.assertFalse(self.journal.rollback(first.journal,self.to_lua([key]),self.to_lua({}),'2').ok)

    def test_journal_atomic_persistence_restart_and_stale_token_preserve_mapping(self):
        result=self.simulate();store=self.require('services.config_store');state=store.load()
        saved=self.journal.persist_simulation(state.token,result.journal)
        self.assertTrue(saved.ok,saved.error)
        self.assertFalse(self.journal.persist_simulation(state.token,result.journal).ok)
        self.lua.execute('package.loaded["services.config_store"]=nil;package.loaded["services.shortcuts.journal"]=nil')
        reloaded=self.require('services.config_store').load()
        self.assertEqual(reloaded.config.shortcutManager.version,1)
        self.assertEqual(len(self.from_lua(reloaded.config.shortcutManager.simulations['1'].operations)),1)
        self.assertEqual(self.from_lua(reloaded.config.games['2545026989'].iconMap),self.config['games']['2545026989']['iconMap'])
        self.assertEqual(self.old.read_text(encoding='utf8'),json.dumps(self.config))
        self.assertEqual(self.new.with_name(self.new.name+'.bak').read_text(encoding='utf8'),json.dumps(self.config))

    def test_journal_refuses_real_ids_and_future_versions(self):
        result=self.simulate();op=next(iter(result.journal.operations.values()));op.id='12345'
        self.assertFalse(self.journal.persist_simulation(self.require('services.config_store').load().token,result.journal).ok)
        self.assertFalse(self.new.exists())
        journal=self.simulate().journal
        self.config['shortcutManager']={'version':99,'simulations':{}}
        self.write(self.old,json.dumps(self.config))
        state=self.require('services.config_store').load()
        self.assertFalse(self.journal.persist_simulation(state.token,journal).ok)
        self.assertFalse(self.new.exists())

    def test_partial_batch_and_journal_save_failure_leave_sources_intact(self):
        self.lua.execute('fixtureRow.installations[2]={id="missing",path="Z:/Missing",status="unknown"}')
        self.request['items'].append({'recordId':'epic:one','installationId':'missing'})
        result=self.simulate()
        self.assertEqual(result.results[1].status,'would_create')
        self.assertEqual(result.results[2].status,'blocked')
        store=self.require('services.config_store');state=store.load()
        self.lua.execute('require("utils.atomic_file").write=function() return false,"fixture disk failure" end')
        self.assertFalse(self.journal.persist_simulation(state.token,result.journal).ok)
        self.assertFalse(self.new.exists())
        self.assertEqual(self.old.read_text(encoding='utf8'),json.dumps(self.config))

    def test_multiple_installations_preserved_exact_batch_commands_blocked(self):
        self.lua.execute('fixtureRow.installations[2]={id="second",path="D:/Games/Test",status="installed",launch={kind="executable",target="D:/Games/Test/game.exe",verified=true}}')
        self.request['items'].append({'recordId':'epic:one','installationId':'second'})
        self.assertEqual(len(self.from_lua(self.simulate())['journal']['operations']),2)
        self.request['items'].append(self.request['items'][0]);self.assertEqual(len(self.from_lua(self.plan())['proposals']),2)
        self.lua.execute('fixtureRow.installations[2].path="C:/Games/Test";fixtureRow.installations[2].launch.target="C:/Games/Test/game.exe"')
        self.assertFalse(self.plan().proposals[2].simulationEligible)

if __name__=='__main__':unittest.main(verbosity=2)
