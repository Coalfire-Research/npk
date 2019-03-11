{
	resource(email): {
		"random_string": {
			"admin_password": {
				"length": 16,
				"special": false,
				"keepers": {
					"admin_email": email,
				}
			}
		}
	},
	"output": {
		"admin_password": {
			"value": "${random_string.admin_password.result}",
		}
	}
}