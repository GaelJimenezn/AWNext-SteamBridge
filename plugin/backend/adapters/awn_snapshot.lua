local json = require("json")
local fs = require("fs")
local cache = require("utils.asset_cache")
local reader = require("utils.file_reader")
local millennium = require("millennium")

local function normalize(value)
    if type(value) ~= "string" then return "" end
    return value:lower():gsub("[Â®â„¢]", ""):gsub("[%p]", " "):gsub("%s+", " "):gsub("^%s+", ""):gsub("%s+$", "")
end

local function load_snapshot()
    local cfgpath = fs.join(millennium.steam_path(), "millennium", "plugins", "org.awnext.steambridge.config.json")
    local config = reader.read_json(cfgpath)
    local root = type(config) == "table" and config.awnDataRoot or nil
    if type(root) ~= "string" or root == "" then root = os.getenv("AW_USER_DATA") end
    if not root or root == "" then
        local appdata = os.getenv("APPDATA")
        if not appdata or appdata == "" then return nil end
        root = fs.join(appdata, "Achievement Watcher Next")
    end
    local path = fs.join(root, "Cache", "library_snapshot", "library.json")
    return cache.get("awn-snapshot:" .. path, 30, function()
        local content = reader.read(path, false, true)
        if not content or #content > 33554432 then return nil end
        local ok, data = pcall(json.decode, content)
        if ok and type(data) == "table" then return data end
        return nil
    end)
end

local function as_bool(value)
    return value == true or value == 1 or value == "1"
end

local function unlock_info(row)
    if as_bool(row.unlocked) or as_bool(row.achieved) or as_bool(row.Achieved) then
        return true, tonumber(row.unlockTime or row.UnlockTime or row.unlock_time) or 0
    end
    local time = tonumber(row.unlockTime or row.UnlockTime or row.unlock_time) or 0
    return time > 0, time
end

local function get_achievements(shortcut_id, game_title)
    local title = normalize(game_title)
    if title == "" or #title < 3 then return json.encode({ notConfigured = true }) end
    local snapshot = load_snapshot()
    if type(snapshot) ~= "table" or type(snapshot.games) ~= "table" then
        return json.encode({ notConfigured = true })
    end
    local found = nil
    local matches = 0
    for _, game in ipairs(snapshot.games) do
        if type(game) == "table" and game.steamOfficial ~= true then
            local current = normalize(game.displayName or game.name)
            local fallback = normalize(game.name)
            if current == title or fallback == title then
                matches = matches + 1
                found = game
            end
        end
    end
    if matches ~= 1 or not found then return json.encode({ notConfigured = true }) end
    local ach = found.achievement
    if type(ach) ~= "table" or type(ach.list) ~= "table" then
        return json.encode({ notConfigured = true })
    end
    local total = tonumber(ach.total) or 0
    if total <= 0 or #ach.list == 0 then return json.encode({ notConfigured = true }) end
    local rows = {}
    for index, item in ipairs(ach.list) do
        if type(item) == "table" then
            local unlocked, when = unlock_info(item)
            rows[#rows + 1] = {
                id = tostring(item.name or item.id or index),
                name = tostring(item.displayName or item.name or ("Logro " .. index)),
                description = tostring(item.description or ""),
                unlocked = unlocked,
                unlockTime = when,
                icon = type(item.icon) == "string" and (item.icon:match("^https://") or item.icon:match("^data:image/png;base64,")) and item.icon or nil,
            }
        end
    end
    if #rows == 0 then return json.encode({ notConfigured = true }) end
    return json.encode({
        title = tostring(found.displayName or found.name or game_title),
        source = "AWN - " .. tostring(found.source or "Local"),
        total = total,
        unlocked = tonumber(ach.unlocked) or 0,
        achievements = rows,
    })
end

return { get_achievements = get_achievements }