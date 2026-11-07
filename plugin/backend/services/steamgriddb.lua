local json = require("json")
local http = require("http")
local utils = require("utils")
local fs = require("fs")
local millennium = require("millennium")

local compatibility = require("services.product_compat")

local M = {}
local key = nil
local allowed_images = {}

local secret_dir = fs.join(compatibility.data_dir(), "secrets")
local secret_path = fs.join(secret_dir, "steamgriddb.bin")

-- Windows DPAPI: encrypted for the current Windows user.
local ffi_ok, ffi = pcall(require, "ffi")
local crypt, kernel

if ffi_ok then
    ffi.cdef[[
        typedef struct {
            unsigned long cbData;
            unsigned char *pbData;
        } DATA_BLOB;

        int CryptProtectData(
            DATA_BLOB *, const wchar_t *, DATA_BLOB *,
            void *, void *, unsigned long, DATA_BLOB *
        );

        int CryptUnprotectData(
            DATA_BLOB *, wchar_t **, DATA_BLOB *,
            void *, void *, unsigned long, DATA_BLOB *
        );

        void *LocalFree(void *);
    ]]

    local ok1, lib1 = pcall(ffi.load, "Crypt32")
    local ok2, lib2 = pcall(ffi.load, "Kernel32")

    if ok1 and ok2 then
        crypt = lib1
        kernel = lib2
    end
end

local function response(data)
    return json.encode(data)
end

