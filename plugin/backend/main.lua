local logger = require('logger')
local millennium = require('millennium')
require('rpc_functions')

local function on_load()
    logger:info('Library Customizer loaded; Millennium ' .. millennium.version())
    millennium.ready()
end

local function on_unload()
    logger:info('Library Customizer unloaded')
end

return { on_load = on_load, on_unload = on_unload }
