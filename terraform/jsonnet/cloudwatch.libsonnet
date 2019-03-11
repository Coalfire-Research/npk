{
	"resource": {
		"aws_cloudwatch_event_rule": {
			"spot_monitor": {
				"name": "npkSpotMonitor",
				"description": "Trigger spot monitor every 1 minute",
				"schedule_expression": "rate(1 minute)",
				"role_arn": "${aws_iam_role.cloudwatch_invoke_spot_monitor.arn}",
				"is_enabled": true
			}
		},
		"aws_cloudwatch_event_target":{
			"spot_monitor": {
				"rule": "${aws_cloudwatch_event_rule.spot_monitor.name}",
				"arn": "${aws_lambda_function.spot_monitor.arn}"
			}
		},
		"aws_iam_role":{
			"cloudwatch_invoke_spot_monitor": {
				"name_prefix": "npk_cloudwatch_spot_monitor_",
				"description": "Cloudwatch Spot Monitor Role",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["events.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			}
		},
		"aws_iam_role_policy":{
			"cloudwatch_invoke_spot_monitor": {
				"name_prefix": "npk_cloudwatch_invoke_spot_monitor_policy_",
				"role": "${aws_iam_role.cloudwatch_invoke_spot_monitor.id}",
				"policy": "${data.aws_iam_policy_document.cloudwatch_invoke_spot_monitor.json}"
			}
		}
	}
}