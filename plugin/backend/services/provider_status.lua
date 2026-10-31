local json = require("json")
local fs = require("fs")
local cache = require("utils.asset_cache")

local function status()
    local appdata = os.getenv("APPDATA")
    if type(appdata) ~= "string" or appdata == "" then
        return json.encode({ ok = false, awn = { connected = false, reason = "APPDATA unavailable" } })
    end
    local path = fs.join(appdata, "Achievement Watcher Next", "Cache", "library_snapshot", "library.json")
    local file = io.open(path, "rb")
    if not file then
        return json.encode({ ok = true, awn = { connected = false, reason = "Library snapshot missing" } })
    end
    local data = file:read("*a")
    file:close()
    if not data or #data > 33554432 then
        return json.encode({ ok = true, awn = { connected = false, reason = "Snapshot empty or too large" } })
    end
    local ok, result = pcall(json.decode, data)
    if not ok or type(result) ~= "table" or type(result.games) ~= "table" then
        return json.encode({ ok = true, awn = { connected = false, reason = "Snapshot JSON invalid" } })
    end
    local total, external = 0, 0
    for _, game in pairs(result.games) do
        if type(game) == "table" then
            total = total + 1
            if game.steamOfficial == false then external = external + 1 end
        end
    end
    return json.encode({ ok = true, awn = { connected = true, total = total, external = external, version = tostring(result.appVersion or "unknown") } })
end

return { status = status }