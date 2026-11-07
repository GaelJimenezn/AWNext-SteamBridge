local fs = require("fs")
local json = require("json")
local atomic = require("utils.atomic_file")
local cache = require("utils.asset_cache")
local M = {}
function M.load(config)
    local root = config and config.awnDataRoot
    if type(root) ~= "string" or root == "" then root = os.getenv("AW_USER_DATA") end
    if not root or root == "" then
        local appdata = os.getenv("APPDATA")
        if not appdata then return nil, "AWN data root unavailable" end
        root = fs.join(appdata, "Achievement Watcher Next")
    end
    local path = fs.join(root, "Cache", "library_snapshot", "library.json")
    local data = cache.get("awn-snapshot:" .. path, 30, function()
        local bytes = atomic.read(path, 33554432)
        if not bytes then return nil end
        local ok, result = pcall(json.decode, bytes)
        if ok and type(result) == "table" and type(result.games) == "table" then return result end
        return nil
    end)
    if not data then return nil, "AWN snapshot missing or invalid" end
    return data
end

function M.candidates(snapshot)
    local list = {}
    for _, game in ipairs(snapshot and snapshot.games or {}) do
        if type(game) == "table" and game.steamOfficial ~= true and (type(game.appid)=="string" or type(game.appid)=="number") and type(game.displayName or game.name)=="string" then
            local achievements = type(game.achievement) == "table" and game.achievement or {}
            list[#list+1] = { provider="awn", id=tostring(game.appid), awnId=tostring(game.appid), name=game.displayName or game.name or "",
                source=type(game.source)=="string" and game.source or "Unknown", exe=game.exe, gameDir=game.gameDir,
                steamId=game.steamAppId and tostring(game.steamAppId) or nil,
                total=tonumber(achievements.total) or 0, unlocked=tonumber(achievements.unlocked) or 0,
                hasCatalog=type(achievements.list)=="table" and #achievements.list>0, installed=game.installed }
        end
    end
    table.sort(list, function(a,b) return (a.name..a.source..a.id)<(b.name..b.source..b.id) end)
    return list
end
return M
