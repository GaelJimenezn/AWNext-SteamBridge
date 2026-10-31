local function filetime_seconds(value)
    local number = tonumber(value)
    if not number then
        return 0
    end
    local seconds = math.floor(number / 10000000 - 11644473600)
    if seconds < 946684800 or seconds > os.time() + 86400 then
        return 0
    end
    return seconds
end

local function parse_toml(content)
    local unlocked, current = {}, nil
    for line in (content .. '\n'):gmatch('(.-)\r?\n') do
        local id = line:match('^%s*%[unlocked%.(%d+)%]%s*$')
        if id then
            current = id
            unlocked[id] = 0
        elseif line:match('^%s*%[') then
            current = nil
        elseif current then
            local time = line:match('^%s*filetime%s*=%s*(%d+)%s*$')
            if time then
                unlocked[current] = filetime_seconds(time)
            end
        end
    end
    for legacy in content:gmatch('unlocked%s*=%s*%[([%d%s,]*)%]') do
        for id in legacy:gmatch('%d+') do
            unlocked[id] = unlocked[id] or 0
        end
    end
    return unlocked
end
return parse_toml
