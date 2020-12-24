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
		}, {
			"name": "eventType",
			"type": "S"
		}],

		"global_secondary_index": [{
			"name": "SpotFleetRequests",
			"hash_key": "spotFleetRequestId",
			"projection_type": "INCLUDE",
			"non_key_attributes": ["price"]
		}, {
			"name": "Events",
			"hash_key": "eventType",
			"projection_type": "ALL"
		}],

		"ttl": {
			"attribute_name": "lastuntil",
			"enabled": true
		}
	}
}
