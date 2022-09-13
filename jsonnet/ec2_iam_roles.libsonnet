{
	"resource": {
		"aws_iam_instance_profile": {
			"npk_node": {
				"name_prefix": "npk_node_profile_",
				"role": "${aws_iam_role.npk_instance_role.name}"
			}
		},
		"aws_iam_role": {
			"npk_instance_role": {
				"name_prefix": "npk_instance_role_",
				"description": "NPK Node Instance Profile",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["ec2.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			},
			"npk_fleet_role": {
				"name_prefix": "npk_fleet_role_",
				"description": "NPK Node Fleet Profile",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Service": ["spotfleet.amazonaws.com"]},
					"Action": "sts:AssumeRole"
				}]}'
			}
		},
		"aws_iam_role_policy": {
			"npk_instance_role": {
				"name_prefix": "npk_instance_role_policy_",
				"role": "${aws_iam_role.npk_instance_role.id}",
				"policy": "${data.aws_iam_policy_document.npk_instance_role.json}"
			},
			"npk_fleet_role": {
				"name_prefix": "npk_fleet_role_policy_",
				"role": "${aws_iam_role.npk_fleet_role.id}",
				"policy": '{"Version": "2012-10-17","Statement": [
					{"Effect": "Allow","Action": [
						"ec2:DescribeImages",
						"ec2:DescribeSubnets",
						"ec2:RequestSpotInstances",
						"ec2:TerminateInstances",
						"ec2:DescribeInstanceStatus",
						"ec2:CreateTags"
					],"Resource": ["*"]},
					{"Effect": "Allow","Action": "iam:PassRole",
					"Condition": {"StringEquals": {"iam:PassedToService": [
						"ec2.amazonaws.com",
						"ec2.amazonaws.com.cn"
					]}},"Resource": ["*"]},
					{"Effect": "Allow","Action": [
						"elasticloadbalancing:RegisterInstancesWithLoadBalancer"
					],"Resource": ["arn:aws:elasticloadbalancing:*:*:loadbalancer/*"]},
					{"Effect": "Allow","Action": [
						"elasticloadbalancing:RegisterTargets"
					],"Resource": ["*"]}
				]}'
			}
		},
	},
	data: {
		"aws_iam_policy_document": {
			"npk_instance_role": {

				statement: [{
					"sid": "1",
					"actions": [
						"ec2:DescribeTags",
						"ec2:DescribeSpotFleetInstances"
					],
					"resources": ["*"]
				}, {
					"sid": "2",
					"actions": [
						"s3:GetObject"
					],
					"resources": [
						"arn:aws:s3:::npk-dictionary-*"
					]
				}, {
					"sid": "3",
					"actions": [
						"s3:GetObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/*/campaigns/*/manifest.json",
						"${aws_s3_bucket.user_data.arn}/*/campaigns/*/potfiles/*"
					]
				}, {
					"sid": "4",
					"actions": [
						"s3:PutObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/*/campaigns/*/potfiles/*"
					]
				}, {
					"sid": "5",
					"actions": [
						"s3:ListBucket"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}",
						"arn:aws:s3:::ec2-amd-linux-drivers"
					],
					"condition": {
						"test": "StringLike",
						"variable": "s3:prefix",
						"values": [
							"*/campaigns/*/potfiles/",
						]
					}
				}, {
					"sid": "6",
					"actions": [
						"execute-api:Invoke"
					],
					"resources": [
						"${aws_api_gateway_deployment.npkv3.execution_arn}/*/statusreport/*"
					]
				}]
			}
		}
	}
}