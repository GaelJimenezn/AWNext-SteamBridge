"""Optional metadata-only reader smoke test. Does not validate Steam integration."""
import json
import os
from pathlib import Path
import subprocess
import sys
ROOT=Path(os.path.abspath(os.path.join(os.path.dirname(__file__),'..')))
sys.path.insert(0,str(ROOT/'tests'))
from test_backend import BackendTests
runner=BackendTests()
runner.setUp()
try:
    lua=runner.lua
    lua.globals().list_files=lambda path: runner.to_lua([{'name':item.name} for item in Path(path).iterdir()])
    lua.globals().file_size=lambda path: Path(path).stat().st_size
    lua.globals().resource_read=lambda name: (ROOT/'plugin/resources/discovery-windows.ps1').read_text(encoding='utf8') if name=='resources/discovery-windows.ps1' else None
    def command_read(command):
        args=command.split(' ')
        if len(args)!=5 or args[:4]!=['powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand']:
            raise ValueError('Unexpected metadata command')
        result=subprocess.run(args,capture_output=True,timeout=25,creationflags=subprocess.CREATE_NO_WINDOW)
        return result.stdout.decode('utf-8-sig'),result.returncode
    lua.globals().metadata_exec=command_read
    lua.execute('local fs=require("fs");fs.list=list_files;fs.file_size=file_size;require("millennium").assets={read=resource_read};require("utils").exec=metadata_exec')
    service=runner.require('services.discovery.library')
    for provider in ['epic','ubisoft','xbox','gamepass','gog']:
        value=runner.from_lua(service.scan(provider))
        rows=value.get('records') or []
        print(json.dumps({'provider':provider,'status':value['status'],'records':len(rows),'errors':len(value.get('errors') or []),'coverage':value['coverage'],'readOnly':True}),flush=True)
finally:
    runner.doCleanups()
