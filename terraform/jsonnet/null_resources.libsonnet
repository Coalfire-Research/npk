{
	resource(settings): {
		"resource": {
			"null_resource": {
				"s3-sync-static-content": {
					"provisioner": [{
						"local-exec": {
							"command": "aws --profile %s --region %s s3 sync ${path.module}/../site-content/ s3://${aws_s3_bucket.static_site.id}" % [settings.awsProfile, settings.primaryRegion]
						}
					}],

					"depends_on": ["local_file.npk_config", "aws_s3_bucket.static_site"],
					"triggers": {
						"always-trigger": "${timestamp()}"
					}

				},
				"cognito-add-to-admin-group": {
					"provisioner": [{
						"local-exec": {
							"command": "aws --profile %s --region %s cognito-idp admin-add-user-to-group --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --group npk-admins" % [settings.awsProfile, settings.primaryRegion]
						}
					}],

					"depends_on": ["aws_cognito_user_pool.npk", "aws_cognito_identity_pool.main", "aws_cognito_user_group.npk-admins"],
					"triggers": {
						"username": "${random_string.admin_password.keepers.admin_email}"
					}
				}
			}
		}
	}
}
