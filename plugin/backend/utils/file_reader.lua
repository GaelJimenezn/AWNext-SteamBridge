local logger = require('logger')
local json = require('json')

local function read(path, binary)
    local file = io.open(path, binary and 'rb' or 'r')
    if not file then
        logger:warn('[BACKEND] Cannot open file: ' .. tostring(path))
        return nil
    end
    local data = file:read('*a')
    file:close()
    if data then
        logger:info(
            '[BACKEND] Read file: ' .. tostring(path) .. ' (' .. tostring(#data) .. ' bytes)'
        )
    end
    return data
end

local function read_json(path)
    local data = read(path)
    if not data then
        return nil
    end
    local ok, value = pcall(json.decode, data)
    if ok and type(value) == 'table' then
        return value
    end
    logger:warn('Invalid JSON: ' .. path)
    return nil
end

return {
    read = read,
    read_json = read_json,
}
