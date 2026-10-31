local logger = require("logger")
local json = require("json")
local fs = require("fs")
local millennium = require("millennium")

local file_reader = require("utils.file_reader")
local asset_cache = require("utils.asset_cache")
local base64 = require("utils.base64")
local awn_schema = require("parsers.awn_schema")
local parse_toml = require("parsers.toml")

local read = file_reader.read
local read_json = file_reader.read_json
local safe_id = awn_schema.safe_id
local schema_entries = awn_schema.schema_entries
local function icon_data(root, title_id, id, icon_map)
    local image_id = type(icon_map) == "table" and safe_id(icon_map[id]) or id
    if not image_id then
        return nil
    end

    local path = fs.join(root, "icon_cache", "x360recomp", title_id, image_id .. ".png")

    return asset_cache.get("icon:" .. path, 600, function()
        local data = read(path, true, true)

        if data and #data <= 262144 and data:sub(1, 8) == "\137PNG\r\n\26\n" then
            return "data:image/png;base64," .. base64(data)
        end

        return nil
    end, true)
end
local function get_achievements(shortcut_app_id)
    logger:info("[MAPPING] get_achievements called with: " .. tostring(shortcut_app_id))
    local id = safe_id(shortcut_app_id)
    if not id then
        return json.encode({ stage = "MAPPING", error = "Invalid shortcut AppID" })
    end
    local config_path = fs.join(millennium.steam_path(), "millennium", "plugins", "org.awnext.steambridge.config.json")
    logger:info("[MAPPING] Config path: " .. config_path)
    local config = read_json(config_path)
    if not config or type(config.games) ~= "table" then
        return json.encode({
            stage = "MAPPING",
            error = "Local bridge configuration unavailable",
            configPath = config_path,
        })
    end
    local game = config.games[id]
    if type(game) ~= "table" then
        logger:warn("[MAPPING] No config for game " .. id)
        return json.encode({ notConfigured = true })
    end
    logger:info("[MAPPING] Found config for game " .. id .. " adapter=" .. tostring(game.adapter))
    if game.adapter ~= "x360recomp-toml" then
        return json.encode({ stage = "MAPPING", error = "Unsupported adapter" })
    end
    local title_id = tostring(game.titleId or ""):upper()
    if not title_id:match("^[0-9A-F]+$") or #title_id ~= 8 then
        return json.encode({ stage = "MAPPING", error = "Invalid title ID" })
    end
    local root = config.awnDataRoot
        or os.getenv("AW_USER_DATA")
        or fs.join(os.getenv("APPDATA") or "", "Achievement Watcher Next")
    logger:info("[DATA] awnDataRoot=" .. tostring(root) .. " titleId=" .. title_id)
    if type(game.stateRoot) ~= "string" or game.stateRoot == "" then
        return json.encode({ stage = "MAPPING", error = "Missing stateRoot" })
    end
    local profile = game.profile or "user"
    if type(profile) ~= "string" or not profile:match("^user[%w%-]*$") then
        return json.encode({ stage = "MAPPING", error = "Invalid profile" })
    end
    local state_path = fs.join(game.stateRoot, profile, "achievements", title_id .. ".toml")
    logger:info("[DATA] state_path=" .. state_path)
    local content = read(state_path)
    if not content or #content > 1048576 then
        return json.encode({
            stage = "DATA",
            error = "Unlock list unavailable",
            statePath = state_path,
        })
    end
    local unlocked = parse_toml(content)
    local schema_path = fs.join(root, "steam_cache", "x360recomp", title_id .. ".json")
    logger:info("[DATA] schema_path=" .. schema_path)
    local catalog = asset_cache.get("schema:" .. schema_path, 120, function()
        return read_json(schema_path)
    end)
    local rows = schema_entries(catalog)
    if #rows == 0 then
        return json.encode({
            stage = "DATA",
            error = "AWN catalog unavailable",
            schemaPath = schema_path,
        })
    end
    local earned = 0
    for _, row in ipairs(rows) do
        row.unlocked = unlocked[row.id] ~= nil
        row.unlockTime = unlocked[row.id] or 0
        row.icon = icon_data(root, title_id, row.id, game.iconMap)
        if row.unlocked then
            earned = earned + 1
        end
    end
    logger:info(string.format("[DATA] Read %d/%d achievements for shortcut %s", earned, #rows, id))
    return json.encode({
        title = game.title or ("Xbox 360 - " .. title_id),
        source = "AWN local x360 recomp",
        total = #rows,
        unlocked = earned,
        achievements = rows,
    })
end

return { get_achievements = get_achievements }
