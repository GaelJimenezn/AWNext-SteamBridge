-- A real provider boundary, deliberately fail-closed without entitlement evidence.
local M={id="gamepass",name="PC Game Pass"}
function M.scan(_ctx)
    return {records={},errors={},coverage="unavailable_without_entitlements",limitations={"No supported non-sensitive local entitlement catalog. Xbox installation or public catalog membership is not evidence of a Game Pass license. No games or subscription are inferred."}}
end
return M
