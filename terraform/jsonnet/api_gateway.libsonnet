local base_path(domain_name) = {
	"api_id": "${aws_api_gateway_rest_api.npk.id}",
	"base_path": "${aws_api_gateway_deployment.npk.stage_name}",
	"stage_name": "${aws_api_gateway_deployment.npk.stage_name}",
	"domain_name": domain_name
};

local domain_name(name, arn) = {
	"domain_name": name,
	"certificate_arn": arn
};

{
	"base_path": base_path,
	"domain_name": domain_name,
	"resource": {
		"aws_api_gateway_rest_api": {
			"npk": {
				"name": "npk",
			}
		},
		"aws_api_gateway_authorizer": {
			"npk": {
				"name": "npk",
				"type": "COGNITO_USER_POOLS",
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"provider_arns": [
					"${aws_cognito_user_pool.npk.arn}"
				]
			}
		},
		"aws_api_gateway_deployment": {
			"npk": {
				"depends_on": [
					"aws_api_gateway_integration.npk_proxy",
					"aws_api_gateway_integration.npk_status_report",
					"aws_api_gateway_integration.options_integration",
					"aws_api_gateway_integration.options_integration_status_report"
				],
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"stage_name": "v1"
			}
		},
		"aws_api_gateway_resource": {
			"proxy_parent": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"parent_id": "${aws_api_gateway_rest_api.npk.root_resource_id}",
				"path_part": "userproxy"
			},
			"proxy": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"parent_id": "${aws_api_gateway_resource.proxy_parent.id}",
				"path_part": "{proxy+}"
			},
			"status_report_parent": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"parent_id": "${aws_api_gateway_rest_api.npk.root_resource_id}",
				"path_part": "statusreport"
			},
			"status_report": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"parent_id": "${aws_api_gateway_resource.status_report_parent.id}",
				"path_part": "{proxy+}"
			}
		},
		"aws_api_gateway_method_response": {
			"options_200": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.proxy.id}",
			    "http_method": "${aws_api_gateway_method.options_method.http_method}",
			    "status_code": "200",
			    "response_models": {
			        "application/json": "Empty",
			    },
			    "response_parameters": {
			        "method.response.header.Access-Control-Allow-Headers": true,
			        "method.response.header.Access-Control-Allow-Methods": true,
			        "method.response.header.Access-Control-Allow-Origin": true
			    },
			    "depends_on": ["aws_api_gateway_method.options_method"]
			},
			"options_200_status_report": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.status_report.id}",
			    "http_method": "${aws_api_gateway_method.options_method_status_report.http_method}",
			    "status_code": "200",
			    "response_models": {
			        "application/json": "Empty",
			    },
			    "response_parameters": {
			        "method.response.header.Access-Control-Allow-Headers": true,
			        "method.response.header.Access-Control-Allow-Methods": true,
			        "method.response.header.Access-Control-Allow-Origin": true
			    },
			    "depends_on": ["aws_api_gateway_method.options_method_status_report"]
			}
		},
		"aws_api_gateway_method": {
			"npk_proxy": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"resource_id": "${aws_api_gateway_resource.proxy.id}",
				"http_method": "ANY",
				"authorization": "AWS_IAM",
				"request_parameters": {
					"method.request.path.proxy": true
				}
			},
			"options_method": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.proxy.id}",
			    "http_method": "OPTIONS",
			    "authorization": "NONE"
			},
			"npk_status_report": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				"resource_id": "${aws_api_gateway_resource.status_report.id}",
				"http_method": "POST",
				"authorization": "AWS_IAM",
				"request_parameters": {
					"method.request.path.proxy": true
				}
			},
			"options_method_status_report": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.status_report.id}",
			    "http_method": "OPTIONS",
			    "authorization": "NONE"
			}
		},
		"aws_lambda_permission": {
			"npk_apigw_lambda": {
				"statement_id": "AllowExecutionFromAPIGateway",
				"action": "lambda:InvokeFunction",
				"function_name": "${aws_lambda_function.proxy_api_handler.arn}",
				"principal": "apigateway.amazonaws.com",
				"source_arn": "arn:aws:execute-api:${var.region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.npk.id}/*/*/*"
			},
			"npk_apigw_statusreport_lambda": {
				"statement_id": "AllowExecutionFromAPIGateway",
				"action": "lambda:InvokeFunction",
				"function_name": "${aws_lambda_function.status_reporter.arn}",
				"principal": "apigateway.amazonaws.com",
				"source_arn": "arn:aws:execute-api:${var.region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.npk.id}/*/*/*"
			}
		},
		"aws_api_gateway_integration": {
			"options_integration": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.proxy.id}",
			    "http_method": "${aws_api_gateway_method.options_method.http_method}",
			    "type": "MOCK",
			    "request_templates": {
			    	"application/json": "{\"statusCode\": 200}",
			    },
			    "depends_on": ["aws_api_gateway_method.options_method"]
			},
			"npk_proxy": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				resource_id: "${aws_api_gateway_resource.proxy.id}",
				http_method: "${aws_api_gateway_method.npk_proxy.http_method}",
				integration_http_method: "POST",
				"type": "AWS_PROXY",
				"uri": "arn:aws:apigateway:${var.region}:lambda:path/2015-03-31/functions/${aws_lambda_function.proxy_api_handler.arn}/invocations"
			},
			"npk_status_report": {
				"rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
				resource_id: "${aws_api_gateway_resource.status_report.id}",
				http_method: "${aws_api_gateway_method.npk_status_report.http_method}",
				integration_http_method: "POST",
				"type": "AWS_PROXY",
				"uri": "arn:aws:apigateway:${var.region}:lambda:path/2015-03-31/functions/${aws_lambda_function.status_reporter.arn}/invocations"
			},
			"options_integration_status_report": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.status_report.id}",
			    "http_method": "${aws_api_gateway_method.options_method_status_report.http_method}",
			    "type": "MOCK",
			    "request_templates": {
			    	"application/json": "{\"statusCode\": 200}",
			    },
			    "depends_on": ["aws_api_gateway_method.options_method_status_report"]
			}
		},
		"aws_api_gateway_integration_response": {
			"options_integration_response": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.proxy.id}",
			    "http_method": "${aws_api_gateway_method.options_method.http_method}",
			    "status_code": "${aws_api_gateway_method_response.options_200.status_code}",
			    "response_parameters": {
			        "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
			        "method.response.header.Access-Control-Allow-Methods": "'GET,OPTIONS,POST,PUT,DELETE'",
			        "method.response.header.Access-Control-Allow-Origin": "'*'",
			    },
			    "depends_on": ["aws_api_gateway_method_response.options_200"]
			},
			"options_integration_response_status_report": {
			    "rest_api_id": "${aws_api_gateway_rest_api.npk.id}",
			    "resource_id": "${aws_api_gateway_resource.status_report.id}",
			    "http_method": "${aws_api_gateway_method.options_method_status_report.http_method}",
			    "status_code": "${aws_api_gateway_method_response.options_200_status_report.status_code}",
			    "response_parameters": {
			        "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
			        "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,POST'",
			        "method.response.header.Access-Control-Allow-Origin": "'*'",
			    },
			    "depends_on": ["aws_api_gateway_method_response.options_200_status_report"]
			}
		}
	}
}