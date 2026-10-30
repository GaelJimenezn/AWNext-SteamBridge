local logger = require('logger')
local millennium = require('millennium')
require('rpc_functions')

local function on_load()
    logger:info('AWNext Steam Bridge loaded; Millennium ' .. millennium.version())
    millennium.ready()
end

local function on_unload()
    logger:info('AWNext Steam Bridge unloaded')
end

return { on_load = on_load, on_unload = on_unload }
