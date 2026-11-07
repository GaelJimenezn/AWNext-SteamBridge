-- Same-directory replacement and flushed writes. Never remove the destination first.
local M = {}
local native
local function windows()
    if not jit or jit.os ~= "Windows" then return nil end
    if native then return native end
    local ffi = require("ffi")
    ffi.cdef[[
        int MultiByteToWideChar(unsigned int, unsigned long, const char *, int, wchar_t *, int);
        int MoveFileExW(const wchar_t *, const wchar_t *, unsigned long);
        void *CreateFileW(const wchar_t *, unsigned long, unsigned long, void *, unsigned long, unsigned long, void *);
        int ReadFile(void *, void *, unsigned long, unsigned long *, void *);
        int WriteFile(void *, const void *, unsigned long, unsigned long *, void *);
        int FlushFileBuffers(void *);
        int CloseHandle(void *);
        int DeleteFileW(const wchar_t *);
    ]]
    local kernel = ffi.load("Kernel32")
    local function wide(value)
        local size = kernel.MultiByteToWideChar(65001, 8, value, #value, nil, 0)
        if size == 0 then error("Invalid UTF-8 file path") end
        local buffer = ffi.new("wchar_t[?]", size + 1)
        if kernel.MultiByteToWideChar(65001, 8, value, #value, buffer, size) ~= size then error("Path conversion failed") end
        return buffer
    end
    native = { ffi=ffi, kernel=kernel, wide=wide, invalid=ffi.cast("void *", -1) }
    return native
end

function M.read(path, limit)
    limit=limit or 4194304
    local win=windows()
    if win then
        local ffi,kernel=win.ffi,win.kernel
        local handle=kernel.CreateFileW(win.wide(path),2147483648,7,nil,3,128,nil)
        if handle==win.invalid then return nil,"Cannot open file" end
        local buffer=ffi.new("unsigned char[?]",limit+1)
        local count=ffi.new("unsigned long[1]")
        local ok=kernel.ReadFile(handle,buffer,limit+1,count,nil)
        kernel.CloseHandle(handle)
        if ok==0 then return nil,"Cannot read file" end
        if count[0]>limit then return nil,"File exceeds size limit" end
        return ffi.string(buffer,count[0])
    end
    local file = io.open(path, "rb")
    if not file then return nil end
    local data = file:read(limit + 1)
    file:close()
    if data and #data > limit then return nil, "File exceeds size limit" end
    return data
end

function M.write(path, bytes)
    local temporary = path .. ".tmp" -- configuration store holds the directory lock
    local win=windows()
    if win then
        local ffi,kernel=win.ffi,win.kernel
        local temp_path=win.wide(temporary)
        local handle=kernel.CreateFileW(temp_path,1073741824,0,nil,2,128,nil)
        if handle==win.invalid then return nil,"Cannot open temporary file" end
        local count=ffi.new("unsigned long[1]")
        local wrote=kernel.WriteFile(handle,bytes,#bytes,count,nil)~=0 and count[0]==#bytes
        local flushed=kernel.FlushFileBuffers(handle)~=0
        local closed=kernel.CloseHandle(handle)~=0
        if not wrote or not flushed or not closed then
            kernel.DeleteFileW(temp_path)
            return nil,"Cannot write, flush or close temporary file"
        end
        if kernel.MoveFileExW(temp_path,win.wide(path),9)==0 then
            kernel.DeleteFileW(temp_path)
            return nil,"Atomic Windows replacement failed"
        end
        return true
    end
    local file, err = io.open(temporary, "wb")
    if not file then return nil, err end
    local wrote, write_error = file:write(bytes)
    local flushed, flush_error = file:flush()
    local closed, close_error = file:close()
    if not wrote or not flushed or not closed then
        os.remove(temporary)
        return nil, tostring(write_error or flush_error or close_error)
    end
    local renamed, rename_error=os.rename(temporary,path)
    if not renamed then os.remove(temporary); return nil,rename_error end
    return true
end
return M
