local fs=require("fs")
local json=require("json")
local atomic=require("utils.atomic_file")
local millennium=require("millennium")
local engine=require("services.game_identity")
local M={}
local function local_path(path)
    return type(path)=="string" and path:match("^%a:[/\\]")~=nil and not path:find("%z")
end
function M.new()
    local ctx={programData=os.getenv("PROGRAMDATA") or "C:/ProgramData",now=os.date("!%Y-%m-%dT%H:%M:%SZ")}
    function ctx:join(...) return fs.join(...) end
    function ctx:is_dir(path) return local_path(path) and fs.is_directory(path) end
    function ctx:is_file(path) return local_path(path) and fs.is_file(path) end
    function ctx:contained(root,relative)
        if not local_path(root) or type(relative)~="string" or relative:find("%z") or relative:match("^[\\/]") or relative:find(":",1,true) then return nil end
        for part in relative:gmatch("[^/\\]+") do if part==".." then return nil end end
        local target=fs.join(root,relative)
        local base=engine.path(root).."/"
        if engine.path(target):sub(1,#base)~=base then return nil end
        return target
    end
    function ctx:files(root,pattern)
        if not self:is_dir(root) then return {} end
        local entries,err=fs.list(root)
        if type(entries)~="table" then error("Metadata directory cannot be listed") end
        local files={}
        for _,entry in pairs(entries) do
            local name=type(entry)=="table" and entry.name or type(entry)=="string" and entry:match("([^/\\]+)$")
            if name and not name:find("[/\\]") and name:match(pattern) then
                files[#files+1]=fs.join(root,name)
                if #files>5000 then error("Metadata file limit") end
            end
        end
        table.sort(files)
        return files
    end
    function ctx:json(path)
        local bytes=atomic.read(path,2097152)
        if not bytes then return nil,"Metadata unavailable" end
        local ok,value=pcall(json.decode,bytes)
        if ok and type(value)=="table" then return value end
        return nil,"Metadata JSON invalid"
    end
    function ctx:catalog(path,kind) return require("services.discovery.sqlite_catalog").read(path,kind) end
    function ctx:windows(provider)
        if provider~="ubisoft" and provider~="gog" and provider~="xbox" then error("Unsupported metadata source") end
        local script=millennium.assets.read("resources/discovery-windows.ps1")
        if type(script)~="string" then error("Local metadata reader resource unavailable") end
        script=script:gsub("__PROVIDER__",provider)
        -- Script is ASCII; launcher names returned by the worker use UTF-8 JSON.
        local wide=script:gsub("(.)",function(c) return c.."\0" end)
        local command="powershell.exe -NoProfile -NonInteractive -EncodedCommand "..require("utils.base64")(wide)
        if #command>30000 then error("Metadata command limit") end
        local output,code=require("utils").exec(command)
        if code~=0 or type(output)~="string" or #output>2097152 then error("Local metadata scan failed or timed out") end
        local cleaned=output:gsub("^\239\187\191","")
        local ok,data=pcall(json.decode,cleaned)
        if not ok or type(data)~="table" or type(data.records)~="table" then error("Invalid metadata scan result") end
        return data
    end
    return ctx
end
return M
