local logger = require('logger')
local json = require('json')
local fs = require('fs')
local millennium = require('millennium')

local function read(path, binary)
    local file = io.open(path, binary and 'rb' or 'r')
    if not file then 
        logger:warn('[BACKEND] Cannot open file: ' .. tostring(path))
        return nil 
    end
    local data = file:read('*a')
    file:close()
    if data then
        logger:info('[BACKEND] Read file: ' .. tostring(path) .. ' (' .. tostring(#data) .. ' bytes)')
    end
    return data
end

local function read_json(path)
    local data = read(path)
    if not data then return nil end
    local ok, value = pcall(json.decode, data)
    if ok and type(value) == 'table' then return value end
    logger:warn('Invalid JSON: ' .. path)
    return nil
end

local function base64(data)
    local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local result = {}
    for pos = 1, #data, 3 do
        local a, b, c = data:byte(pos, pos + 2)
        local n = a * 65536 + (b or 0) * 256 + (c or 0)
        local i = math.floor(n / 262144) % 64 + 1
        local j = math.floor(n / 4096) % 64 + 1
        local k = math.floor(n / 64) % 64 + 1
        local l = n % 64 + 1
        result[#result + 1] = chars:sub(i, i) .. chars:sub(j, j) .. (b and chars:sub(k, k) or '=') .. (c and chars:sub(l, l) or '=')
    end
    return table.concat(result)
end

local function safe_id(value)
    local id = tostring(value or '')
    return id:match('^%d+$') and id or nil
end

local function schema_entries(schema)
    local entries = {}
    if type(schema) ~= 'table' or type(schema.achievements) ~= 'table' then return entries end
    for _, row in ipairs(schema.achievements) do
        local id = safe_id(row.achievement_id)
        if id then
            local text = {}
            if type(row.localizations) == 'table' then
                for _, translation in ipairs(row.localizations) do
                    if translation.locale and translation.locale.identifier == 'en_US' then text = translation break end
                end
                if not next(text) then text = row.localizations[1] or {} end
            end
            entries[#entries + 1] = { id = id, name = tostring(text.name or id), description = tostring(text.description or text.locked_description or '') }
        end
    end
    return entries
end

local function filetime_seconds(value)
    local number = tonumber(value)
    if not number then return 0 end
    local seconds = math.floor(number / 10000000 - 11644473600)
    if seconds < 946684800 or seconds > os.time() + 86400 then return 0 end
    return seconds
end

local function parse_toml(content)
    local unlocked, current = {}, nil
    for line in (content .. '\n'):gmatch('(.-)\r?\n') do
        local id = line:match('^%s*%[unlocked%.(%d+)%]%s*$')
        if id then current = id; unlocked[id] = 0
        elseif line:match('^%s*%[') then current = nil
        elseif current then
            local time = line:match('^%s*filetime%s*=%s*(%d+)%s*$')
            if time then unlocked[current] = filetime_seconds(time) end
        end
    end
    for legacy in content:gmatch('unlocked%s*=%s*%[([%d%s,]*)%]') do
        for id in legacy:gmatch('%d+') do unlocked[id] = unlocked[id] or 0 end
    end
    return unlocked
end

local function icon_data(root, title_id, id, icon_map)
    local image_id = type(icon_map) == 'table' and safe_id(icon_map[id]) or id
    if not image_id then return nil end
    local path = fs.join(root, 'icon_cache', 'x360recomp', title_id, image_id .. '.png')
    local data = read(path, true)
    if data and #data <= 262144 and data:sub(1, 8) == '\137PNG\r\n\26\n' then
        return 'data:image/png;base64,' .. base64(data)
    end
    return nil
end

---@ffi
---@param shortcut_app_id string
---@return string
function get_achievements(shortcut_app_id)
    logger:info('[MAPPING] get_achievements called with: ' .. tostring(shortcut_app_id))
    local id = safe_id(shortcut_app_id)
    if not id then return json.encode({ stage = 'MAPPING', error = 'Invalid shortcut AppID' }) end
    local config_path = fs.join(millennium.steam_path(), 'millennium', 'plugins', 'org.awnext.steambridge.config.json')
    logger:info('[MAPPING] Config path: ' .. config_path)
    local config = read_json(config_path)
    if not config or type(config.games) ~= 'table' then return json.encode({ stage = 'MAPPING', error = 'Local bridge configuration unavailable', configPath = config_path }) end
    local game = config.games[id]
    if type(game) ~= 'table' then 
        logger:warn('[MAPPING] No config for game ' .. id)
        return json.encode({ notConfigured = true }) 
    end
    logger:info('[MAPPING] Found config for game ' .. id .. ' adapter=' .. tostring(game.adapter))
    if game.adapter ~= 'x360recomp-toml' then return json.encode({ stage = 'MAPPING', error = 'Unsupported adapter' }) end
    local title_id = tostring(game.titleId or ''):upper()
    if not title_id:match('^[0-9A-F]+$') or #title_id ~= 8 then return json.encode({ stage = 'MAPPING', error = 'Invalid title ID' }) end
    local root = config.awnDataRoot or os.getenv('AW_USER_DATA') or fs.join(os.getenv('APPDATA') or '', 'Achievement Watcher Next')
    logger:info('[DATA] awnDataRoot=' .. tostring(root) .. ' titleId=' .. title_id)
    if type(game.stateRoot) ~= 'string' or game.stateRoot == '' then return json.encode({ stage = 'MAPPING', error = 'Missing stateRoot' }) end
    local profile = game.profile or 'user'
    if type(profile) ~= 'string' or not profile:match('^user[%w%-]*$') then return json.encode({ stage = 'MAPPING', error = 'Invalid profile' }) end
    local state_path = fs.join(game.stateRoot, profile, 'achievements', title_id .. '.toml')
    logger:info('[DATA] state_path=' .. state_path)
    local content = read(state_path)
    if not content or #content > 1048576 then return json.encode({ stage = 'DATA', error = 'Unlock list unavailable', statePath = state_path }) end
    local unlocked = parse_toml(content)
    local schema_path = fs.join(root, 'steam_cache', 'x360recomp', title_id .. '.json')
    logger:info('[DATA] schema_path=' .. schema_path)
    local rows = schema_entries(read_json(schema_path))
    if #rows == 0 then return json.encode({ stage = 'DATA', error = 'AWN catalog unavailable', schemaPath = schema_path }) end
    local earned = 0
    for _, row in ipairs(rows) do
        row.unlocked = unlocked[row.id] ~= nil
        row.unlockTime = unlocked[row.id] or 0
        row.icon = icon_data(root, title_id, row.id, game.iconMap)
        if row.unlocked then earned = earned + 1 end
    end
    logger:info(string.format('[DATA] Read %d/%d achievements for shortcut %s', earned, #rows, id))
    return json.encode({ title = game.title or 'Forza Horizon', source = 'AWN local x360 recomp', total = #rows, unlocked = earned, achievements = rows })
end
