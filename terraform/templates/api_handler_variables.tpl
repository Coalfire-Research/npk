module.exports = {
	www_dns_names: ['${www_dns_name}'],
	campaign_max_price: ${campaign_max_price},
	dictionary_buckets: {
		"us-east-1": "${use1}",
		"us-east-2": "${use2}",
		"us-west-1": "${usw1}",
		"us-west-2": "${usw2}",
	},
	userdata_bucket: "${userdata}",
	instanceProfile: "${instanceProfile}",
	iamFleetRole: "${iamFleetRole}",
	availabilityZones: {
   "us-east-1": {
      "us-east-1a": "${us-east-1a}",
      "us-east-1b": "${us-east-1b}",
      "us-east-1c": "${us-east-1c}",
      "us-east-1d": "${us-east-1d}",
      "us-east-1e": "${us-east-1e}",
      "us-east-1f": "${us-east-1f}"
   },
   "us-east-2": {
      "us-east-2a": "${us-east-2a}",
      "us-east-2b": "${us-east-2b}",
      "us-east-2c": "${us-east-2c}"
   },
   "us-west-1": {
      "us-west-1b": "${us-west-1b}",
      "us-west-1c": "${us-west-1c}"
   },
   "us-west-2": {
      "us-west-2a": "${us-west-2a}",
      "us-west-2b": "${us-west-2b}",
      "us-west-2c": "${us-west-2c}",
      "us-west-2d": "${us-west-2d}"
   }
}
}