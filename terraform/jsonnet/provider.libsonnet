{
	aws_provider: {
		"aws": {
			profile: "${var.profile}",
			region: "${var.region}"
		}
	},

	aws_alias(region): {
		"aws": {
			alias: region,
			profile: "${var.profile}",
			region: region
		}
	}
}
