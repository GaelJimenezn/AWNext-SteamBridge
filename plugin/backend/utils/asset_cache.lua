-- Cache static assets while keeping the unlock state live.
-- Cache missing optional icons to avoid repeated disk access.

local entries = {}
local entry_count = 0
local max_entries = 512

local function get(key, ttl_seconds, loader, cache_missing)
    local now = os.time()
    local cached = entries[key]

    if cached and now < cached.expires then
        return cached.value == false and nil or cached.value
    end

    local value = loader()

    if value == nil and not cache_missing then
        if entries[key] then
            entries[key] = nil
            entry_count = entry_count - 1
        end
        return nil
    end

    if not cached and entry_count >= max_entries then
        entries = {}
        entry_count = 0
    end

    if not entries[key] then
        entry_count = entry_count + 1
    end

    entries[key] = {
        value = value == nil and false or value,
        expires = now + ttl_seconds,
    }

    return value
end

local function clear()
    entries = {}
    entry_count = 0
end

return {
    get = get,
    clear = clear,
}
