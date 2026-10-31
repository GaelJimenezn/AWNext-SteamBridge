-- Resolves achievement requests to their corresponding adapter.
-- Additional sources will be registered here in future phases.

local x360recomp = require('adapters.x360recomp')

local function get_achievements(shortcut_app_id)
    return x360recomp.get_achievements(shortcut_app_id)
end

return {
    get_achievements = get_achievements
}
