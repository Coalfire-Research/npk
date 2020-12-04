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
					"unused_account_validity_days": 3,
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
			} + if settings.useSAML == true then {
				"allowed_oauth_flows_user_pool_client": "true",
				"supported_identity_providers": ["NPKSAML"],
				"allowed_oauth_scopes": ["email", "openid"],
				"allowed_oauth_flows": ["code"],
				"callback_urls": if settings.useCustomDNS == true then [
					"https://" + settings.dnsNames.www[0]
				] else [
					"https://${aws_cloudfront_distribution.npk.domain_name}"
				],
				"logout_urls": if settings.useCustomDNS == true then [
					"https://" + settings.dnsNames.www[0]
				] else [
					"https://${aws_cloudfront_distribution.npk.domain_name}"
				]
			} else {}
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
	} + (if settings.useSAML == true then {
		"aws_cognito_identity_provider": {
			"saml": {
				"user_pool_id": "${aws_cognito_user_pool.npk.id}",
				"provider_name": "NPKSAML",
				"provider_type": "SAML",

				"provider_details": {
					"IDPSignout": "false",
					"MetadataURL": settings.sAMLMetadataUrl
				},

				"attribute_mapping": {
					"email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
				}
			}
		}
	} else {}) + (if settings.useSAML == true && settings.useCustomDNS == false then {
		"aws_cognito_user_pool_domain": {
			"saml": {
				"domain": "${random_string.saml_domain.result}",
				"user_pool_id": "${aws_cognito_user_pool.npk.id}"
			}
		}
	} else {}) + (if settings.useSAML == true && settings.useCustomDNS == true then {
		"aws_cognito_user_pool_domain": {
			"saml": {
				"domain": "auth." + settings.dnsNames.www[0],
				"certificate_arn": "${aws_acm_certificate.saml.arn}",
				"user_pool_id": "${aws_cognito_user_pool.npk.id}"
			}
		}
	} else {}),
	output(settings): {
		"admin_create_user_command": {
			"value": "aws --region " + settings.defaultRegion + " --profile " + settings.awsProfile + " cognito-idp admin-create-user --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --user-attributes '[{\"Name\": \"email\", \"Value\": \"${random_string.admin_password.keepers.admin_email}\"}, {\"Name\": \"email_verified\", \"Value\": \"true\"}]' --temporary-password ${random_string.admin_password.result}"
		}
	} + (if settings.useSAML == true then {
		"saml_entity_id": {
			"value": "urn:amazon:cognito:sp:${aws_cognito_user_pool.npk.id}"
		}
	} else {}) + (if settings.useSAML == true && settings.useCustomDNS == false then {
		"saml_acs_url": {
			"value": "https://${random_string.saml_domain.result}.auth.us-west-2.amazoncognito.com/saml2/idpresponse"
		}
	} else {}) + (if settings.useSAML == true && settings.useCustomDNS == true then {
		"saml_acs_url": {
			"value": "https://auth." + settings.dnsNames.www[0] + "/saml2/idpresponse"
		}
	} else {})
}