local function encrypt(value)
    if not crypt then
        return nil, "Windows DPAPI unavailable in Millennium Lua"
    end

    local buffer = ffi.new("unsigned char[?]", #value)
    ffi.copy(buffer, value, #value)

    local input = ffi.new("DATA_BLOB")
    input.cbData = #value
    input.pbData = buffer

    local output = ffi.new("DATA_BLOB")
    local ok = crypt.CryptProtectData(input, nil, nil, nil, nil, 0, output)

    if ok == 0 then
        return nil, "CryptProtectData failed"
    end

    local encrypted = ffi.string(output.pbData, output.cbData)
    kernel.LocalFree(output.pbData)
    ffi.fill(buffer, #value)

    return encrypted
end

local function decrypt(value)
    if not crypt then return nil end

    local buffer = ffi.new("unsigned char[?]", #value)
    ffi.copy(buffer, value, #value)

    local input = ffi.new("DATA_BLOB")
    input.cbData = #value
    input.pbData = buffer

    local output = ffi.new("DATA_BLOB")
    local ok = crypt.CryptUnprotectData(input, nil, nil, nil, nil, 0, output)

    if ok == 0 then return nil end

    local plain = ffi.string(output.pbData, output.cbData)
    kernel.LocalFree(output.pbData)
    ffi.fill(buffer, #value)

    return plain
end

local function save_key(value)
    local encrypted, err = encrypt(value)
    if not encrypted then return false, err end

    local ok, mkdir_err = fs.create_directories(secret_dir)
    if not ok and not fs.is_directory(secret_dir) then
        return false, tostring(mkdir_err)
    end

    local file = io.open(secret_path, "wb")
    if not file then return false, "Cannot open secret storage" end

    file:write(encrypted)
    file:close()
    return true
end

local function load_key()
    if key then return key end

    local file = io.open(compatibility.secret_read_path(), "rb")
    if not file then return nil end

    local encrypted = file:read("*a")
    file:close()

    if not encrypted or #encrypted > 8192 then return nil end

    key = decrypt(encrypted)
    return key
end

local function url_encode(value)
    return value:gsub("([^%w%-_%.~])", function(c)
        return string.format("%%%02X", string.byte(c))
    end)
end

local function api_request(endpoint)
    local current = load_key()
    if not current then
        return { ok = false, error = "Configure SteamGridDB in Settings first" }
    end

    local res, err = http.get(
        "https://www.steamgriddb.com/api/v2/" .. endpoint,
        {
            headers = {
                ["Authorization"] = "Bearer " .. current,
                ["Accept"] = "application/json"
            },
            timeout = 20,
            verify_ssl = true
        }
    )

    if not res then
        return { ok = false, error = tostring(err or "Network error") }
    end

    if res.status ~= 200 then
        return { ok = false, error = "SteamGridDB HTTP " .. tostring(res.status) }
    end

    if type(res.body) ~= "string" or #res.body > 4194304 then
        return { ok = false, error = "Invalid API response size" }
    end

    local ok, parsed = pcall(json.decode, res.body)
    if not ok or type(parsed) ~= "table" then
        return { ok = false, error = "Invalid API JSON" }
    end

    return {
        ok = parsed.success == true,
        data = parsed.data or {},
        error = parsed.success == true and nil or "API returned an error"
    }
end

function M.configure(value)
    if type(value) ~= "string" or #value < 12 or #value > 512
       or value:find("[%c%s]") then
        return response({ ok = false, error = "Invalid API key" })
    end

    local ok, err = save_key(value)
    if not ok then return response({ ok = false, error = err }) end

    key = value
    return response({ ok = true, configured = true, persistent = true })
end

function M.status()
    return response({
        ok = true,
        configured = load_key() ~= nil,
        persistent = fs.is_file(compatibility.secret_read_path())
    })
end

function M.disconnect()
    key = nil
    allowed_images = {}
    if not fs.is_file(secret_path) and fs.is_file(compatibility.secret_read_path()) then
        return response({ ok = false, error = "Migrate legacy credentials before disconnecting; legacy data is read-only" })
    end
    fs.remove(secret_path)
    return response({ ok = true, configured = false })
end

function M.test()
    local result = api_request("search/autocomplete/Portal")
    return response({ ok = result.ok, error = result.error })
end

function M.search(title)
    if type(title) ~= "string" or #title < 2 or #title > 180 then
        return response({ ok = false, error = "Invalid title" })
    end

    return response(api_request("search/autocomplete/" .. url_encode(title)))
end

function M.artwork(game_id, kind)
    local endpoints = {
        grid = "grids", hero = "heroes",
        logo = "logos", icon = "icons"
    }

    local id = tonumber(game_id)
    if not id or id < 1 or id % 1 ~= 0 or not endpoints[kind] then
        return response({ ok = false, error = "Invalid artwork request" })
    end

    local result = api_request(endpoints[kind] .. "/game/" .. tostring(id))

    if result.ok then
        for _, image in ipairs(result.data) do
            if type(image.url) == "string" then
                allowed_images[image.url] = true
            end
        end
    end

    return response(result)
end

-- LC_ACTIVE_ACCOUNT_V1
-- SteamID64 modulo 2^32 is the local userdata account ID.
local function userdata_id(steamid)
    local remainder = 0
    for digit in steamid:gmatch("%d") do
        remainder = (remainder * 10 + tonumber(digit)) % 4294967296
    end
    return tostring(remainder)
end

local function active_account()
    local login_path = fs.join(
        millennium.steam_path(), "config", "loginusers.vdf"
    )

    local file = io.open(login_path, "rb")
    if not file then
        return nil, "Steam loginusers.vdf not found"
    end

    local text = file:read("*a")
    file:close()

    local candidates = {}

    for steamid, block in text:gmatch(
        '"(%d+)"%s*%{(.-)%}'
    ) do
        if block:match('"MostRecent"%s*"1"') then
            table.insert(candidates, userdata_id(steamid))
        end
    end

    if #candidates ~= 1 then
        return nil, "Unable to identify a unique recent Steam account"
    end

    local id = candidates[1]
    local folder = fs.join(millennium.steam_path(), "userdata", id)

    if not fs.is_directory(folder) then
        return nil, "Active Steam userdata folder not found"
    end

    return id
end

function M.accounts()
    local root = fs.join(millennium.steam_path(), "userdata")
    local accounts = {}

    local entries = fs.list(root)

    if type(entries) ~= "table" then
        return response({
            ok = false,
            error = "Could not list Steam userdata directory"
        })
    end

    for _, entry in pairs(entries) do
        local name = nil

        if type(entry) == "table" then
            name = tostring(entry.name or "")
        elseif type(entry) == "string" then
            name = entry:match("([^/\\]+)$")
        end

        if name and name:match("^%d+$") then
            local directory = fs.join(root, name)

            if fs.is_directory(directory) then
                table.insert(accounts, { id = name })
            end
        end
    end

    table.sort(accounts, function(a, b)
        return tonumber(a.id) < tonumber(b.id)
    end)

    if #accounts == 0 then
        return response({
            ok = false,
            error = "No Steam userdata profiles found"
        })
    end

    return response({
        ok = true,
        data = accounts
    })
end
function M.apply(appid, account, kind, url)
    local suffixes = {
        portrait = "p",
        landscape = "",
        hero = "_hero",
        logo = "_logo",
        icon = "_icon"
    }

    if not suffixes[kind] then
        return response({ ok = false, error = "Invalid artwork type" })
    end

    if type(appid) ~= "string" or not appid:match("^%d+$")
       or #appid > 10 or tonumber(appid) < 2147483648
       or tonumber(appid) > 4294967295 then
        return response({ ok = false, error = "Invalid Steam shortcut ID" })
    end

    if type(account) ~= "string" or not account:match("^%d+$") then
        return response({ ok = false, error = "Invalid Steam account" })
    end

    if type(url) ~= "string" or not allowed_images[url] then
        return response({ ok = false, error = "Artwork not selected from API results" })
    end

    local host = url:match("^https://([^/]+)/")
    if not host or not (
        host == "steamgriddb.com" or
        host:match("%.steamgriddb%.com$")
    ) then
        return response({ ok = false, error = "Untrusted image host" })
    end

    local grid = fs.join(
        millennium.steam_path(), "userdata", account, "config", "grid"
    )

    local account_dir = fs.join(millennium.steam_path(), "userdata", account)
    if not fs.is_directory(account_dir) then
        return response({ ok = false, error = "Steam profile not found" })
    end

    -- LC_SGDB_BINARY_CURL_V1
    -- Download binary data directly to a temporary file.
    -- The requested URL must already belong to a SteamGridDB API result.

    if url:find('["%%!%^&|<>%c]') or url:find(' ', 1, true) then
        return response({
            ok = false,
            error = "Unsafe image URL"
        })
    end

    if type(os.execute) ~= "function" then
        return response({
            ok = false,
            error = "OS download unavailable"
        })
    end

    local temp = os.tmpname()

    if type(temp) ~= "string"
       or temp == ""
       or temp:find('["%%!%^&|<>%c]') then
        return response({
            ok = false,
            error = "Cannot create safe temporary path"
        })
    end

    -- Use Windows curl.exe, not the PowerShell curl alias.
    local command =
        'curl.exe --location --fail --silent --show-error ' ..
        '--max-time 40 --max-filesize 20971520 --output "' ..
        temp .. '" "' .. url .. '"'

    -- LC_SILENT_DOWNLOAD_V1
    -- Millennium executes the command without stealing Steam focus.
    local output, executed = utils.exec(command)

    if executed ~= 0 then
        os.remove(temp)
        return response({
            ok = false,
            error = "Image download failed (exit=" ..
                tostring(executed) .. "): " ..
                tostring(output or "unknown error"):sub(1, 250)
        })
    end

    local downloaded = io.open(temp, "rb")

    if not downloaded then
        return response({
            ok = false,
            error = "curl.exe could not download image (result=" ..
                tostring(executed) .. ")"
        })
    end

    local body = downloaded:read(20971521)
    downloaded:close()
    os.remove(temp)

    if type(body) ~= "string"
       or #body < 100
       or #body > 20971520 then
        return response({
            ok = false,
            error = "Image download invalid: bytes=" ..
                tostring(type(body) == "string" and #body or -1) ..
                ", curl=" .. tostring(executed)
        })
    end

    local png = body:sub(1, 8) == "\137PNG\r\n\26\n"
    local jpg = body:byte(1) == 255
        and body:byte(2) == 216
        and body:byte(3) == 255

    if not png and not jpg then
        return response({
            ok = false,
            error = "Downloaded data is not PNG/JPEG"
        })
    end

    local extension = png and ".png" or ".jpg"
    local stem = appid .. suffixes[kind]

    local okdir = fs.create_directories(grid)
    if not okdir and not fs.is_directory(grid) then
        return response({ ok = false, error = "Cannot create Steam grid folder" })
    end

    local backup_dir = fs.join(
        compatibility.data_dir(), "artwork-backups",
        tostring(os.time()) .. "_" .. stem
    )

    local old_files = {}
    for _, ext in ipairs({ ".png", ".jpg", ".jpeg" }) do
        local old = fs.join(grid, stem .. ext)
        if fs.is_file(old) then table.insert(old_files, old) end
    end

    if #old_files > 0 then
        fs.create_directories(backup_dir)
        for _, old in ipairs(old_files) do
            local copied, copyerr = fs.copy(
                old, fs.join(backup_dir, fs.filename(old)), false
            )
            if not copied then
                return response({
                    ok = false,
                    error = "Backup failed: " .. tostring(copyerr)
                })
            end
        end
    end

    local target = fs.join(grid, stem .. extension)
    local temporary = target .. ".library-customizer.tmp"

    local file = io.open(temporary, "wb")
    if not file then
        return response({ ok = false, error = "Cannot write artwork" })
    end

    file:write(body)
    file:close()

    -- Replace other extensions only after successfully writing the new file.
    for _, old in ipairs(old_files) do
        fs.remove(old)
    end

    local renamed, renameerr = fs.rename(temporary, target, false)
    if not renamed then
        for _, old in ipairs(old_files) do
            fs.copy(fs.join(backup_dir, fs.filename(old)), old, false)
        end
        return response({
            ok = false,
            error = "Install failed: " .. tostring(renameerr)
        })
    end

    return response({
        ok = true,
        path = target,
        backup = #old_files > 0 and backup_dir or nil,
        restartSteam = true
    })
end


-- LC_NATIVE_IMAGE_V1
-- Returns validated binary artwork as Base64 for SteamClient.
-- Does not modify userdata or require a Steam restart.
function M.native_image(url)
    if type(url) ~= "string" or not allowed_images[url] then
        return response({
            ok = false,
            error = "Image was not selected from SteamGridDB results"
        })
    end

    if #url > 2048 or url:find('[%c%s"%%!%^&|<>]') then
        return response({ ok = false, error = "Unsafe image URL" })
    end

    local host = url:match("^https://([^/]+)")
    if not host or not (
        host == "steamgriddb.com" or
        host:match("%.steamgriddb%.com$")
    ) then
        return response({ ok = false, error = "Untrusted image host" })
    end

    local tmp = os.tmpname()

    if type(tmp) ~= "string" or
       tmp:find('[%c"%%!%^&|<>]') then
        return response({ ok = false, error = "Unsafe temporary path" })
    end

    local command =
        'curl.exe --location --fail --silent --show-error ' ..
        '--max-time 40 --max-filesize 8388608 --output "' ..
        tmp .. '" "' .. url .. '"'

    local output, exit_code = utils.exec(command)

    local file = io.open(tmp, "rb")
    if not file then
        return response({
            ok = false,
            error = "Artwork download failed: " ..
                tostring(output or exit_code)
        })
    end

    local bytes = file:read(8388609)
    file:close()
    os.remove(tmp)

    if type(bytes) ~= "string"
        or #bytes < 100
        or #bytes > 8388608 then
        return response({
            ok = false,
            error = "Invalid image bytes: " ..
                tostring(type(bytes) == "string" and #bytes or -1)
        })
    end

    local png = bytes:sub(1, 8) == "\137PNG\r\n\26\n"
    local jpg = bytes:byte(1) == 255
        and bytes:byte(2) == 216
        and bytes:byte(3) == 255

    if not png and not jpg then
        return response({
            ok = false,
            error = "Unsupported image format"
        })
    end

    local encode = require("utils.base64")
    local encoded = encode(bytes)

    return response({
        ok = true,
        base64 = encoded,
        imageType = png and "png" or "jpg"
    })
end

return M