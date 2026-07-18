{
	resource(email): {
		"random_string": {
			"admin_password": {
				"length": 16,
				"special": false,
				"min_numeric": 1,
				"min_lower": 1,
				"min_upper": 1,
				"keepers": {
					"admin_email": email,
				}
			},
			"saml_domain": {
				"length": 16,
				"special": false,
				"upper": false,
				"min_numeric": 1,
				"min_lower": 1
			}
		}
	},
	"output": {
		"admin_password": {
			"value": "${random_string.admin_password.result}",
		}
	}
}