{
	resource(settings): {
		"aws_cognito_user_pool": {
			"npk": {
				"name": "NPK",
				"mfa_configuration": "${var.cognito_user_mfa}",
				"password_policy": {
					"minimum_length": 12,
					"require_lowercase": true,
					"require_uppercase": true,
					"require_symbols": false,
					"require_numbers": true
				},
				"admin_create_user_config": {
					"allow_admin_create_user_only": true,
					"invite_message_template": {
						"email_subject": "NPK Invitation",
						"email_message": "You've been invited to join an NPK deployment at https://${aws_cloudfront_distribution.npk.domain_name}. Use {username} and {####} to log in.",
						"sms_message": "NPK user created. Use {username} and {####} to log in."
					} + if settings.useCustomDNS then {
						"email_message": "You've been invited to join an NPK deployment at https://" + settings.dnsNames.www[0] + ". Use {username} and {####} to log in."
					} else { }
				},
				"auto_verified_attributes": ["email"],
				"username_attributes": ["email"]
			}
		},
		"aws_cognito_user_pool_client": {
			"npk": {
				"name": "npk_client",
				"user_pool_id": "${aws_cognito_user_pool.npk.id}",
				"generate_secret": false
			}
		},
		"aws_cognito_identity_pool": {
			"main": {
				"identity_pool_name": "NPK Identity Pool",
				"allow_unauthenticated_identities": false,
				"cognito_identity_providers": {
					"client_id": "${aws_cognito_user_pool_client.npk.id}",
					"provider_name": "${aws_cognito_user_pool.npk.endpoint}",
					"server_side_token_check": false,
				},
				"provisioner": {
					"local-exec": {
						"command": "aws --region " + settings.defaultRegion + " --profile " + settings.awsProfile + " cognito-idp admin-create-user --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --user-attributes '[{\"Name\": \"email\", \"Value\": \"${random_string.admin_password.keepers.admin_email}\"}, {\"Name\": \"email_verified\", \"Value\": \"true\"}]' --temporary-password ${random_string.admin_password.result}",
						"on_failure": "continue"
					}
				}
			}
		}
	},
	output(settings): {
		"admin_create_user_command": {
			"value": "aws --region " + settings.defaultRegion + " --profile " + settings.awsProfile + " cognito-idp admin-create-user --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --user-attributes '[{\"Name\": \"email\", \"Value\": \"${random_string.admin_password.keepers.admin_email}\"}, {\"Name\": \"email_verified\", \"Value\": \"true\"}]' --temporary-password ${random_string.admin_password.result}"
		}
	}
}
