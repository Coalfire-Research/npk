{
	resource(settings): {
		aws_cognito_user_pool: {
			npk: {
				name: "NPK",
				mfa_configuration: "${var.cognito_user_mfa}",
				password_policy: {
					minimum_length: 12,
					require_lowercase: true,
					require_uppercase: true,
					require_symbols: false,
					require_numbers: true
				},
				admin_create_user_config: {
					allow_admin_create_user_only: true,
					invite_message_template: {
						email_subject: "NPK Invitation",
						email_message: "You've been invited to join an NPK deployment at https://${aws_cloudfront_distribution.npk.domain_name}. Use {username} and {####} to log in.",
						sms_message: "NPK user created. Use {username} and {####} to log in."
					} + if settings.useCustomDNS then {
						email_message: "You've been invited to join an NPK deployment at https://" + settings.wwwEndpoint + ". Use {username} and {####} to log in."
					} else { }
				},
				auto_verified_attributes: ["email"],
				username_attributes: ["email"]
			}
		},
		aws_cognito_user_pool_client: {
			npk: {
				name: "npk_client",
				user_pool_id: "${aws_cognito_user_pool.npk.id}",
				generate_secret: false
			} + if settings.useSAML then {
				allowed_oauth_flows_user_pool_client: "true",
				supported_identity_providers: ["${aws_cognito_identity_provider.saml.provider_name}"],
				allowed_oauth_scopes: ["email", "openid"],
				allowed_oauth_flows: ["code"],
				callback_urls: ["https://" + settings.wwwEndpoint],
				logout_urls: ["https://" + settings.wwwEndpoint]
			} else {}
		},
		aws_cognito_identity_pool: {
			main: {
				identity_pool_name: "NPK Identity Pool",
				allow_unauthenticated_identities: false,
				cognito_identity_providers: {
					client_id: "${aws_cognito_user_pool_client.npk.id}",
					provider_name: "${aws_cognito_user_pool.npk.endpoint}",
					server_side_token_check: false,
				},
				provisioner: {
					"local-exec": {
						command: "aws --region %s cognito-idp admin-create-user --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --user-attributes='[{\"Name\": \"email\", \"Value\": \"${random_string.admin_password.keepers.admin_email}\"}, {\"Name\": \"email_verified\", \"Value\": \"true\"}]' --temporary-password ${random_string.admin_password.result}" % [settings.primaryRegion]
					}
				}
			}
		},
		aws_cognito_user_group: {
			"npk-admins": {
				name: "npk-admins",
				user_pool_id: "${aws_cognito_user_pool.npk.id}",
				description: "Administrators of NPK",
				precedence: "0",
				role_arn: "${aws_iam_role.cognito_admins.arn}"
			}
		}
	} + (if settings.useSAML then {
		aws_cognito_identity_provider: {
			saml: {
				user_pool_id: "${aws_cognito_user_pool.npk.id}",
				provider_name: "NPKSAML",
				provider_type: "SAML",

				provider_details: {
					IDPSignout: "false"
				} + if std.objectHas(settings, "sAMLMetadataUrl") then {
					MetadataURL: settings.sAMLMetadataUrl
				} else {} + if std.objectHas(settings, "sAMLMetadataFile") then {
					MetadataFile: "${file(\"" + settings.sAMLMetadataFile + "\")}"
				} else {},

				attribute_mapping: {
					email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
				}
			}
		}
	} else {}) + (if !settings.useCustomDNS then {
		aws_cognito_user_pool_domain: {
			saml: {
				domain: "${random_string.saml_domain.result}",
				user_pool_id: "${aws_cognito_user_pool.npk.id}"
			}
		}
	} else {
		aws_cognito_user_pool_domain: {
			saml: {
				depends_on: ["aws_route53_record.www"],
				domain: settings.authEndpoint,
				certificate_arn: "${aws_acm_certificate.main.arn}",
				user_pool_id: "${aws_cognito_user_pool.npk.id}"
			}
		}
	}),
	output(settings): {
		admin_create_user_command: {
			value: "aws --region %s cognito-idp admin-create-user --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --user-attributes='[{\"Name\": \"email\", \"Value\": \"${random_string.admin_password.keepers.admin_email}\"}, {\"Name\": \"email_verified\", \"Value\": \"true\"}]' --temporary-password ${random_string.admin_password.result}" % [settings.primaryRegion],
		},
		admin_join_group_command: {
			value: "aws --region %s cognito-idp admin-add-user-to-group --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --group npk-admins --user-attributes '[{\"Name\": \"email\", \"Value\": \"${random_string.admin_password.keepers.admin_email}\"}, {\"Name\": \"email_verified\", \"Value\": \"true\"}]' --temporary-password ${random_string.admin_password.result}" % [settings.primaryRegion],
		},
		saml_entity_id: {
			value: "urn:amazon:cognito:sp:${aws_cognito_user_pool.npk.id}"
		}
	} + (if !settings.useCustomDNS then {
		saml_acs_url: {
			value: "https://${random_string.saml_domain.result}.auth." + settings.primaryRegion + ".amazoncognito.com/saml2/idpresponse"
		}
	} else {
		saml_acs_url: {
			value: "https://" + settings.authEndpoint + "/saml2/idpresponse"
		}
	})
}