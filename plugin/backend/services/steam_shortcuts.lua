local fs = require("fs")
local millennium = require("millennium")
local atomic = require("utils.atomic_file")
local identity = require("services.game_identity")
local M = {}

local function account_id(steamid)
    local id = 0
    for digit in steamid:gmatch("%d") do id = (id * 10 + tonumber(digit)) % 4294967296 end
    return string.format("%.0f", id)
end

function M.registry_account()
    if not jit or jit.os~="Windows" then return nil end
    local ok, result=pcall(function()
        local ffi=require("ffi")
        ffi.cdef[[long RegGetValueA(void *, const char *, const char *, unsigned long, unsigned long *, void *, unsigned long *);]]
        local advapi=ffi.load("Advapi32")
        local value=ffi.new("unsigned long[1]")
        local size=ffi.new("unsigned long[1]",4)
        local hive=ffi.cast("void *",ffi.cast("intptr_t",-2147483647))
        if advapi.RegGetValueA(hive,"Software\\Valve\\Steam\\ActiveProcess","ActiveUser",16,nil,value,size)~=0 or value[0]==0 then return nil end
        return string.format("%.0f",tonumber(value[0]))
    end)
    return ok and result or nil
end

function M.account()
    local bytes = atomic.read(fs.join(millennium.steam_path(), "config", "loginusers.vdf"), 1048576)
    if not bytes then return nil, "Cannot determine the active Steam account" end
    local ids, known, automatic = {}, {}, {}
    for steamid, block in bytes:gmatch('"(%d+)"%s*%{(.-)%}') do
        local id=account_id(steamid)
        known[id]=true
        if block:match('"MostRecent"%s*"1"') then
            ids[#ids+1] = id
        end
        if block:match('"AutoLogin"%s*"1"') then automatic[#automatic+1]=id end
    end
    local active=M.registry_account()
    if active and known[active] then return active,nil,"active-process" end
    if #ids==0 and #automatic==1 then return automatic[1],nil,"autologin-readonly" end
    if #ids ~= 1 then return nil, "Active Steam account is ambiguous" end
    return ids[1],nil,"most-recent"
end

function M.parse(bytes)
    local cursor = 1
    local function string_value()
        local finish = bytes:find("\0", cursor, true)
        if not finish then error("Truncated VDF string") end
        local value = bytes:sub(cursor, finish-1)
        cursor = finish+1
        return value
    end
    local function map(depth)
        if depth > 12 then error("VDF nesting limit") end
        local result = {}
        while cursor <= #bytes do
            local kind = bytes:byte(cursor); cursor=cursor+1
            if kind == 8 then return result end
            local key = string_value():lower()
            if kind == 0 then result[key]=map(depth+1)
            elseif kind == 1 then result[key]=string_value()
            elseif kind == 2 then
                local a,b,c,d=bytes:byte(cursor,cursor+3)
                if not d then error("Truncated VDF integer") end
                cursor=cursor+4; result[key]=a+b*256+c*65536+d*16777216
            elseif kind == 7 then
                if cursor+7>#bytes then error("Truncated VDF uint64") end
                cursor=cursor+8
            else error("Unsupported VDF type") end
        end
        error("Truncated VDF map")
    end
    return map(0)
end

function M.list()
    local account, err, source = M.account()
    if not account then return {}, nil, err end
    local bytes = atomic.read(fs.join(millennium.steam_path(), "userdata", account, "config", "shortcuts.vdf"), 8388608)
    if not bytes then return {}, account, "Steam shortcuts.vdf is unavailable" end
    local ok, data = pcall(M.parse, bytes)
    if not ok or type(data.shortcuts) ~= "table" then return {}, account, "Invalid Steam shortcuts.vdf" end
    local list = {}
    for _, item in pairs(data.shortcuts) do
        if type(item) == "table" then
            local id = identity.shortcut_id(item.appid)
            if id then
                local options = item.launchoptions or ""
                local steam_id = options:match("steam://rungameid/(%d+)") or options:match("%-applaunch%s+(%d+)")
                list[id] = { appid=id, name=item.appname or "", exe=item.exe, startDir=item.startdir, launchOptions=options, steamId=steam_id }
            end
        end
    end
    return list, account, nil, source
end
return M
