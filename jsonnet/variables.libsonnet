{
	variables(settings)::
	local regionKeys = std.objectFields(settings.regions);
	{
		campaign_max_price: {},
		campaign_data_ttl: {},
		cognito_user_mfa: {
			default: "OFF"
		},
		useSAML: {},
	}
}