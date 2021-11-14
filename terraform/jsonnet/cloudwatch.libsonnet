{
	resource: {
		aws_cloudwatch_event_rule: {
			spot_monitor: {
				name: "npkSpotMonitor",
				description: "Trigger spot monitor every 1 minute",
				schedule_expression: "rate(1 minute)",
				role_arn: "${aws_iam_role.cloudwatch_invoke_spot_monitor.arn}",
				is_enabled: true
			},
			spot_interrupt_catcher: {
				name: "npkSpotInterruptCatcher",
				description: "Catches spot instance interrupt notifications",
				event_pattern: std.manifestJsonEx({
					"detail-type": ["EC2 Spot Instance Interruption Warning"],
					source: ["aws.ec2"]
				}, ""),
				role_arn: "${aws_iam_role.cloudwatch_invoke_spot_monitor.arn}"
			}
		},
		aws_cloudwatch_event_target:{
			spot_monitor: {
				rule: "${aws_cloudwatch_event_rule.spot_monitor.name}",
				arn: "${aws_lambda_function.spot_monitor.arn}"
			},
			spot_interrupt_catcher: {
				rule: "${aws_cloudwatch_event_rule.spot_interrupt_catcher.name}",
				arn: "${aws_lambda_function.spot_interrupt_catcher.arn}"
			}
		},
		aws_iam_role:{
			cloudwatch_invoke_spot_monitor: {
				name_prefix: "npk_cloudwatch_spot_monitor_",
				description: "Cloudwatch Spot Monitor Role",
				assume_role_policy: '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["events.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			},
			cloudwatch_invoke_spot_interrupt_catcher: {
				name_prefix: "npk_cloudwatch_spot_interrupt_",
				description: "Cloudwatch Spot Interupt Catcher Role",
				assume_role_policy: '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["events.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			}
		},
		aws_iam_role_policy:{
			cloudwatch_invoke_spot_monitor: {
				name_prefix: "npk_cloudwatch_invoke_spot_monitor_policy_",
				role: "${aws_iam_role.cloudwatch_invoke_spot_monitor.id}",
				policy: "${data.aws_iam_policy_document.cloudwatch_invoke_spot_monitor.json}"
			},
			cloudwatch_invoke_spot_interrupt_catcher: {
				name_prefix: "npk_cloudwatch_invoke_spot_interrupt_catcher_policy_",
				role: "${aws_iam_role.cloudwatch_invoke_spot_interrupt_catcher.id}",
				policy: "${data.aws_iam_policy_document.cloudwatch_invoke_spot_interrupt_catcher.json}"
			}
		},
		aws_lambda_permission: {
			spot_monitor: {
				statement_id: "spot_monitor",
				action: "lambda:InvokeFunction",
				function_name: "${aws_lambda_function.spot_monitor.function_name}",
				principal: "events.amazonaws.com",
				source_arn: "${aws_cloudwatch_event_rule.spot_monitor.arn}",
			},
			spot_interrupt_catcher: {
				statement_id: "spot_interrupt_catcher",
				action: "lambda:InvokeFunction",
				function_name: "${aws_lambda_function.spot_interrupt_catcher.function_name}",
				principal: "events.amazonaws.com",
				source_arn: "${aws_cloudwatch_event_rule.spot_interrupt_catcher.arn}",
			}
		}
	}
}