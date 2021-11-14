local backend(settings) = {
	terraform: {
		backend: {
			s3: {
				bucket: settings.backend_bucket,
				key: "c6fc.io/npk3/terraform.tfstate",
				profile: settings.awsProfile,
				region: settings.primaryRegion
			}
		},
	}
};

backend