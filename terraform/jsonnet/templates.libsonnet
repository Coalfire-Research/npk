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
			"api_handler_variables": {
				"template": "${file(\"${path.module}/templates/api_handler_variables.tpl\")}",

				"vars": {
					"www_dns_name": std.toString(settings.dnsNames.www),
					"use1": "${var.dictionary-east-1-id}",
					"use2": "${var.dictionary-east-2-id}",
					"usw1": "${var.dictionary-west-1-id}",
					"usw2": "${var.dictionary-west-2-id}",
					"userdata": "${aws_s3_bucket.user_data.id}",
					"instanceProfile": "${aws_iam_instance_profile.npk_node.arn}",
					"iamFleetRole": "${aws_iam_role.npk_fleet_role.arn}"
				} + {
					[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
						for i in std.range(0, std.length(regionKeys) - 1)
						for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
				}
			},
			"lambda_functions_settings": {
				"template": "${file(\"${path.module}/templates/npk_settings.tpl\")}",

				"vars": {
					"www_dns_name": std.toString(settings.dnsNames.www),
					"region": "${var.region}",
					"campaign_max_price": "${var.campaign_max_price}",
					"critical_events_sns_topic": "${aws_sns_topic.critical_events.id}"
				}
			},
			"userdata_template": {
				"template": "${file(\"${path.module}/templates/userdata.tpl\")}",

				"vars": {
					"use1": "${var.dictionary-east-1-id}",
					"use2": "${var.dictionary-east-2-id}",
					"usw1": "${var.dictionary-west-1-id}",
					"usw2": "${var.dictionary-west-2-id}",
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
			"api_handler_variables": {
				"content": "${data.template_file.api_handler_variables.rendered}",
				"filename": "${path.module}/lambda_functions/proxy_api_handler/api_handler_variables.js",
			},
			"lambda_functions_settings-spot_monitor": {
				"content": "${data.template_file.lambda_functions_settings.rendered}",
				"filename": "${path.module}/lambda_functions/spot_monitor/npk_settings.js",
			},
			"lambda_functions_settings-status_reporter": {
				"content": "${data.template_file.lambda_functions_settings.rendered}",
				"filename": "${path.module}/lambda_functions/status_reporter/npk_settings.js",
			},
			"userdata_template": {
				"content": "${data.template_file.userdata_template.rendered}",
				"filename": "${path.module}/lambda_functions/proxy_api_handler/userdata.sh",
			}
		}
	},
	"output": {
		 "npk_config": {
			"value": "${local_file.npk_config.filename}",
		}
	},
	"az": az
}