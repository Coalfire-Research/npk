local record(name, zone, aliases=null) =
	if std.type(aliases) != "null" && std.length(aliases) > 0 then
		{ "zone_id": zone, "name": name, "type": "A", "alias": aliases }
	else
		{ "zone_id": zone, "name": name, "type": "A" };

local alias(name, zone) = {
	"name": name,
	"zone_id": zone,
	"evaluate_target_health": "false"
};

{
	"record": record,
	"alias": alias
}