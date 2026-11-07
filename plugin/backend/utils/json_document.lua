-- Preserve the JSON shape of untouched values (notably [] vs {}, null, and large numbers).
local json = require("json")
local M = {}
function M.parse(text)
    local cursor = 1
    local function space() while text:sub(cursor,cursor):match("%s") do cursor=cursor+1 end end
    local function quoted()
        local start=cursor
        cursor=cursor+1
        while cursor<=#text do
            local char=text:sub(cursor,cursor)
            cursor=cursor+1
            if char=="\\" then cursor=cursor+1
            elseif char=='"' then return text:sub(start,cursor-1) end
        end
        error("Unterminated JSON string")
    end
    local parse
    parse=function(depth)
        depth=depth or 0
        if depth>128 then error("JSON nesting limit") end
        space()
        local start=cursor
        local char=text:sub(cursor,cursor)
        if char=="{" or char=="[" then
            local object=char=="{"
            local finish=object and "}" or "]"
            local node={kind=object and "object" or "array",children={}}
            local seen={}
            cursor=cursor+1; space()
            while text:sub(cursor,cursor)~=finish do
                local key
                if object then
                    if text:sub(cursor,cursor)~='"' then error("Invalid JSON object key") end
                    key=json.decode(quoted()); space()
                    if seen[key] then error("Duplicate JSON object key") end
                    seen[key]=true
                    if text:sub(cursor,cursor)~=":" then error("Invalid JSON separator") end
                    cursor=cursor+1
                end
                node.children[#node.children+1]={key=key,node=parse(depth+1)}
                space()
                if text:sub(cursor,cursor)==finish then break end
                if text:sub(cursor,cursor)~="," then error("Invalid JSON container") end
                cursor=cursor+1; space()
            end
            cursor=cursor+1
            node.raw=text:sub(start,cursor-1)
            return node
        end
        local raw
        if char=='"' then raw=quoted()
        else
            while cursor<=#text and not text:sub(cursor,cursor):match("[%s,%]%}]") do cursor=cursor+1 end
            raw=text:sub(start,cursor-1)
        end
        if raw=="" then error("Invalid JSON scalar") end
        return {kind="scalar",raw=raw,value=json.decode(raw)}
    end
    local result=parse(); space()
    if cursor<=#text then error("Trailing JSON data") end
    return result
end

local function render(node,value)
    if not node then return json.encode(value) end
    if node.kind=="scalar" then return node.value==value and node.raw or json.encode(value) end
    if type(value)~="table" then return json.encode(value) end
    local pieces={}
    if node.kind=="array" then
        for k in pairs(value) do if type(k)~="number" or k<1 or k%1~=0 then return json.encode(value) end end
        for i,item in ipairs(value) do pieces[#pieces+1]=render(node.children[i] and node.children[i].node,item) end
        return "["..table.concat(pieces,",").."]"
    end
    local seen={}
    for _,child in ipairs(node.children) do
        seen[child.key]=true
        if value[child.key]~=nil then pieces[#pieces+1]=json.encode(child.key)..":"..render(child.node,value[child.key]) end
    end
    local added={}
    for key in pairs(value) do if not seen[key] then added[#added+1]=key end end
    table.sort(added)
    for _,key in ipairs(added) do pieces[#pieces+1]=json.encode(key)..":"..json.encode(value[key]) end
    return "{"..table.concat(pieces,",").."}"
end
function M.encode(original,value) return render(M.parse(original),value) end
return M
