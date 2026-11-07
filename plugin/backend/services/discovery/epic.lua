local model=require("services.discovery.model")
local M={id="epic",name="Epic Games Launcher"}
function M.scan(ctx)
    local records,errors={},{}
    local root=ctx:join(ctx.programData,"Epic","EpicGamesLauncher","Data","Manifests")
    for _,file in ipairs(ctx:files(root,"%.item$")) do
        local item,err=ctx:json(file)
        if not item then errors[#errors+1]="Unreadable Epic manifest"
        elseif type(item.AppName)=="string" and type(item.DisplayName)=="string" and item.bIsApplication==true then
            local namespace=type(item.CatalogNamespace)=="string" and item.CatalogNamespace or ""
            local catalog=type(item.CatalogItemId)=="string" and item.CatalogItemId or ""
            local id=namespace..":"..catalog..":"..item.AppName
            local row=model.record(M.id,id,item.DisplayName,file,ctx.now)
            if row then
                local launch
                if type(item.LaunchExecutable)=="string" and item.LaunchExecutable~="" then
                    local exe=ctx:contained(item.InstallLocation,item.LaunchExecutable)
                    if exe then launch={kind="executable",target=exe,verified=ctx:is_file(exe)} end
                end
                model.install(row,item.InstallLocation,ctx:is_dir(item.InstallLocation) and item.bIsIncompleteInstall~=true,file,launch)
                records[#records+1]=row
            end
        end
    end
    return {records=records,errors=errors,coverage="installed_manifests",limitations={"No offline owned-library source is read. Missing/residual manifests do not prove ownership or uninstallation."}}
end
return M
