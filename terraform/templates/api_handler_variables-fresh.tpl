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
	availabilityZones: 