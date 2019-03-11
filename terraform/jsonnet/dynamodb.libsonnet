{
	"settings": {
		"name": "Settings",
		"billing_mode": "PAY_PER_REQUEST",
		"hash_key": "userid",
		"range_key": "keyid",

		"attribute": [{
			"name": "userid",
			"type": "S"
		}, {
			"name": "keyid",
			"type": "S"
		}]
	},
 	"campaigns": {
		"name": "Campaigns",
		"billing_mode": "PAY_PER_REQUEST",
		"hash_key": "userid",
		"range_key": "keyid",

		"attribute": [{
			"name": "userid",
			"type": "S"
		}, {
			"name": "keyid",
			"type": "S"
		}, {
			"name": "spotFleetRequestId",
			"type": "S"
		}],

		"global_secondary_index": [{
			"name": "SpotFleetRequests",
			"hash_key": "spotFleetRequestId",
			"projection_type": "INCLUDE",
			"non_key_attributes": ["price"]
		}],

		"ttl": {
			"attribute_name": "lastuntil",
			"enabled": true
		}
	}
}
