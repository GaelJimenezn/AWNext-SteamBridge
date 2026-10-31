local function safe_id(value)
    local id = tostring(value or '')
    return id:match('^%d+$') and id or nil
end

local function schema_entries(schema)
    local entries = {}
    if type(schema) ~= 'table' or type(schema.achievements) ~= 'table' then return entries end
    for _, row in ipairs(schema.achievements) do
        local id = safe_id(row.achievement_id)
        if id then
            local text = {}
            if type(row.localizations) == 'table' then
                for _, translation in ipairs(row.localizations) do
                    if translation.locale and translation.locale.identifier == 'en_US' then text = translation break end
                end
                if not next(text) then text = row.localizations[1] or {} end
            end
            entries[#entries + 1] = { id = id, name = tostring(text.name or id), description = tostring(text.description or text.locked_description or '') }
        end
    end
    return entries
end
return {
    safe_id = safe_id,
    schema_entries = schema_entries
}
