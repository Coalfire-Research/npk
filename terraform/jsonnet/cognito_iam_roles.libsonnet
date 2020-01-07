{
	"resource":	{
		"aws_iam_role": {
			"cognito_authenticated": {
				"name_prefix": "cognito_authenticated_role_",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
			    	"Effect": "Allow",
			    	"Principal": {"Federated": "cognito-identity.amazonaws.com"},
			    	"Action": "sts:AssumeRoleWithWebIdentity",
			    	"Condition": {
			    		"StringEquals": {"cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.main.id}"},
			    		"ForAnyValue:StringLike": {"cognito-identity.amazonaws.com:amr": "authenticated"}
				}}]}'
			},
			"cognito_unauthenticated": {
				"name_prefix": "cognito_unauthenticated_role_",
				"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
					"Effect": "Allow","Principal": {"Federated": "cognito-identity.amazonaws.com"},
					"Action": "sts:AssumeRoleWithWebIdentity"}
				]}'
			},
		},
		"aws_iam_role_policy": {
			"cognito_authenticated": {
				"name_prefix": "cognito_authenticated_policy_",
				"role": "${aws_iam_role.cognito_authenticated.id}",
				"policy": "${data.aws_iam_policy_document.cognito_authenticated.json}"
			},
			"cognito_unauthenticated": {
				"name_prefix": "cognito_authenticated_policy_",
				"role": "${aws_iam_role.cognito_unauthenticated.id}",
				"policy": "${data.aws_iam_policy_document.cognito_unauthenticated.json}"
			}
		},
		"aws_cognito_identity_pool_roles_attachment": {
			"default": {
				"identity_pool_id": "${aws_cognito_identity_pool.main.id}",
				"roles": {
					"authenticated": "${aws_iam_role.cognito_authenticated.arn}",
					"unauthenticated": "${aws_iam_role.cognito_unauthenticated.arn}"
				}
			}
		}
	},
	data(settings)::
	local regionKeys = std.objectFields(settings.regions);
	{
		"aws_iam_policy_document": {
			"cognito_authenticated": {
				"statement": [{
					"sid": "1",
					"actions": [
						"cognito-identity:*",
						"mobileanalytics:PutEvents",
						"cognito-sync:*",
						"ec2:describeSpotPriceHistory",
						"pricing:*"
					],
					"resources": [
						"*"
					]
				},{
					"sid": "2",
					"actions": [
						"s3:PutObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}/uploads/*"
					]
				},{
					"sid": "3",
					"actions": [
						"s3:GetObject",
						"s3:ListObjectVersions",
						"s3:DeleteObject"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}",
						"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}/*"
					]
				},{
					"sid": "4",
					"actions": [
						"s3:ListBucket"
					],
					"resources": [
						"${aws_s3_bucket.user_data.arn}",
					],
					"condition": [{
							"test": "StringLike",
							"variable": "s3:prefix",

							"values": [
								"&{cognito-identity.amazonaws.com:sub}/",
								"&{cognito-identity.amazonaws.com:sub}/*"
							]
					}]
				},{
					"sid": "5",
					"actions": [
						"dynamodb:GetItem",
						"dynamodb:BatchGetItem",
						"dynamodb:Query"
					],
					"resources": [
						"${aws_dynamodb_table.campaigns.arn}",
						"${aws_dynamodb_table.settings.arn}"
					],
					"condition": [{
							"test": "ForAllValues:StringEquals",
							"variable": "dynamodb:LeadingKeys",

							"values": [
								"&{cognito-identity.amazonaws.com:sub}",
								"admin"
							]
					}]
				},{
					"sid": "6",
					"actions": [
						"s3:ListBucket"
					],
					"resources": [
						"${var.dictionary-" + regionKeys[i] + "}"
						for i in std.range(0, std.length(regionKeys) - 1)
					]
				},{
					"sid": "7",
					"actions": [
						"s3:GetObject"
					],
					"resources": [
						"${var.dictionary-" + regionKeys[i] + "}/*"
						for i in std.range(0, std.length(regionKeys) - 1)
					]
				},{
					"sid": "8",
					"actions": [
						"execute-api:Invoke"
					],
					"resources": [
						"${aws_api_gateway_deployment.npk.execution_arn}/*/userproxy/*"
					]
				}]
			},
			"cognito_unauthenticated": {
				"statement": [{
					"sid": "logs",
					"actions": [
						"cognito-identity:*",
						"mobileanalytics:PutEvents",
						"cognito-sync:*"
					],
					"resources": [
						"*"
					]
				}]
			}
		}
	}
}