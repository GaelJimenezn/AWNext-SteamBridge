local json = require("json")
local store = require("services.config_store")
local repository = require("services.awn_repository")
local M = {}
function M.status()
    local state=store.load()
    if not state.ok then return json.encode({ok=false,awn={connected=false,reason=state.error}}) end
    local snapshot,err=repository.load(state.config)
    if not snapshot then return json.encode({ok=true,awn={connected=false,reason=err}}) end
    local total=0
    for _,game in ipairs(snapshot.games) do if type(game)=="table" then total=total+1 end end
    return json.encode({ok=true,awn={connected=true,total=total,external=#repository.candidates(snapshot),version=tostring(snapshot.appVersion or "unknown")}})
end
return M
