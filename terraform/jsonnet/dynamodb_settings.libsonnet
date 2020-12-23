{
	"aws_dynamodb_table_item": {
		"campaign_max_price": {
			"table_name": "${aws_dynamodb_table.settings.name}",
			"hash_key": "userid",
			"range_key": "keyid",

			"item": '{"userid": {"S": "admin"},"keyid": {"S": "setting:campaign_max_price"},"value": {"N": "${var.campaign_max_price}"}}'
		},
		"campaign_data_ttl": {
			"table_name": "${aws_dynamodb_table.settings.name}",
			"hash_key": "userid",
			"range_key": "keyid",

			"item": '{"userid": {"S": "admin"},"keyid": {"S": "setting:data_ttl"},"value": {"N": "${var.campaign_data_ttl}"}}'
		},
		"admin_favorites": {
			"table_name": "${aws_dynamodb_table.settings.name}",
			"hash_key": "userid",
			"range_key": "keyid",

			"item": '{"userid":{"S":"admin"},"keyid":{"S":"setting:favoriteHashTypes"},"value":{"L":[{"S":"NTLM"},{"S":"MD4"},{"S":"MD5"}]}}'
		}
	}
}