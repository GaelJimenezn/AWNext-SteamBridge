local function base64(data)
    local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local result = {}
    for pos = 1, #data, 3 do
        local a, b, c = data:byte(pos, pos + 2)
        local n = a * 65536 + (b or 0) * 256 + (c or 0)
        local i = math.floor(n / 262144) % 64 + 1
        local j = math.floor(n / 4096) % 64 + 1
        local k = math.floor(n / 64) % 64 + 1
        local l = n % 64 + 1
        result[#result + 1] = chars:sub(i, i)
            .. chars:sub(j, j)
            .. (b and chars:sub(k, k) or '=')
            .. (c and chars:sub(l, l) or '=')
    end
    return table.concat(result)
end

return base64
