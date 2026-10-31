local json = require("json")
local x360recomp = require("adapters.x360recomp")
local awn_snapshot = require("adapters.awn_snapshot")

local function get_achievements(shortcut_app_id, game_title)
    local manual = x360recomp.get_achievements(shortcut_app_id)
    local result = manual
    if type(manual) == "string" then
        local ok, decoded = pcall(json.decode, manual)
        if ok then result = decoded end
    end
    if type(result) == "table" and result.notConfigured == true then
        return awn_snapshot.get_achievements(shortcut_app_id, game_title)
    end
    return manual
end
return { get_achievements = get_achievements }