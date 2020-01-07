{
	resources(settings)::
	local regionKeys = std.objectFields(settings.regions);
	{
		"aws_lambda_function": {
			"proxy_api_handler": {
				"depends_on": ["data.archive_file.proxy_api_handler", "aws_iam_role_policy.lambda_proxy_api_handler"],
				"filename": "./lambda_functions/zip_files/proxy_api_handler.zip",
				"function_name": "proxy_api_handler",
				"role": "${aws_iam_role.lambda_proxy_api_handler.arn}",
				"handler": "main.main",
				"source_code_hash": "${data.archive_file.proxy_api_handler.output_base64sha256}",
				"runtime": "nodejs8.10",
				"timeout": 60,

				"environment": {
					"variables": {
						"www_dns_names": std.toString(settings.dnsNames.www),
						"campaign_max_price": "${var.campaign_max_price}",
						"userdata_bucket": "${aws_s3_bucket.user_data.id}",
						"instanceProfile": "${aws_iam_instance_profile.npk_node.arn}",
						"iamFleetRole": "${aws_iam_role.npk_fleet_role.arn}",
						"availabilityZones": std.manifestJsonEx({
							[regionKeys[i]]: {
								[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
									for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
							}
							for i in std.range(0, std.length(regionKeys) - 1)
						}, ""),
						"dictionaryBuckets": std.manifestJsonEx({
							[regionKeys[i]]: "${var.dictionary-" + regionKeys[i] + "-id}"
							for i in std.range(0, std.length(regionKeys) - 1)
						}, "")
					}
				},

				"dead_letter_config": {
					"target_arn":	"${aws_sqs_queue.api_handler_dlq.arn}"
				}
			} + if std.objectHas(settings, "debug_lambda") && settings.debug_lambda == true then {
				"tracing_config": {
					"mode": "Active"
				}
			} else {},
			"status_reporter": {
				"depends_on": ["data.archive_file.status_reporter", "aws_iam_role_policy.lambda_status_reporter"],
				"filename": "./lambda_functions/zip_files/status_reporter.zip",
				"function_name": "status_reporter",
				"role": "${aws_iam_role.lambda_status_reporter.arn}",
				"handler": "main.main",
				"source_code_hash": "${data.archive_file.status_reporter.output_base64sha256}",
				"runtime": "nodejs12.x",
				"timeout": 60,

				"environment": {
					"variables": {
						"www_dns_name": std.toString(settings.dnsNames.www),
						"region": "${var.region}",
						"campaign_max_price": "${var.campaign_max_price}",
						"critical_events_sns_topic": "${aws_sns_topic.critical_events.id}",
						"availabilityZones": std.manifestJsonEx({
							[regionKeys[i]]: {
								[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
									for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
							}
							for i in std.range(0, std.length(regionKeys) - 1)
						}, "")
					}
				},

				"dead_letter_config": {
					"target_arn":	"${aws_sqs_queue.status_reporter_dlq.arn}"
				},
			} + if std.objectHas(settings, "debug_lambda") && settings.debug_lambda == true then {
				"tracing_config": {
					"mode": "Active"
				}
			} else {},
			"spot_monitor": {
				"depends_on": ["data.archive_file.spot_monitor", "aws_iam_role_policy.lambda_spot_monitor"],
				"filename": "./lambda_functions/zip_files/spot_monitor.zip",
				"function_name": "spot_monitor",
				"role": "${aws_iam_role.lambda_spot_monitor.arn}",
				"handler": "main.main",
				"source_code_hash": "${data.archive_file.spot_monitor.output_base64sha256}",
				"runtime": "nodejs12.x",
				"memory_size": 512,
				"timeout": 10,

				"environment": {
					"variables": {
						"www_dns_name": std.toString(settings.dnsNames.www),
						"region": "${var.region}",
						"campaign_max_price": "${var.campaign_max_price}",
						"critical_events_sns_topic": "${aws_sns_topic.critical_events.id}",
						"availabilityZones": std.manifestJsonEx({
							[regionKeys[i]]: {
								[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
									for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
							}
							for i in std.range(0, std.length(regionKeys) - 1)
						}, "")
					}
				},

				"dead_letter_config": {
					"target_arn":	"${aws_sns_topic.critical_events.arn}"
				}
			} + if std.objectHas(settings, "debug_lambda") && settings.debug_lambda == true then {
				"tracing_config": {
					"mode": "Active"
				}
			} else {}
		},
		"aws_lambda_permission": {
			"spot_monitor": {
				"statement_id": "spot_monitor",
				"action": "lambda:InvokeFunction",
				"function_name": "${aws_lambda_function.spot_monitor.function_name}",
				"principal": "events.amazonaws.com",
				"source_arn": "${aws_cloudwatch_event_rule.spot_monitor.arn}",
			}
		},
		"null_resource": {
			"npm_install_proxy_api_handler": {
				"provisioner": [{
					"local-exec": {
						"command": "cd ${path.module}/lambda_functions/proxy_api_handler/ && npm install",
					}
				}]
			},
			"npm_install_status_reporter": {
				"provisioner": [{
					"local-exec": {
						"command": "cd ${path.module}/lambda_functions/status_reporter/ && npm install",
					}
				}]
			},
			"npm_install_spot_monitor": {
				"provisioner": [{
					"local-exec": {
						"command": "cd ${path.module}/lambda_functions/spot_monitor/ && npm install",
					}
				}]
			}
		}
	},
	"data": {
		"archive_file": {
			"proxy_api_handler": {
				"depends_on": [
					"null_resource.npm_install_proxy_api_handler"
					// "data.template_file.userdata_template" //TODO: Fix cyclical dependency
				],
				"type": "zip",
				"source_dir": "${path.module}/lambda_functions/proxy_api_handler/",
				"output_path": "${path.module}/lambda_functions/zip_files/proxy_api_handler.zip",
			},
			"status_reporter": {
				"depends_on": [
					"null_resource.npm_install_status_reporter"
				],
				"type": "zip",
				"source_dir": "${path.module}/lambda_functions/status_reporter/",
				"output_path": "${path.module}/lambda_functions/zip_files/status_reporter.zip",
			},
			"spot_monitor": {
				"depends_on": [
					"null_resource.npm_install_spot_monitor"
				],
				"type": "zip",
				"source_dir": "${path.module}/lambda_functions/spot_monitor/",
				"output_path": "${path.module}/lambda_functions/zip_files/spot_monitor.zip",
			}
		}
	}
}