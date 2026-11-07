local json = require("json")
local store = require("services.config_store")
local repository = require("services.awn_repository")
local M = {}
function M.list_games()
    local state = store.load()
    if not state.ok then return json.encode({ok=false,error=state.error,games={}}) end
    local snapshot, err = repository.load(state.config)
    if not snapshot then return json.encode({ok=false,error=err,games={}}) end
    local games = repository.candidates(snapshot)
    return json.encode({ok=true,games=games,count=#games})
end
return M
