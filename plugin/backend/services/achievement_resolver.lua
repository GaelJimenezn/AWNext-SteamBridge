local json = require("json")
local x360recomp = require("adapters.x360recomp")
local awn_snapshot = require("adapters.awn_snapshot")
local identities = require("services.identity_service")
local engine = require("services.game_identity")

local function get_achievements(shortcut_app_id, game_title)
    local id = engine.shortcut_id(shortcut_app_id)
    if not id then return json.encode({stage="MAPPING",error="Invalid shortcut AppID"}) end
    local state, shortcuts, account, candidates, snapshot = identities.context()
    if not state.ok then return json.encode({stage="CONFIGURATION",error=state.error}) end
    local shortcut = shortcuts[id] or {appid=id,name=game_title or ""}
    if shortcut.name=="" and type(game_title)=="string" then shortcut.name=game_title end
    local result=identities.resolve(shortcut,state.config,candidates,account)
    if result.resolution.status=="manual-port" then return x360recomp.get_achievements(id,result.port,state.config) end
    local selected=result.resolution.selected
    if selected then
        -- Reuse AWN data without adding a second general achievement panel when official AWN is enabled.
        -- The explicit local port reader above remains independent and available.
        if require("services.installation_status").status().awnOfficialEnabled then
            return json.encode({notConfigured=true,identityStatus="delegated",identityReason="official_awn_presentation"})
        end
        for _,game in ipairs(snapshot and snapshot.games or {}) do
            if tostring(game.appid)==selected.id and tostring(game.source or "Unknown")==selected.source then return awn_snapshot.from_game(game,shortcut.name) end
        end
    end
    return json.encode({notConfigured=true,identityStatus=result.resolution.status,identityReason=result.resolution.explanation})
end
return { get_achievements = get_achievements }
