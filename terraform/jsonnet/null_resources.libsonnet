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

				}
			}
		}
	}
}
