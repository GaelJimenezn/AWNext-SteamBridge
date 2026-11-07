local model=require("services.discovery.model")
local M={id="xbox",name="Xbox PC / Microsoft Store"}
function M.scan(ctx)
    local data=ctx:windows("xbox")
    local records={}
    for _,item in ipairs(data.records or {}) do
        local row=model.record(M.id,item.id,item.name,item.source,ctx.now)
        if row then
            row.nameResolved=item.nameResolved
            row.storeId=type(item.storeId)=="string" and item.storeId or nil
            local launch
            if type(item.aumid)=="string" and item.aumid~="" then launch={kind="shell_app",target=item.aumid,verified=false} end
            model.install(row,item.path,ctx:is_dir(item.path),item.source,launch)
            records[#records+1]=row
        end
    end
    return {records=records,errors=data.errors or {},coverage="current_user_game_packages",limitations={"Only packages with readable MicrosoftGame.config or explicit windows.game manifest extension. Not all Store apps are games. Installation does not prove purchase or Game Pass."}}
end
return M
