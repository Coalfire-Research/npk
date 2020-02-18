{
	variables(settings)::
	local regionKeys = std.objectFields(settings.regions);
	{
		"campaign_max_price": {},
		"campaign_data_ttl": {},
		"cognito_user_mfa": {
			"default": "OFF"
		},
		"useSAML": { },
	} + {
		["dictionary-" + regionKeys[i]]: {}
		for i in std.range(0, std.length(regionKeys) - 1)
	} + {
		["dictionary-" + regionKeys[i] + "-id"]: {}
		for i in std.range(0, std.length(regionKeys) - 1)
	}
}