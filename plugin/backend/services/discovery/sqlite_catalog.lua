-- Fixed metadata-only SELECTs. Authorization and account tables are never queried.
local M={}
local queries={
    gog_titles="SELECT CAST(productId AS TEXT) AS id,title AS name FROM LimitedDetails WHERE title IS NOT NULL AND TRIM(title) <> '' LIMIT 5001",
    gog_installs="SELECT CAST(productId AS TEXT) AS id,installationPath AS path FROM InstalledBaseProducts LIMIT 5001",
}
function M.read(path,kind)
    local fs=require("fs")
    if not queries[kind] then error("Unsupported catalog query") end
    if fs.is_file(path.."-wal") or fs.is_file(path.."-journal") then error("Live journal catalog not read") end
    if not fs.file_size or fs.file_size(path)>268435456 then error("Catalog exceeds size limit") end
    local size_before=fs.file_size(path)
    local time_before=fs.last_write_time and fs.last_write_time(path)
    local ffi=require("ffi")
    ffi.cdef[[
        int sqlite3_open_v2(const char *, void **, int, const char *);
        int sqlite3_close(void *);
        int sqlite3_db_readonly(void *, const char *);
        int sqlite3_prepare_v2(void *, const char *, int, void **, const char **);
        int sqlite3_step(void *);
        int sqlite3_finalize(void *);
        const unsigned char *sqlite3_column_text(void *, int);
        const char *sqlite3_column_name(void *, int);
        int sqlite3_column_count(void *);
        void sqlite3_progress_handler(void *, int, int(*)(void *), void *);
    ]]
    local lib=ffi.load("winsqlite3")
    local db=ffi.new("void *[1]")
    local escaped=path:gsub("\\","/"):gsub("([^%w%-%._~/:])",function(c) return string.format("%%%02X",c:byte()) end)
    if lib.sqlite3_open_v2("file:"..escaped.."?mode=ro&immutable=1",db,65,nil)~=0 then if db[0]~=nil then lib.sqlite3_close(db[0]) end; error("Cannot open catalog read-only") end
    local statement=ffi.new("void *[1]")
    local began=os.clock()
    local steps=0
    local callback=ffi.cast("int(*)(void *)",function() steps=steps+1; return (steps>20000 or os.clock()-began>2) and 1 or 0 end)
    local ok,result=pcall(function()
        if lib.sqlite3_db_readonly(db[0],"main")~=1 then error("Catalog is not read-only") end
        lib.sqlite3_progress_handler(db[0],1000,callback,nil)
        if lib.sqlite3_prepare_v2(db[0],queries[kind],-1,statement,nil)~=0 then error("Unsupported catalog schema") end
        local rows={}
        while true do
            local code=lib.sqlite3_step(statement[0])
            if code==101 then break end
            if code~=100 then error("Catalog query interrupted") end
            if #rows>=5000 then error("Catalog record limit") end
            local row={}
            for column=0,lib.sqlite3_column_count(statement[0])-1 do
                local value=lib.sqlite3_column_text(statement[0],column)
                if value~=nil then row[ffi.string(lib.sqlite3_column_name(statement[0],column))]=ffi.string(value) end
            end
            rows[#rows+1]=row
        end
        return rows
    end)
    if statement[0]~=nil then lib.sqlite3_finalize(statement[0]) end
    lib.sqlite3_progress_handler(db[0],0,nil,nil)
    lib.sqlite3_close(db[0]); callback:free()
    if not ok then error(result) end
    if fs.is_file(path.."-wal") or fs.is_file(path.."-journal") or fs.file_size(path)~=size_before or (time_before and fs.last_write_time(path)~=time_before) then error("Catalog changed while reading") end
    return result
end
return M
