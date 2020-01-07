local az(region) = {
	[az]: "${" + az + "}"
		for az in region
};

{
	data(settings)::
	local regionKeys = std.objectFields(settings.regions);
	{
		"template_file": {
			"npk_config": {
				"template": "${file(\"${path.module}/templates/npk_config.tpl\")}",

				"vars": {
					"aws_region": "${var.region}",
					"client_id": "${aws_cognito_user_pool_client.npk.id}",
					"user_pool_id": "${aws_cognito_user_pool.npk.id}",
					"identity_pool_id": "${aws_cognito_identity_pool.main.id}",
					"userdata_bucket": "${aws_s3_bucket.user_data.id}",
					"api_gateway_url": if settings.useCustomDNS then
							settings.dnsNames.api[0]
						else
							"${element(split(\"/\", aws_api_gateway_deployment.npk.invoke_url), 2)}"
				}
			},
			"userdata_template": {
				"template": "${file(\"${path.module}/templates/userdata.tpl\")}",

				"vars": {
					"dictionaryBuckets": std.strReplace(std.manifestJsonEx({
						[regionKeys[i]]: "${var.dictionary-" + regionKeys[i] + "-id}"
						for i in std.range(0, std.length(regionKeys) - 1)
					}, ""), "\n", ""),
					"userdata": "${aws_s3_bucket.user_data.id}",
					"apigateway": if settings.useCustomDNS then
							settings.dnsNames.api[0]
						else
							"${element(split(\"/\", aws_api_gateway_deployment.npk.invoke_url), 2)}"
				}
			}
		}
	},
	"resource": {
		"local_file": {
			"npk_config": {
				"content": "${data.template_file.npk_config.rendered}",
				"filename": "${path.module}/../site-content/angular/npk_config.js",
			},
			"userdata_template": {
				"content": "${data.template_file.userdata_template.rendered}",
				"filename": "${path.module}/lambda_functions/proxy_api_handler/userdata.sh",
			}
		}
	},
	"az": az
}