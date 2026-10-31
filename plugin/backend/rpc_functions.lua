local logger = require('logger')
local json = require('json')
local resolver = require('services.achievement_resolver')

---@ffi
---@param shortcut_app_id string
---@return string
function get_achievements(shortcut_app_id)
    return resolver.get_achievements(shortcut_app_id)
end
---@ffi
---@return string
function bridge_ping()
    logger:info('[AWN-DEBUG] bridge_ping executed')
    return json.encode({
        ok = true,
        message = 'Lua RPC operational',
    })
end
