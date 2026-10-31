local json = require("json")
local fs = require("fs")
local logger = require("logger")
local millennium = require("millennium")
local cache = require("utils.asset_cache")
local reader = require("utils.file_reader")

local function root_path()
    local config_path = fs.join(millennium.steam_path(), "millennium", "plugins", "org.awnext.steambridge.config.json")
    local config = reader.read_json(config_path)
    if type(config) == "table" and type(config.awnDataRoot) == "string" and config.awnDataRoot ~= "" then
        return config.awnDataRoot
    end
    local env = os.getenv("AW_USER_DATA")
    if env and env ~= "" then return env end
    local appdata = os.getenv("APPDATA")
    if not appdata or appdata == "" then return nil end
    return fs.join(appdata, "Achievement Watcher Next")
end

local function list_games()
    local root = root_path()
    if not root then
        return json.encode({ ok = false, error = "AWN data root unavailable", games = {} })
    end
    local path = fs.join(root, "Cache", "library_snapshot", "library.json")
    local data = cache.get("awn-snapshot:" .. path, 30, function()
        local raw = reader.read(path, false, true)
        if not raw then return nil end
        if #raw > 33554432 then
            logger:warn("[DISCOVERY] AWN snapshot exceeds 32 MB")
            return nil
        end
        local ok, result = pcall(json.decode, raw)
        if ok and type(result) == "table" then return result end
        logger:warn("[DISCOVERY] AWN snapshot is invalid JSON")
        return nil
    end)
    if type(data) ~= "table" or type(data.games) ~= "table" then
        return json.encode({ ok = false, error = "AWN library snapshot unavailable or invalid", games = {} })
    end
    local items = {}
    for _, game in ipairs(data.games) do
        if type(game) == "table" and game.steamOfficial ~= true then
            local achievements = type(game.achievement) == "table" and game.achievement or {}
            local name = game.displayName or game.name
            if type(name) == "string" and name ~= "" then
                items[#items + 1] = {
                    name = name,
                    awnId = tostring(game.appid or ""),
                    source = tostring(game.source or "Unknown"),
                    installed = game.installed,
                    steamOfficial = game.steamOfficial,
                    total = tonumber(achievements.total) or 0,
                    unlocked = tonumber(achievements.unlocked) or 0,
                    hasCatalog = (tonumber(achievements.total) or 0) > 0,
                }
            end
        end
    end
    table.sort(items, function(a, b) return a.name:lower() < b.name:lower() end)
    return json.encode({ ok = true, count = #items, games = items })
end

return { list_games = list_games }