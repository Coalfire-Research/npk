local sonnetry = import 'sonnetry';

local lambda_function(name, config, role_policy) = {
	resource: {
		aws_lambda_function: {
			[name]: config + {
				function_name: name,
				filename: "%s/lambda_functions/zip_files/%s.zip" % [sonnetry.path(), name],
				source_code_hash: "${data.archive_file." + name + ".output_base64sha256}",
				runtime: "nodejs22.x",
				role: "${aws_iam_role.lambda-" + name + ".arn}",
				depends_on: ["data.archive_file." + name, "aws_iam_role_policy.lambda-" + name],
			}
		},
		null_resource: {
			["npm_install-" + name]: {
				provisioner: [{
					"local-exec": {
						command: "cd %s/lambda_functions/%s/ && npm install" % [sonnetry.path(), name],
					}
				}], 
				
				triggers: {
			        always: "${timestamp()}"
			    }
			}
		},
		aws_iam_role: {
			["lambda-" + name]: {
				name: "lambda_" + name,
				description: "Lambda Role for " + name,
				assume_role_policy: '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["lambda.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			}
		},
		aws_iam_role_policy: {
			["lambda-" + name]: {
				name: "lambda_" + name,
				role: "${aws_iam_role.lambda-" + name + ".id}",

				policy: "${data.aws_iam_policy_document.lambda-" + name + ".json}",
			}
		},
		aws_iam_policy_attachment:: {
			["lambda-" + name + "-xray"]: {
				name: "lambda-" + name + "-xray",
				roles: ["${aws_iam_role.lambda-" + name + ".id}"],

				policy_arn: "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
			}
		},
		local_file: {
			["lambda-" + name + "_envvars"]: {
				content: std.join("\n", [
					"declare %s='%s'\nexport %s" % [key, config.environment.variables[key], key]
					for key in std.objectFields(config.environment.variables)
				]),
				filename: "%s/lambda_functions/%s/ENVVARS" % [sonnetry.path(), name],
				file_permission: "0664"
			}
		}
	},
	data: {
		archive_file: {
			[name]: {
				depends_on: [
					"null_resource.npm_install-" + name
				] + if std.objectHas(config, 'depends_on') then config.depends_on else [],
				type: "zip",
				source_dir: "%s/lambda_functions/%s/" % [sonnetry.path(), name],
				output_path: "%s/lambda_functions/zip_files/%s.zip" % [sonnetry.path(), name],
			}
		},
		aws_iam_policy_document: {
			["lambda-" + name]: {
				statement: std.flattenArrays([
					role_policy.statement, 
					[{
						sid: "logs",
				        actions: [
				            "logs:CreateLogGroup",
				            "logs:CreateLogStream",
				            "logs:PutLogEvents",
				        ],
				        resources: [
				        	"arn:aws:logs:*:*:*"
				        ]
				    }, {
						sid: "xray",
				        actions: [
				            "xray:PutTraceSegments",
				            "xray:PutTelemetryRecords",
				            "xray:GetSamplingRules",
				            "xray:GetSamplingTargets",
				            "xray:GetSamplingStatisticSummaries"
				        ],
				        resources: [
				            "*"
				        ]
			    	}]
			    ])
			}
		}
	}
};

local cloudwatch_trigger(name, schedule_expression) = {
	resource: {
		aws_lambda_permission: {
			[name]: {
				statement_id: "AllowExecutionFromCloudWatch",
				action: "lambda:InvokeFunction",
				function_name: "${aws_lambda_function." + name + ".function_name}",
				principal: "events.amazonaws.com",
				source_arn: "${aws_cloudwatch_event_rule." + name + ".arn}"
			}
		},
		aws_cloudwatch_event_rule: {
			[name]: {
				name: name,
				schedule_expression: schedule_expression
			}
		},
		aws_cloudwatch_event_target: {
			[name]: {
				rule: name,
				target_id: name,
				arn: "${aws_lambda_function." + name + ".arn}"
			}
		}
	}
};

{
	lambda_function: lambda_function,
	cloudwatch_trigger: cloudwatch_trigger
}