local discovery=require("services.discovery.library")
local steam=require("services.steam_shortcuts")
local engine=require("services.game_identity")
local journal=require("services.shortcuts.journal")
local fs=require("fs")
local M={}
local function path(value)
    if type(value)~="string" or #value>2048 or value:find('[%c"<>|?*]') or not value:match("^%a:[/\\]") or value:sub(3):find(":",1,true) then return false end
    for part in value:gmatch("[^/\\]+") do if part==".." or part=="." then return false end end
    return true
end
local function fingerprint(values)
    local fields={};for _,value in ipairs(values) do value=tostring(value);fields[#fields+1]=#value..":"..value end
    return table.concat(fields,"|")
end
function M.plan(request)
    if type(request)~="table" or type(request.items)~="table" or #request.items<1 or #request.items>100 then return {ok=false,error="Select between 1 and 100 installations"} end
    local snapshot=discovery.snapshot()
    if request.revision~=snapshot.revision then return {ok=false,error="Discovery changed; reload the preview"} end
    local shortcuts,account,inventoryError=steam.list()
    local result={ok=true,mode="simulation",writesEnabled=false,revision=snapshot.revision,account=account or "unknown",proposals={},
        gates={integrationVerified=false,apiWritesVerified=false,launcherExecutionVerified=false,approvalGranted=false,completeSteamInventory=false}}
    local lookup={}
    for _,provider in ipairs(snapshot.providers) do for _,record in ipairs(provider.records) do for _,installation in ipairs(record.installations) do
        lookup[fingerprint({record.id,installation.id})]={provider=provider,record=record,installation=installation}
    end end end
    local seen={}
    local commands={}
    for _,selection in ipairs(request.items) do
        if type(selection)~="table" or type(selection.recordId)~="string" or type(selection.installationId)~="string" then return {ok=false,error="Invalid installation selection"} end
        local selected=lookup[fingerprint({selection.recordId,selection.installationId})]
        if not selected then return {ok=false,error="Installation no longer observed; reload"} end
        local provider,record,installation=selected.provider,selected.record,selected.installation
        local key=fingerprint({result.account,record.provider,record.providerId,installation.id})
        if not seen[key] then
            seen[key]=true
            local blockers={};local duplicates={};local conflicts={}
            local function block(message) blockers[#blockers+1]=message end
            if inventoryError or not account then block("Steam persisted inventory unavailable") end
            if provider.stale or (provider.status~="ready" and provider.status~="partial") then block("Provider observation unavailable or stale") end
            if installation.status~="installed" then block("Installation not confirmed") end
            if record.nameResolved==false then block("Unresolved game name") end
            if not path(installation.path) or not fs.is_directory(installation.path) then block("Installation path invalid or missing") end
            local launch=installation.launch
            local command
            if not launch or launch.kind~="executable" or not launch.verified then block("Launch method not verified for simulation")
            elseif not path(launch.target) or not launch.target:lower():match("%.exe$") or not fs.is_file(launch.target) then block("Executable path invalid or missing")
            else
                local normalized=engine.path(launch.target);local root=engine.path(installation.path):gsub("/+$","")
                if normalized:sub(1,#root+1)~=root.."/" then block("Executable outside installation")
                else command={kind="executable",target=launch.target,startDir=installation.path,arguments={}} end
            end
            for id,shortcut in pairs(shortcuts) do
                local candidate=engine.evaluate(shortcut,{id=record.id,name=record.nameResolved~=false and record.name or "",provider=record.provider,exe=launch and launch.kind=="executable" and launch.target})
                local exactExe=launch and launch.kind=="executable" and engine.path(shortcut.exe)==engine.path(launch.target)
                if candidate.eligible then duplicates[#duplicates+1]={appid=id,evidence=candidate}
                elseif exactExe then conflicts[#conflicts+1]={appid=id,evidence=candidate} end
            end
            for _,ref in ipairs(record.shortcuts or {}) do if ref.kind=="manual_reference" then duplicates[#duplicates+1]={appid=ref.appid,kind="manual_reference"} end end
            if #duplicates>0 then block("Existing Steam association or duplicate candidate; preserve existing shortcuts") end
            if #conflicts>0 then block("Executable conflicts with game identity; never associate by executable alone") end
            if command then
                local commandKey=engine.path(command.target)
                if commands[commandKey] then block("Duplicate launch target within batch; review separate store identities")
                else commands[commandKey]=key end
            end
            local fields=fingerprint({record.name,command and command.target or "",command and command.startDir or ""})
            result.proposals[#result.proposals+1]={key=key,provider=record.provider,providerId=record.providerId,installationId=installation.id,
                name=record.name,command=command,fingerprint=fields,duplicates=duplicates,conflicts=conflicts,blockers=blockers,
                simulationEligible=#blockers==0,launcherCompatibility="unverified",rollback="owned_id_and_unchanged_fingerprint_only"}
        end
    end
    return result
end
function M.simulate(request)
    local plan=M.plan(request)
    if not plan.ok then return plan end
    local simulation=journal.simulate(plan)
    simulation.plan=plan
    return simulation
end
return M
