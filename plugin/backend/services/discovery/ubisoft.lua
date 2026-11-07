local model=require("services.discovery.model")
local M={id="ubisoft",name="Ubisoft Connect"}
function M.scan(ctx)
    local data=ctx:windows("ubisoft")
    local records={}
    for _,item in ipairs(data.records or {}) do
        local row=model.record(M.id,item.id,item.name,item.source,ctx.now)
        if row then
            row.nameResolved=item.nameResolved
            model.install(row,item.path,ctx:is_dir(item.path),item.source,nil)
            records[#records+1]=row
        end
    end
    return {records=records,errors=data.errors or {},coverage="installation_registry",limitations={"Install registry only. No ownership cache, credentials or binary account data is read. Stale paths have unknown installation state."}}
end
return M
