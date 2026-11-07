-- Rename compatibility only: no writes, merge, or identity changes at runtime.
local fs = require("fs")
local millennium = require("millennium")
local M = {}

function M.config_path()
    local root = fs.join(millennium.steam_path(), "millennium", "plugins")
    local current = fs.join(root, "library-customizer.config.json")
    -- An existing invalid new config must surface its error, not silently use old data.
    if fs.is_file(current) then return current end
    return fs.join(root, "org.awnext.steambridge.config.json")
end

function M.data_dir()
    return fs.join(os.getenv("APPDATA") or "", "library-customizer")
end

function M.secret_read_path()
    local current = fs.join(M.data_dir(), "secrets", "steamgriddb.bin")
    -- Once the new secrets directory exists it owns the credential lifecycle.
    -- This prevents disconnect from resurrecting an older credential.
    if fs.is_directory(fs.join(M.data_dir(), "secrets")) then return current end
    return fs.join(os.getenv("APPDATA") or "", "AWNext-SteamBridge", "secrets", "steamgriddb.bin")
end

return M
