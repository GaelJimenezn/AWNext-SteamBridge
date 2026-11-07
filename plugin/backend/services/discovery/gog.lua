local model=require("services.discovery.model")
local M={id="gog",name="GOG Galaxy"}
function M.scan(ctx)
    local records,errors={},{}
    local registry=ctx:windows("gog")
    for _,err in ipairs(registry.errors or {}) do errors[#errors+1]=err end
    for _,item in ipairs(registry.records or {}) do
        local row=model.record(M.id,item.id,item.name,item.source,ctx.now)
        if row then row.nameResolved=item.nameResolved; model.install(row,item.path,ctx:is_dir(item.path),item.source,nil); records[#records+1]=row end
    end
    local path=ctx:join(ctx.programData,"GOG.com","Galaxy","storage","galaxy-2.0.db")
    local catalog_available=ctx:is_file(path)
    if catalog_available then
        local ok,result=pcall(function()
            local titles=ctx:catalog(path,"gog_titles")
            local installs=ctx:catalog(path,"gog_installs")
            local by_id={}
            for _,install in ipairs(installs) do by_id[install.id]=by_id[install.id] or {}; table.insert(by_id[install.id],install.path) end
            local output={}
            for _,title in ipairs(titles) do
                local row=model.record(M.id,title.id,title.name,path.."#LimitedDetails",ctx.now)
                if row then
                    row.catalogOnly=true
                    for _,folder in ipairs(by_id[title.id] or {}) do model.install(row,folder,ctx:is_dir(folder),path.."#InstalledBaseProducts",nil) end
                    -- Absence from this cache is not a machine-wide uninstall assertion.
                    output[#output+1]=row
                end
            end
            return output
        end)
        if ok then for _,row in ipairs(result) do records[#records+1]=row end
        else errors[#errors+1]="GOG local catalog unavailable (locked/WAL/unsupported schema); registry results remain available" end
    end
    return {records=records,errors=errors,coverage=catalog_available and "registry_and_cached_catalog" or "installation_registry",limitations={"LimitedDetails can include cached titles not installed or not owned. ProductAuthorizations and account tables are never queried. License remains unknown. Live WAL catalogs are refused without modifying them."}}
end
return M
