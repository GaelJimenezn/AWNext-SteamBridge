local store=require("services.config_store")
local M={}
local function copy(value)
    if type(value)~="table" then return value end
    local result={};for key,item in pairs(value) do result[key]=copy(item) end;return result
end
function M.new(account) return {version=1,mode="simulation",account=account,operations={}} end
function M.simulate(plan,previous)
    local journal=copy(previous or M.new(plan.account))
    if journal.account~=plan.account or journal.mode~="simulation" or journal.version~=1 then return {ok=false,error="Journal scope mismatch"} end
    local results={}
    for _,proposal in ipairs(plan.proposals) do
        local old=journal.operations[proposal.key]
        if old then results[#results+1]={key=proposal.key,status="already_recorded"}
        elseif not proposal.simulationEligible then results[#results+1]={key=proposal.key,status="blocked",reasons=proposal.blockers}
        else
            journal.operations[proposal.key]={owner="library-customizer",mode="simulation",id="sim:"..proposal.key,
                key=proposal.key,account=plan.account,provider=proposal.provider,providerId=proposal.providerId,
                installationId=proposal.installationId,fingerprint=proposal.fingerprint,status="simulated_created"}
            results[#results+1]={key=proposal.key,status="would_create",id="sim:"..proposal.key}
        end
    end
    return {ok=true,mode="simulation",writesEnabled=false,journal=journal,results=results}
end
function M.rollback(previous,keys,current,account)
    if previous.account~=account or previous.mode~="simulation" or previous.version~=1 then return {ok=false,error="Journal scope mismatch"} end
    local journal=copy(previous);local results={}
    for _,key in ipairs(keys) do
        local op=journal.operations[key]
        local status="not_owned"
        if op and op.owner=="library-customizer" and op.mode=="simulation" and op.account==account and op.id=="sim:"..key then
            if op.status=="simulated_rolled_back" then status="already_rolled_back"
            elseif current[op.id]==op.fingerprint then op.status="simulated_rolled_back";status="would_remove_owned"
            else status=current[op.id] and "manual_change_preserved" or "missing_preserved" end
        end
        results[#results+1]={key=key,status=status}
    end
    return {ok=true,mode="simulation",writesEnabled=false,journal=journal,results=results}
end
-- Not exposed by RPC/UI. Exercise existing atomic persistence only in isolated tests.
-- No real operation records can be stored until the runtime writer/ownership contract is implemented.
function M.persist_simulation(expected,journal)
    if type(journal)~="table" or journal.mode~="simulation" or journal.version~=1 or type(journal.account)~="string" or not journal.account:match("^%d+$") or type(journal.operations)~="table" then return {ok=false,error="Invalid simulation journal"} end
    for key,op in pairs(journal.operations) do
        if type(key)~="string" or type(op)~="table" or op.owner~="library-customizer" or op.mode~="simulation" or op.id~="sim:"..key or op.account~=journal.account or type(op.fingerprint)~="string" or (op.status~="simulated_created" and op.status~="simulated_rolled_back") then return {ok=false,error="Invalid simulation operation"} end
    end
    return store.update(expected,function(config)
        local root=config.shortcutManager or {version=1,simulations={}}
        if type(root)~="table" or root.version~=1 or type(root.simulations)~="table" then return false,"Unsupported shortcut journal" end
        root.simulations[journal.account]=copy(journal);config.shortcutManager=root;return true
    end)
end
return M
