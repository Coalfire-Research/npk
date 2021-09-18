local backend(settings) = {
	terraform: {
		backend: {
			s3: {
				bucket: settings.backend_bucket,
				key: "c6fc.io/npk-2.5/terraform.tfstate",
				profile: settings.awsProfile,
				region: settings.defaultRegion
			}
		},
	}
};

backend