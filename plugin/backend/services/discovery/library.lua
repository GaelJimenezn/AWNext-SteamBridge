local engine=require("services.game_identity")
local sources=require("services.discovery.sources")
local providers={
    ubisoft=require("services.discovery.ubisoft"),xbox=require("services.discovery.xbox"),gamepass=require("services.discovery.gamepass"),
    epic=require("services.discovery.epic"),gog=require("services.discovery.gog"),
}
local M={}
local cache={}
local revision=0
local order={"ubisoft","xbox","gamepass","epic","gog"}
function M.scan(id,ctx)
    if not providers[id] then return {ok=false,error="Unknown discovery provider"} end
    revision=revision+1
    ctx=ctx or sources.new()
    local ok,result=pcall(providers[id].scan,ctx)
    if not ok and cache[id] then
        cache[id].revision=revision;cache[id].status="error";cache[id].stale=true;cache[id].attemptedAt=ctx.now;cache[id].errors={"Refresh failed; previous observations retained"};return cache[id]
    end
    if not ok then result={records={},errors={"Local provider scan failed; other providers are unaffected"},limitations={},coverage="unavailable"} end
    local grouped={}
    for _,record in ipairs(result.records or {}) do
        local old=grouped[record.id]
        if not old then grouped[record.id]=record
        else
            -- Same provider ID is the stable game key; retain installations and evidence separately.
            for _,installation in ipairs(record.installations) do
                local duplicate=false
                for _,current in ipairs(old.installations) do if current.id==installation.id then duplicate=true end end
                if not duplicate then old.installations[#old.installations+1]=installation end
            end
            for _,license in ipairs(record.licenses or {}) do
                local duplicate=false
                for _,existing in ipairs(old.licenses or {}) do
                    if existing.id==license.id and existing.type==license.type and existing.entitlement==license.entitlement and existing.source==license.source then duplicate=true end
                end
                if not duplicate then old.licenses[#old.licenses+1]=license end
            end
            if old.name~=record.name then
                old.game.aliases=old.game.aliases or {}
                old.game.aliases[#old.game.aliases+1]=record.name
            end
            for _,evidence in ipairs(record.evidence) do old.evidence[#old.evidence+1]=evidence end
            if record.installed=="installed" then old.installed="installed" end
            if old.catalogOnly and not record.catalogOnly then old.catalogOnly=false end
            if old.nameResolved==false and record.nameResolved~=false then old.name=record.name;old.game.name=record.name;old.nameResolved=record.nameResolved end
        end
    end
    result.records={}
    for _,record in pairs(grouped) do result.records[#result.records+1]=record end
    table.sort(result.records,function(a,b) return a.id<b.id end)
    result.revision=revision;result.id=id;result.name=providers[id].name;result.lastChecked=ctx.now
    result.status=#result.errors>0 and (#result.records>0 and "partial" or "error") or result.coverage=="unavailable_without_entitlements" and "limited" or "ready"
    result.ok=ok
    cache[id]=result
    return result
end
function M.snapshot()
    local list={}
    for _,id in ipairs(order) do list[#list+1]=cache[id] or {id=id,name=providers[id].name,status="not_checked",records={},errors={},limitations={}} end
    -- Potential duplicates only. Never merge different provider products/installations/licenses by title.
    local all={}
    for _,provider in ipairs(list) do for _,record in ipairs(provider.records) do all[#all+1]=record end end
    local buckets={}
    local function keys(record)
        local result={}
        if record.nameResolved~=false then
            local title=engine.title(record.name)
            if title~="" then result[#result+1]="title:"..title end
        end
        for _,install in ipairs(record.installations or {}) do
            if install.launch and install.launch.kind=="executable" then result[#result+1]="exe:"..engine.path(install.launch.target) end
        end
        return result
    end
    for _,record in ipairs(all) do
        for _,key in ipairs(keys(record)) do buckets[key]=buckets[key] or {};buckets[key][#buckets[key]+1]=record end
    end
    for _,record in ipairs(all) do
        record.identity={candidates={},conflicts={}}
        local seen={}
        local compared=0
        for _,key in ipairs(keys(record)) do
            for _,other in ipairs(buckets[key]) do
                if compared>=50 then break end
                if record.id~=other.id and not seen[other.id] and compared<50 then
                    seen[other.id]=true;compared=compared+1
                    local left=record.installations[1] and record.installations[1].launch
                    local right=other.installations[1] and other.installations[1].launch
                    local match=engine.evaluate({name=record.nameResolved~=false and record.name or "",exe=left and left.kind=="executable" and left.target},
                        {id=other.id,name=other.nameResolved~=false and other.name or "",provider=other.provider,exe=right and right.kind=="executable" and right.target})
                    local target=match.eligible and record.identity.candidates or record.identity.conflicts
                    target[#target+1]=match
                end
            end
        end
        record.identity.comparisonLimit=50
    end
    local ran,shortcuts,account,shortcutError,accountSource=pcall(require("services.steam_shortcuts").list)
    local state=require("services.config_store").load()
    for _,record in ipairs(all) do
        record.shortcuts={}
        if ran then for id,shortcut in pairs(shortcuts) do
            local entry=state.ok and state.config.identities[(account or "unscoped")..":shortcut:"..id]
            local ref=entry and entry.providers and entry.providers[record.provider]
            local evaluated=engine.evaluate(shortcut,{id=record.id,name=record.nameResolved~=false and record.name or "",provider=record.provider})
            local manual=ref and ref.id==record.providerId
            if manual or evaluated.eligible then record.shortcuts[#record.shortcuts+1]={appid=id,kind=manual and "manual_reference" or "candidate",evidence=evaluated} end
        end end
    end
    return {ok=true,readOnly=true,revision=revision,providers=list,
        steamInventory={available=ran and shortcutError==nil,account=ran and account or nil,
            accountSource=accountSource,scope="persisted_shortcuts_only",liveVerified=false,
            error=not ran and "Steam inventory read failed" or shortcutError}}
end
function M.refresh(id,ctx)
    local result=M.scan(id,ctx)
    if not providers[id] then return result end
    return M.snapshot()
end
return M
