local fs = require("fs")
local millennium = require("millennium")
local json = require("json")
local atomic = require("utils.atomic_file")
local M = {}
function M.status()
    local bytes = atomic.read(fs.join(millennium.steam_path(), "millennium", "config", "config.json"))
    local ok, config = pcall(json.decode, bytes or "")
    if not ok or type(config) ~= "table" or type(config.plugins) ~= "table" or type(config.plugins.enabledPlugins) ~= "table" then
        return { ok = false, mayRun = false, error = "Cannot verify Millennium activation state" }
    end
    local legacy, current, official = false, false, false
    for _, id in ipairs(config.plugins.enabledPlugins) do
        legacy = legacy or id == "org.awnext.steambridge"
        current = current or id == "library-customizer"
        official = official or id == "aw-next"
    end
    return { ok = true, id = "library-customizer", legacyEnabled = legacy, enabled = current,
        bothEnabled = legacy and current, mayRun = not legacy, awnOfficialEnabled = official,
        error = legacy and "Disable org.awnext.steambridge in Millennium before using Library Customizer" or nil }
end
return M
