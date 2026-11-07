local json = require("json")

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

local function from_game(found, game_title)
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

return { from_game = from_game }