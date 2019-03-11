{
	aws_provider: {
		"aws": {
			access_key: "${var.access_key}",
			secret_key: "${var.secret_key}",
			region: "${var.region}"
		}
	},

	aws_alias(region): {
		"aws": {
			alias: region,
			access_key: "${var.access_key}",
			secret_key: "${var.secret_key}",
			region: region
		}
	}
}
