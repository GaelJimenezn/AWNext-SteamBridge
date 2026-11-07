local json = require("json")
local engine = require("services.game_identity")
local store = require("services.config_store")
local awn = require("services.awn_repository")
local steam = require("services.steam_shortcuts")
local installation = require("services.installation_status")
local M = {}
local modes = { auto=true, awn=true, port=true, none=true }
local function clone(value) return json.decode(json.encode(value)) end
local function key(account, id) return (account or "unscoped") .. ":shortcut:" .. id end
local function ref_valid(ref)
    return type(ref)=="table" and type(ref.id)=="string" and #ref.id>0 and #ref.id<=128 and not ref.id:find("[%z\1-\31]")
        and (ref.source==nil or type(ref.source)=="string" and #ref.source<=128)
end

function M.resolve(shortcut, config, candidates, account)
    local saved = config.identities[key(account, shortcut.appid)]
    if type(saved) ~= "table" then saved = {} end
    local port = saved.port or config.games[shortcut.appid]
    local mode = saved.achievementMode or "auto"
    local context = clone(shortcut)
    context.edition = saved.edition or context.edition
    context.origin = saved.origin or context.origin
    local refs = type(saved.providers)=="table" and saved.providers or {}
    context.steamId = refs.steam and refs.steam.id or context.steamId
    local resolution = engine.resolve(context, candidates, refs.awn)
    if mode == "none" then resolution={status="disabled",explanation="manual_achievement_disable",candidates=resolution.candidates}
    elseif mode == "port" or (mode=="auto" and type(port)=="table" and port.adapter) then
        resolution={status="manual-port",explanation="preserved_x360recomp_mapping",candidates=resolution.candidates}
    end
    return { key=key(account,shortcut.appid), appid=shortcut.appid, name=shortcut.name, shortcut=shortcut,
        providers=refs, entry=saved, port=port, resolution=resolution }
end

function M.context()
    local state = store.load()
    local shortcuts, account, shortcut_error = steam.list()
    if not state.ok then return state, shortcuts, account, {}, nil, shortcut_error end
    local snapshot, snapshot_error = awn.load(state.config)
    return state, shortcuts, account, awn.candidates(snapshot), snapshot, shortcut_error, snapshot_error
end

function M.library(input)
    if type(input)~="table" or #input>5000 then return {ok=false,error="Invalid shortcut request"} end
    local state, shortcuts, account, candidates, _, shortcut_error, snapshot_error = M.context()
    local _, _, account_source=steam.account()
    local activation = installation.status()
    local response = {ok=state.ok, token=state.token, revision=state.revision, schemaVersion=store.VERSION,
        needsMigration=state.needsMigration, recoveryAvailable=state.recoveryAvailable, error=state.error,
        accountId=account, accountSource=account_source, writable=state.ok and account~=nil and shortcut_error==nil and activation.mayRun and account_source~="autologin-readonly",
        shortcutError=shortcut_error, snapshotError=snapshot_error, installation=activation, games={}, awnGames=candidates}
    if not state.ok then return response end
    -- VDF inventory and names are authoritative; cached UI titles can belong to another account.
    local names = {}
    for _, item in ipairs(input) do
        if type(item)=="table" and engine.shortcut_id(item.appid) and type(item.name)=="string" and #item.name<=512 then names[engine.shortcut_id(item.appid)]=item.name end
    end
    if shortcut_error then
        for id,name in pairs(names) do shortcuts[id]={appid=id,name=name} end
    else
        for id,item in pairs(shortcuts) do if item.name=="" and names[id] then item.name=names[id] end end
    end
    for _, shortcut in pairs(shortcuts) do response.games[#response.games+1]=M.resolve(shortcut,state.config,candidates,account) end
    table.sort(response.games,function(a,b) return a.name:lower()<b.name:lower() end)
    return response
end

function M.save(request)
    if type(request)~="table" then return {ok=false,error="Invalid request"} end
    local activation=installation.status()
    if not activation.mayRun then return {ok=false,error=activation.error} end
    local shortcuts, account, err, source=steam.list()
    local id=engine.shortcut_id(request.appid)
    if err or not account or source=="autologin-readonly" or request.accountId~=account or not id or not shortcuts[id] then return {ok=false,error=err or "Account changed, unconfirmed, or shortcut unavailable; reload"} end
    return store.update(request.token,function(config)
        local k=key(account,id)
        if request.reset==true then config.identities[k]=nil; return true end
        local patch=request.entry
        if type(patch)~="table" or not modes[patch.achievementMode] or type(patch.providers)~="table" then return nil,"Invalid identity entry" end
        local previous=type(config.identities[k])=="table" and config.identities[k] or {}
        local entry=clone(previous)
        local providers={}
        for provider,ref in pairs(patch.providers) do
            if type(provider)~="string" or #provider>48 or not provider:match("^[a-z][a-z0-9_-]*$") or not ref_valid(ref) then return nil,"Invalid provider reference" end
            if (provider=="steam" or provider=="steamgriddb") and (not ref.id:match("^%d+$") or tonumber(ref.id)<1 or tonumber(ref.id)>4294967295) then return nil,"Invalid catalog provider ID" end
            local old=previous.providers and previous.providers[provider]
            providers[provider]=type(old)=="table" and clone(old) or {}
            for field,value in pairs(ref) do providers[provider][field]=value end
        end
        for _,field in ipairs({"edition","origin"}) do
            if patch[field]~=nil and (type(patch[field])~="string" or #patch[field]>128) then return nil,"Invalid "..field end
            entry[field]=patch[field]
        end
        entry.providers=providers
        entry.achievementMode=patch.achievementMode
        entry.shortcut={appid=id,accountId=account}
        if patch.port~=nil then
            if type(patch.port)~="table" then return nil,"Invalid port mapping" end
            entry.port=clone(previous.port or config.games[id] or {})
            -- Deliberately retain iconMap and every unknown legacy field.
            for _,field in ipairs({"adapter","titleId","stateRoot","profile","title"}) do
                if patch.port[field]~=nil then
                    if type(patch.port[field])~="string" or #patch.port[field]>4096 or patch.port[field]:find("%z") then return nil,"Invalid port field" end
                    entry.port[field]=patch.port[field]
                end
            end
            if entry.port.adapter~="x360recomp-toml" or not (entry.port.titleId or ""):match("^[%x][%x][%x][%x][%x][%x][%x][%x]$")
                or not (entry.port.profile or "user"):match("^user[%w%-]*$") or not entry.port.stateRoot or entry.port.stateRoot=="" then return nil,"Invalid x360recomp mapping" end
            entry.port.titleId=entry.port.titleId:upper()
        end
        if entry.achievementMode=="port" and not (entry.port or config.games[id]) then return nil,"Port mode requires a mapping" end
        if entry.achievementMode=="awn" and not providers.awn then return nil,"AWN mode requires an explicit provider reference" end
        config.identities[k]=entry
        return true
    end)
end

function M.recover(request)
    if type(request)~="table" or not installation.status().mayRun then return {ok=false,error="Installation state prevents recovery"} end
    return store.recover(request.token)
end

function M.provider(request)
    if type(request)~="table" or type(request.candidates)~="table" or #request.candidates>200 or (request.provider~="steam" and request.provider~="steamgriddb") then return {ok=false,error="Invalid provider request"} end
    local state=store.load()
    if not state.ok then return {ok=false,error=state.error} end
    local shortcuts,account=steam.list()
    local shortcut=shortcuts[tostring(request.appid)] or {appid=tostring(request.appid),name=request.name or ""}
    local saved=state.config.identities[key(account,shortcut.appid)] or {}
    shortcut.edition=saved.edition
    local candidates={}
    for _,item in ipairs(request.candidates) do
        local id=type(item)=="table" and tonumber(item.id) or nil
        if id and id>=1 and id<=4294967295 and id%1==0 and type(item.name)=="string" and #item.name<=512 then
            local canonical=string.format("%.0f",id)
            candidates[#candidates+1]={id=canonical,name=item.name,provider=request.provider,steamId=request.provider=="steam" and canonical or nil}
        end
    end
    return {ok=true,resolution=engine.resolve(shortcut,candidates,saved.providers and saved.providers[request.provider])}
end
return M
