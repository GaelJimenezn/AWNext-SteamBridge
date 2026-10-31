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

-- SteamGridDB backend HTTP transport
local sgdb = require("services.steamgriddb")

---@ffi
---@param key string
---@return string
function sgdb_configure(key)
    return sgdb.configure(key)
end

---@ffi
---@return string
function sgdb_status()
    return sgdb.status()
end

---@ffi
---@return string
function sgdb_disconnect()
    return sgdb.disconnect()
end

---@ffi
---@return string
function sgdb_test()
    return sgdb.test()
end

---@ffi
---@param title string
---@return string
function sgdb_search(title)
    return sgdb.search(title)
end

---@ffi
---@param game_id string
---@param kind string
---@return string
function sgdb_artwork(game_id, kind)
    return sgdb.artwork(game_id, kind)
end

---@ffi
---@return string
function sgdb_accounts()
    return require("services.steamgriddb").accounts()
end

---@ffi
---@param appid string
---@param account string
---@param kind string
---@param url string
---@return string
function sgdb_apply(appid, account, kind, url)
    return require("services.steamgriddb").apply(appid, account, kind, url)
end

---@ffi
---@param url string
---@return string
function sgdb_native_image(url)
    return require("services.steamgriddb").native_image(url)
end