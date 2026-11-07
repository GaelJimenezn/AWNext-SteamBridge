-- Authoritative matching policy. All UI consumers call this module through RPC.
local M = {}
local folds = {
    ["á"]="a",["à"]="a",["ä"]="a",["â"]="a",["ã"]="a",["å"]="a",["Á"]="a",["À"]="a",["Ä"]="a",
    ["é"]="e",["è"]="e",["ë"]="e",["ê"]="e",["É"]="e",["È"]="e",["Ë"]="e",
    ["í"]="i",["ì"]="i",["ï"]="i",["î"]="i",["Í"]="i",["Ï"]="i",
    ["ó"]="o",["ò"]="o",["ö"]="o",["ô"]="o",["õ"]="o",["Ó"]="o",["Ö"]="o",
    ["ú"]="u",["ù"]="u",["ü"]="u",["û"]="u",["Ú"]="u",["Ü"]="u",["ñ"]="n",["Ñ"]="n",["ç"]="c",["Ç"]="c",
}
function M.normalize(value)
    local text = type(value) == "string" and value or ""
    text = text:gsub("[%z\1-\31]", " ")
    for from, to in pairs(folds) do text = text:gsub(from, to) end
    -- Combining marks U+0300..U+036F; retain non-Latin text rather than collapsing it.
    text = text:gsub("\204[\128-\191]", ""):gsub("\205[\128-\175]", "")
    text = text:gsub("®", ""):gsub("™", ""):gsub("©", ""):lower()
    text = text:gsub("[%p]", " "):gsub("%s+", " "):match("^%s*(.-)%s*$")
    return text
end

function M.path(value)
    if type(value) ~= "string" then return "" end
    local path = value:match('^%s*"(.-)"%s*$') or value:match("^%s*(.-)%s*$")
    path = path:gsub("\\", "/"):lower()
    local prefix = path:sub(1, 2) == "//" and "//" or path:sub(1, 1) == "/" and "/" or ""
    local parts = {}
    for part in path:gmatch("[^/]+") do
        if part == ".." and #parts > 0 and not parts[#parts]:match(":$") then table.remove(parts)
        elseif part ~= "." and part ~= ".." then parts[#parts + 1] = part end
    end
    return prefix .. table.concat(parts, "/")
end

local roman = { ii="2", iii="3", iv="4", v="5", vi="6", vii="7", viii="8", ix="9", x="10" }
local editions = { deluxe=true, ultimate=true, definitive=true, goty=true, remastered=true, remake=true, anniversary=true, enhanced=true, gold=true }
function M.title(value)
    local text = M.normalize(value):gsub("%f[%w]mwiii%f[%W]", "modern warfare 3"):gsub("%f[%w]mwii%f[%W]", "modern warfare 2")
    text = text:gsub("call of duty ", "")
    local core, edition, numbers = {}, {}, {}
    for word in text:gmatch("%S+") do
        word = roman[word] or word
        if editions[word] then edition[#edition + 1] = word
        elseif word ~= "edition" then core[#core + 1] = word end
        if word:match("^%d+$") then numbers[#numbers + 1] = word end
    end
    table.sort(edition)
    return table.concat(core, " "), table.concat(edition, " "), table.concat(numbers, ",")
end

function M.shortcut_id(value)
    local n = tonumber(value)
    if not n or n % 1 ~= 0 then return nil end
    if n < 0 and n >= -2147483648 then n = n + 4294967296 end
    if n < 2147483648 or n > 4294967295 then return nil end
    return string.format("%.0f", n)
end

local function nonempty(value) return type(value) == "string" and value ~= "" end
function M.evaluate(shortcut, candidate)
    local reasons, blockers = {}, {}
    local score, evidence = 0, false
    local title, edition, number = M.title(shortcut.name)
    local other, other_edition, other_number = M.title(candidate.name)
    local title_match = title ~= "" and title == other
    if title_match then score = score + 80; reasons[#reasons + 1] = "title"; evidence = true end
    if title ~= "" and other ~= "" and not title_match then blockers[#blockers + 1] = "title_mismatch" end
    if number ~= "" and other_number ~= "" and number ~= other_number then blockers[#blockers + 1] = "installment_or_year_mismatch" end
    local function edition_hint(value, fallback)
        if not nonempty(value) then return fallback end
        local _, parsed=M.title(value)
        return parsed~="" and parsed or M.normalize(value)
    end
    if edition_hint(shortcut.edition,edition) ~= edition_hint(candidate.edition,other_edition) then blockers[#blockers + 1] = "edition_mismatch" end
    if nonempty(shortcut.origin) and M.normalize(shortcut.origin) ~= M.normalize(candidate.source) then blockers[#blockers + 1] = "origin_mismatch" end
    local explicit = shortcut.steamId and tostring(shortcut.steamId) or nil
    if explicit and candidate.steamId then
        if explicit == tostring(candidate.steamId) then score = score + 120; reasons[#reasons + 1] = "steam_id"; evidence = true
        else blockers[#blockers + 1] = "steam_id_mismatch" end
    end
    local exe = M.path(shortcut.exe)
    if exe ~= "" and exe == M.path(candidate.exe) then score = score + 60; reasons[#reasons + 1] = "executable_path" end
    local directory = M.path(shortcut.startDir)
    if directory ~= "" and directory == M.path(candidate.gameDir) then score = score + 25; reasons[#reasons + 1] = "directory_path" end
    -- A shared executable or launcher never establishes a game on its own.
    return { id = tostring(candidate.id), provider = candidate.provider or "awn", source = candidate.source,
        name = candidate.name, score = score, reasons = reasons, blockers = blockers,
        eligible = evidence and #blockers == 0 }
end

function M.resolve(shortcut, candidates, manual)
    local evaluated, eligible, selected_manual = {}, {}, {}
    for _, candidate in ipairs(candidates) do
        local item = M.evaluate(shortcut, candidate)
        if #item.reasons > 0 or (manual and tostring(manual.id) == item.id) then evaluated[#evaluated + 1] = item end
        if item.eligible then eligible[#eligible + 1] = item end
        if manual and tostring(manual.id) == item.id and (not nonempty(manual.source) or manual.source == item.source) then selected_manual[#selected_manual + 1] = item end
    end
    table.sort(evaluated, function(a,b)
        if a.score ~= b.score then return a.score > b.score end
        return (a.provider .. ":" .. (a.source or "") .. ":" .. a.id) < (b.provider .. ":" .. (b.source or "") .. ":" .. b.id)
    end)
    if manual then
        if #selected_manual == 1 then return { status="manual", selected=selected_manual[1], candidates=evaluated, explanation="manual_reference", warnings=selected_manual[1].blockers } end
        return { status=#selected_manual > 1 and "ambiguous" or "missing", candidates=evaluated, explanation="manual_reference_unavailable" }
    end
    if #eligible == 1 then return { status="matched", selected=eligible[1], candidates=evaluated, explanation="unique_corroborated_candidate" } end
    if #eligible > 1 then return { status="ambiguous", candidates=evaluated, explanation="multiple_candidates_require_manual_choice" } end
    return { status=#evaluated > 0 and "conflict" or "missing", candidates=evaluated, explanation=#evaluated > 0 and "contradictory_or_insufficient_evidence" or "no_candidate" }
end
return M
