{
	"resource": {
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

				"dead_letter_config": {
					"target_arn":	"${aws_sqs_queue.api_handler_dlq.arn}"
				},
			},
			"status_reporter": {
				"depends_on": ["data.archive_file.status_reporter", "aws_iam_role_policy.lambda_status_reporter"],
				"filename": "./lambda_functions/zip_files/status_reporter.zip",
				"function_name": "status_reporter",
				"role": "${aws_iam_role.lambda_status_reporter.arn}",
				"handler": "main.main",
				"source_code_hash": "${data.archive_file.status_reporter.output_base64sha256}",
				"runtime": "nodejs8.10",
				"timeout": 60,

				"dead_letter_config": {
					"target_arn":	"${aws_sqs_queue.status_reporter_dlq.arn}"
				},
			},
			"spot_monitor": {
				"depends_on": ["data.archive_file.spot_monitor", "aws_iam_role_policy.lambda_spot_monitor"],
				"filename": "./lambda_functions/zip_files/spot_monitor.zip",
				"function_name": "spot_monitor",
				"role": "${aws_iam_role.lambda_spot_monitor.arn}",
				"handler": "main.main",
				"source_code_hash": "${data.archive_file.spot_monitor.output_base64sha256}",
				"runtime": "nodejs8.10",
				"memory_size": 512,
				"timeout": 10,

				"dead_letter_config": {
					"target_arn":	"${aws_sns_topic.critical_events.arn}"
				}
			}
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
					"local_file.api_handler_variables",
					"null_resource.npm_install_proxy_api_handler"
				],
				"type": "zip",
				"source_dir": "${path.module}/lambda_functions/proxy_api_handler/",
				"output_path": "${path.module}/lambda_functions/zip_files/proxy_api_handler.zip",
			},
			"status_reporter": {
				"depends_on": [
					"local_file.lambda_functions_settings-status_reporter",
					"null_resource.npm_install_status_reporter"
				],
				"type": "zip",
				"source_dir": "${path.module}/lambda_functions/status_reporter/",
				"output_path": "${path.module}/lambda_functions/zip_files/status_reporter.zip",
			},
			"spot_monitor": {
				"depends_on": [
					"local_file.lambda_functions_settings-spot_monitor",
					"null_resource.npm_install_spot_monitor"
				],
				"type": "zip",
				"source_dir": "${path.module}/lambda_functions/spot_monitor/",
				"output_path": "${path.module}/lambda_functions/zip_files/spot_monitor.zip",
			}
		}
	}
}