{
	resource:	{
		aws_iam_role: {
			cognito_admins: {
				name_prefix: "cognito_admin_role_",
				assume_role_policy: '{"Version": "2012-10-17","Statement": [{
			    	"Effect": "Allow",
			    	"Principal": {"Federated": "cognito-identity.amazonaws.com"},
			    	"Action": "sts:AssumeRoleWithWebIdentity",
			    	"Condition": {
			    		"StringEquals": {"cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.main.id}"},
			    		"ForAnyValue:StringLike": {"cognito-identity.amazonaws.com:amr": "authenticated"}
				}}]}'
			},
			cognito_authenticated: {
				name_prefix: "cognito_authenticated_role_",
				assume_role_policy: '{"Version": "2012-10-17","Statement": [{
			    	"Effect": "Allow",
			    	"Principal": {"Federated": "cognito-identity.amazonaws.com"},
			    	"Action": "sts:AssumeRoleWithWebIdentity",
			    	"Condition": {
			    		"StringEquals": {"cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.main.id}"},
			    		"ForAnyValue:StringLike": {"cognito-identity.amazonaws.com:amr": "authenticated"}
				}}]}'
			},
		},
		aws_iam_role_policy: {
			cognito_admins: {
				name_prefix: "cognito_admins_policy_",
				role: "${aws_iam_role.cognito_admins.id}",
				policy: "${data.aws_iam_policy_document.cognito_admins.json}"
			},
			cognito_admins_baseline: {
				name_prefix: "cognito_baseline_policy_",
				role: "${aws_iam_role.cognito_admins.id}",
				policy: "${data.aws_iam_policy_document.cognito_authenticated.json}"
			},
			cognito_authenticated: {
				name_prefix: "cognito_authenticated_policy_",
				role: "${aws_iam_role.cognito_authenticated.id}",
				policy: "${data.aws_iam_policy_document.cognito_authenticated.json}"
			},
		},
		aws_cognito_identity_pool_roles_attachment: {
			default: {
				identity_pool_id: "${aws_cognito_identity_pool.main.id}",
				roles: {
					authenticated: "${aws_iam_role.cognito_authenticated.arn}",
				},

				role_mapping: {
					identity_provider: "${aws_cognito_user_pool.npk.endpoint}:${aws_cognito_user_pool_client.npk.id}",
					ambiguous_role_resolution: "AuthenticatedRole",
					type: "Rules",

					mapping_rule: [{
						claim: "cognito:groups",
						match_type: "Contains",
						value: "npk-admins",
						role_arn: "${aws_iam_role.cognito_admins.arn}"
					}]
				}
			}
		}
	},
	data(settings, apiName)::
	local regionKeys = std.objectFields(settings.regions);
	{
		aws_iam_policy_document: {
			cognito_admins: {
				statement: [{
					sid: "adminSettings",
					actions: [
						"dynamodb:PutItem",
					],
					resources: [
						"${aws_dynamodb_table.settings.arn}"
					],
					condition: [{
							test: "ForAllValues:StringEquals",
							variable: "dynamodb:LeadingKeys",

							values: [
								"admin"
							]
					}, {
							test: "ForAllValues:StringEquals",
							variable: "dynamodb:Attributes",

							values: [
								"userid",
								"keyid",
								"value",
							]
					}]
				}, {
					sid: "events",
					actions: [
						"dynamodb:Query",
					],
					resources: [
						"${aws_dynamodb_table.campaigns.arn}/index/Events"
					]
				}, {
					sid: "s3Del",
					actions: [
						"s3:DeleteObject",
					],
					resources: [
						"${aws_s3_bucket.dictionary.arn}/wordlist/*",
						"${aws_s3_bucket.dictionary.arn}/rules/*",
						"${aws_s3_bucket.dictionary.arn}/to_process/*"
					]
				}, {
					sid: "s3Put",
					actions: [
						"s3:PutObject",
					],
					resources: [
						"${aws_s3_bucket.dictionary.arn}/to_process/*"
					]
				}, {
					sid: "cognitoAdmin",
					actions: [
						"cognito-idp:AdminAddUserToGroup",
						"cognito-idp:AdminCreateUser",
						"cognito-idp:AdminDeleteUser",
						"cognito-idp:AdminDisableUser",
						"cognito-idp:AdminEnableUser",
						"cognito-idp:AdminListUserAuthEvents",
						"cognito-idp:AdminRemoveUserFromGroup",
						"cognito-idp:AdminResetUserPassword",
						"cognito-idp:ListUsers",
						"cognito-idp:ListUsersInGroup"
					],
					resources: [
						"${aws_cognito_user_pool.npk.arn}"
					]
				}, {
					sid: "cognitoIdentities",
					actions: [
						"cognito-idp:ListIdentities",
						"cognito-idp:DescribeIdentity",
					],
					resources: [
						"${aws_cognito_identity_pool.main.arn}"
					]
				}]
			},
			cognito_authenticated: {
				statement: [{
					sid: "1",
					actions: [
						"ec2:describeSpotPriceHistory",
						"pricing:*"
					],
					resources: [
						"*"
					]
				},{
					sid: "2",
					actions: [
						"s3:PutObject"
					],
					resources: [
						"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}/uploads/*"
					]
				},{
					sid: "3",
					actions: [
						"s3:GetObject",
						"s3:ListObjectVersions",
						"s3:DeleteObject"
					],
					resources: [
						"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}",
						"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}/*"
					]
				},{
					sid: "4",
					actions: [
						"s3:ListBucket"
					],
					resources: [
						"${aws_s3_bucket.user_data.arn}",
					],
					condition: [{
							test: "StringLike",
							variable: "s3:prefix",

							values: [
								"&{cognito-identity.amazonaws.com:sub}/",
								"&{cognito-identity.amazonaws.com:sub}/*"
							]
					}]
				},{
					sid: "5",
					actions: [
						"dynamodb:GetItem",
						"dynamodb:BatchGetItem",
						"dynamodb:Query"
					],
					resources: [
						"${aws_dynamodb_table.campaigns.arn}",
						"${aws_dynamodb_table.settings.arn}"
					],
					condition: [{
							test: "ForAllValues:StringEquals",
							variable: "dynamodb:LeadingKeys",

							values: [
								"&{cognito-identity.amazonaws.com:sub}",
								"admin"
							]
					}]
				},{
					sid: "settings",
					actions: [
						"dynamodb:PutItem",
					],
					resources: [
						"${aws_dynamodb_table.settings.arn}"
					],
					condition: [{
							test: "ForAllValues:StringEquals",
							variable: "dynamodb:LeadingKeys",

							values: [
								"&{cognito-identity.amazonaws.com:sub}"
							]
					}, {
							test: "ForAllValues:StringEquals",
							variable: "dynamodb:Attributes",

							values: [
								"userid",
								"keyid",
								"value"
							]
					}]
				},{
					sid: "6",
					actions: [
						"s3:ListBucket"
					],
					resources: [
						"arn:aws:s3:::${aws_s3_bucket.dictionary.id}"
					]
				},{
					sid: "7",
					actions: [
						"s3:GetObject"
					],
					resources: [
						"arn:aws:s3:::${aws_s3_bucket.dictionary.id}/*"
					]
				},{
					sid: "8",
					actions: [
						"execute-api:Invoke"
					],
					resources: [
						"${aws_api_gateway_deployment.%s.execution_arn}*/userproxy/*" % apiName
					]
				}]
			}
		}
	}
}
