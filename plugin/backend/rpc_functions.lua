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

local identity_service = require("services.identity_service")
local function identity_request(method, payload)
    if type(payload) ~= "string" or #payload > 1048576 then return json.encode({ok=false,error="Invalid identity payload"}) end
    local ok, request = pcall(json.decode, payload)
    if not ok then return json.encode({ok=false,error="Invalid identity JSON"}) end
    local ran, result = pcall(identity_service[method], request)
    return json.encode(ran and result or {ok=false,error="Identity operation failed: " .. tostring(result)})
end

---@ffi
---@param payload string
---@return string
function get_identity_library(payload)
    return identity_request("library", payload)
end

---@ffi
---@param payload string
---@return string
function save_game_identity(payload)
    return identity_request("save", payload)
end

---@ffi
---@param payload string
---@return string
function recover_identity_config(payload)
    return identity_request("recover", payload)
end

---@ffi
---@param payload string
---@return string
function resolve_identity_provider(payload)
    return identity_request("provider", payload)
end

---@ffi
---@return string
function get_installation_status()
    return json.encode(require("services.installation_status").status())
end

-- Universal Library Discovery: read-only RPC; provider IDs are an allowlist.
---@ffi
---@return string
function get_discovery_library()
    local ok,result=pcall(require("services.discovery.library").snapshot)
    return json.encode(ok and result or {ok=false,error="Discovery snapshot unavailable"})
end

---@ffi
---@param provider string
---@return string
function refresh_discovery_provider(provider)
    local ok,result=pcall(require("services.discovery.library").refresh,provider)
    return json.encode(ok and result or {ok=false,error="Provider refresh failed"})
end

-- Transient simulation only. No journal save or Steam mutation is exposed.
---@ffi
---@param payload string
---@return string
function simulate_shortcut_import(payload)
    if type(payload)~="string" or #payload>65536 then return json.encode({ok=false,error="Invalid simulation payload"}) end
    local decoded,request=pcall(json.decode,payload)
    if not decoded then return json.encode({ok=false,error="Invalid simulation JSON"}) end
    local ok,result=pcall(require("services.shortcuts.manager").simulate,request)
    return json.encode(ok and result or {ok=false,error="Shortcut simulation failed"})
end
