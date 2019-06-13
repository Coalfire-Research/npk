{
	"resource": {
		"aws_iam_role": {
			"lambda_proxy_api_handler": {
				"name_prefix": "npk_lambda_api_handler_role_",
				"description": "Lambda API Gateway Proxy Handler Role",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["lambda.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			},
			"lambda_status_reporter": {
				"name_prefix": "npk_lambda_status_reporter_role_",
				"description": "Lambda Status Reporter Role",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["lambda.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			},
			"lambda_spot_monitor": {
				"name_prefix": "npk_lambda_spot_monitor_role_",
				"description": "Lambda Spot Monitor Role",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["lambda.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			}
		},
		"aws_iam_role_policy": {
			"lambda_proxy_api_handler": {
				"name_prefix": "npk_lambda_api_handler_policy_",
				"role": "${aws_iam_role.lambda_proxy_api_handler.id}",

				"policy": "${data.aws_iam_policy_document.lambda_proxy_api_handler.json}",
			},
			"lambda_status_reporter": {
				"name_prefix": "npk_lambda_status_reporter_policy_",
				"role": "${aws_iam_role.lambda_status_reporter.id}",

				"policy": "${data.aws_iam_policy_document.lambda_status_reporter.json}",
			},
			"lambda_spot_monitor": {
				"name_prefix": "npk_lambda_spot_monitor_policy_",
				"role": "${aws_iam_role.lambda_spot_monitor.id}",

				"policy": "${data.aws_iam_policy_document.lambda_spot_monitor.json}",
			}
		}
	},
	"data": {
		"aws_iam_policy_document": {
			"lambda_proxy_api_handler": {
				"statement": [{
					"sid": "logs",
					"actions": [
						"logs:CreateLogGroup",
						"logs:CreateLogStream",
						"logs:PutLogEvents"
					],
					"resources": [
						"arn:aws:logs:*:*:*"
					]
				},{
					"sid": "1",
					"actions": [
						"s3:PutObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/*/campaigns/*/manifest.json",
						"${aws_s3_bucket.logs.arn}/api_gateway_proxy/*",
					]
				},{
					"sid": "2",
					"actions": [
						"s3:GetObject",
						"s3:DeleteObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/*"
					]
				},{
					"sid": "3",
					"actions": [
						"s3:GetObject"
					],
					"resources": [
						"${var.dictionary-east-1}/*",
						"${var.dictionary-east-2}/*",
						"${var.dictionary-west-1}/*",
						"${var.dictionary-west-2}/*"
					]
				},{
					"sid": "4",
					"actions": [
						"sqs:SendMessage"
					],
					"resources": [
						"${aws_sqs_queue.api_handler_dlq.arn}"
					]
				},{
					"sid": "5",
					"actions": [
						"ec2:CancelSpotFleetRequests",
						"ec2:DescribeImages",
						"ec2:DescribeSpotFleetRequests",
						"ec2:DescribeSpotPriceHistory",
						"ec2:RequestSpotFleet"
					],
					"resources": ["*"]
				},{
					"sid": "6",
					"actions": [
						"dynamodb:Query",
						"dynamodb:UpdateItem",
						"dynamodb:DeleteItem"
					],
					"resources": [
						"${aws_dynamodb_table.campaigns.arn}"
					]
				},{
					"sid": "7",
					"actions": [
						"iam:PassRole"
					],
					"resources": [
						"${aws_iam_role.npk_fleet_role.arn}"
					]
				}]
			},
			"lambda_status_reporter": {
				"statement": [{
					"sid": "logs",
					"actions": [
						"logs:CreateLogGroup",
						"logs:CreateLogStream",
						"logs:PutLogEvents"
					],
					"resources": [
						"arn:aws:logs:*:*:*"
					]
				},{
					"sid": "1",
					"actions": [
						"s3:PutObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/*",
						"${aws_s3_bucket.logs.arn}/api_gateway_proxy/*",
					]
				},{
					"sid": "2",
					"actions": [
						"s3:GetObject",
						"s3:DeleteObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/*"
					]
				},{
					"sid": "3",
					"actions": [
						"dynamodb:Query",
						"dynamodb:UpdateItem"
					],
					"resources": [
						"${aws_dynamodb_table.campaigns.arn}"
					]
				},{
					"sid": "4",
					"actions": [
						"sqs:SendMessage"
					],
					"resources": [
						"${aws_sqs_queue.status_reporter_dlq.arn}"
					]
				}]
			},
			"lambda_spot_monitor": {
				"statement": [{
					"sid": "1",
					"actions": [
						"sns:Publish"
					],
					"resources": [
						"${aws_sns_topic.critical_events.arn}"
					]
				},{
					"sid": "2",
					"actions": [
						"ec2:CancelSpotFleetRequests",
						"ec2:DescribeTags",
						"ec2:DescribeInstances",
						"ec2:DescribeInstanceStatus",
						"ec2:DescribeSpotFleetRequests",
						"ec2:DescribeSpotFleetRequestHistory",
						"ec2:DescribeSpotFleetInstances",
						"ec2:DescribeSpotInstanceRequests",
						"ec2:DescribeSpotPriceHistory"
					],
					"resources": ["*"]
				},{
					"sid": "3",
					"actions": [
						"dynamodb:GetItem",
						"dynamodb:UpdateItem",
						"dynamodb:Query"
					],
					"resources": [
						"${aws_dynamodb_table.campaigns.arn}",
						"${aws_dynamodb_table.campaigns.arn}/index/SpotFleetRequests"
					]
				},{
					"sid": "4",
					"actions": [
						"logs:CreateLogGroup",
						"logs:CreateLogStream",
						"logs:PutLogEvents"
					],
					"resources": [
						"arn:aws:logs:*:*:*"
					]
				}]
			}
		}
	}
}