local json = require("json")
local fs = require("fs")
local millennium = require("millennium")
local compat = require("services.product_compat")
local atomic = require("utils.atomic_file")
local cache = require("utils.asset_cache")
local document = require("utils.json_document")
local M = { VERSION = 1 }

function M.token(bytes)
    local a, b = 5381, 52711
    for i = 1, #bytes do
        a = (a * 33 + bytes:byte(i)) % 4294967296
        b = (b * 65599 + bytes:byte(i)) % 4294967296
    end
    -- Optimistic concurrency fingerprint, not a security hash.
    return string.format("%08x%08x:%d", a, b, #bytes)
end

function M.target()
    return fs.join(millennium.steam_path(), "millennium", "plugins", "library-customizer.config.json")
end

local function decode(bytes)
    local ok, config = pcall(json.decode, bytes)
    if not ok or type(config) ~= "table" then return nil, "Invalid configuration JSON" end
    local parsed, root=pcall(document.parse,bytes)
    if not parsed or root.kind~="object" then return nil,"Configuration must be a JSON object" end
    for _,child in ipairs(root.children) do
        if (child.key=="games" or child.key=="identities") and child.node.kind~="object" then return nil,"Game and identity maps must be JSON objects" end
    end
    if config.schemaVersion ~= nil and config.schemaVersion ~= M.VERSION then return nil, "Unsupported configuration schema version", "unsupported-schema" end
    if config.games ~= nil and type(config.games) ~= "table" then return nil, "Invalid legacy games map" end
    if config.identities ~= nil and type(config.identities) ~= "table" then return nil, "Invalid identities map" end
    for key, entry in pairs(config.identities or {}) do
        if type(key)~="string" or not key:match("^%d+:shortcut:%d+$") or type(entry)~="table" then return nil,"Invalid identity scope" end
        if entry.providers~=nil and type(entry.providers)~="table" then return nil,"Invalid provider map" end
        for provider,ref in pairs(entry.providers or {}) do
            if type(provider)~="string" or type(ref)~="table" or type(ref.id)~="string" then return nil,"Invalid stored provider reference" end
        end
        if entry.achievementMode~=nil and entry.achievementMode~="auto" and entry.achievementMode~="awn" and entry.achievementMode~="port" and entry.achievementMode~="none" then return nil,"Invalid achievement mode" end
        if entry.port~=nil and type(entry.port)~="table" then return nil,"Invalid stored port mapping" end
        for _,field in ipairs({"origin","edition"}) do if entry[field]~=nil and type(entry[field])~="string" then return nil,"Invalid stored identity metadata" end end
    end
    if config.revision ~= nil and (type(config.revision) ~= "number" or config.revision < 0 or config.revision >= 9007199254740991 or config.revision % 1 ~= 0) then return nil, "Invalid revision" end
    -- In-memory migration retains every legacy/unknown field; loading never writes.
    config.games = config.games or {}
    config.identities = config.identities or {}
    config.revision = config.revision or 0
    return config
end

function M.load()
    local path = compat.config_path()
    local bytes, read_error = atomic.read(path)
    if not bytes and fs.is_file(path) then return { ok = false, error = read_error or "Cannot read configuration", path = path } end
    bytes = bytes or "{}"
    local config, err, reason = decode(bytes)
    local backup = atomic.read(M.target() .. ".bak")
    local good_backup = backup and decode(backup) or nil
    return { ok = config ~= nil, config = config, error = err, path = path, raw = bytes,
        token = M.token(bytes), revision = config and config.revision or nil,
        needsMigration = config and config.schemaVersion == nil or false,
        schemaUnsupported = reason=="unsupported-schema", recoveryAvailable = good_backup ~= nil and reason~="unsupported-schema" }
end

local function locked(action)
    local lock = M.target() .. ".lock"
    local ok, created = pcall(fs.create_directory, lock)
    if not ok or not created then return { ok = false, error = "Configuration is locked; inspect the .lock directory before retrying" } end
    local ran, result = pcall(action)
    local released, removed = pcall(fs.remove, lock)
    if not ran then return { ok = false, error = tostring(result) } end
    if not released or not removed then result.warning = "Configuration lock cleanup failed; inspect the .lock directory" end
    return result
end

function M.update(expected_token, mutate)
    return locked(function()
        local state = M.load()
        if not state.ok then return { ok = false, error = state.error, recoveryAvailable = state.recoveryAvailable } end
        if type(expected_token) ~= "string" or expected_token ~= state.token then return { ok = false, conflict = true, error = "Configuration changed; reload before saving" } end
        local ok, err = mutate(state.config)
        if not ok then return { ok = false, error = err } end
        state.config.schemaVersion = M.VERSION
        state.config.revision = state.config.revision + 1
        local bytes = document.encode(state.raw,state.config)
        if #bytes>4194304 then return {ok=false,error="Configuration exceeds the supported size; nothing was saved"} end
        local valid, validation_error = decode(bytes)
        if not valid then return { ok = false, error = validation_error } end
        -- Back up exact original bytes before modifying the new file. Legacy is never written.
        local backed, backup_error = atomic.write(M.target() .. ".bak", state.raw)
        if not backed then return { ok = false, error = "Backup failed: " .. tostring(backup_error) } end
        if M.load().token ~= state.token then return { ok = false, conflict = true, error = "Configuration changed during save" } end
        local saved, save_error = atomic.write(M.target(), bytes)
        if not saved then return { ok = false, error = "Save failed; original and backup remain available: " .. tostring(save_error) } end
        cache.clear()
        return { ok = true, token = M.token(bytes), revision = state.config.revision, backup = M.target() .. ".bak" }
    end)
end

function M.recover(expected_token)
    return locked(function()
        local state = M.load()
        if state.ok then return { ok = false, error = "Current configuration is valid; recovery is not needed" } end
        if state.schemaUnsupported then return {ok=false,error="Future schema must not be downgraded by recovery"} end
        if state.token ~= expected_token then return { ok = false, conflict = true, error = "Configuration changed; reload before recovery" } end
        local bytes = atomic.read(M.target() .. ".bak")
        if not bytes or not decode(bytes) then return { ok = false, error = "No valid backup is available" } end
        local preserved, err = atomic.write(M.target() .. ".corrupt." .. state.token:gsub(":", "_"), state.raw)
        if not preserved then return { ok = false, error = "Cannot preserve damaged configuration: " .. tostring(err) } end
        if M.load().token~=state.token then return {ok=false,conflict=true,error="Configuration changed during recovery; reload"} end
        local restored, restore_error = atomic.write(M.target(), bytes)
        if not restored then return { ok = false, error = tostring(restore_error) } end
        cache.clear()
        return { ok = true, token = M.token(bytes), recovered = true }
    end)
end
return M
