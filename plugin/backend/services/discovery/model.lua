local identity=require("services.game_identity")
local M={}
function M.record(provider,id,name,source,now)
    if type(id)~="string" or id=="" or #id>256 or type(name)~="string" or name=="" or #name>512 then return nil end
    return {id=provider..":"..id,provider=provider,providerId=id,name=name,
        game={provider=provider,id=id,name=name},installations={},licenses={{type="unknown",entitlement="unknown"}},
        installed="unknown",evidence={{source=source,kind="local_metadata"}},lastChecked=now}
end
function M.install(record,path,exists,source,launch)
    if type(path)~="string" or path=="" then return end
    local status=exists and "installed" or "unknown"
    local key=record.id..":installation:"..identity.path(path)..":"..(launch and launch.kind or "none")..":"..(launch and launch.target or "")
    record.installations[#record.installations+1]={id=key,path=path,status=status,launch=launch,evidence=source}
    if exists then record.installed="installed" end
end
return M
