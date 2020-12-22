{
	resource(settings): {
		"resource": {
			"null_resource": {
				"s3-sync-static-content": {
					"provisioner": [{
						"local-exec": {
							"command": "aws --profile " + settings.awsProfile + " s3 --region " + settings.defaultRegion + " sync ${path.module}/../site-content/ s3://${aws_s3_bucket.static_site.id}"
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
							"command": "aws --region " + settings.defaultRegion + " --profile " + settings.awsProfile + " cognito-idp admin-add-user-to-group --user-pool-id ${aws_cognito_user_pool.npk.id} --username ${random_string.admin_password.keepers.admin_email} --group npk-admins"
						}
					}],

					"depends_on": ["aws_cognito_user_pool.npk"],
					"triggers": {
						"username": "${random_string.admin_password.keepers.admin_email}"
					}
				}
			}
		}
	}
}
