local logger = require('logger')
local json = require('json')
local resolver = require('services.achievement_resolver')

---@ffi
---@param shortcut_app_id string
---@param game_title string
---@return string
function get_achievements(shortcut_app_id, game_title)
    return resolver.get_achievements(shortcut_app_id, game_title)
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

local discovery = require("services.awn_discovery")

---@ffi
---@return string
function list_awn_games()
    return discovery.list_games()
end
---@ffi
---@return string
function get_provider_status()
    return require("services.provider_status").status()
end