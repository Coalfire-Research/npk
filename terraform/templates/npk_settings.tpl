module.exports = {
	"www_dns_names": ['${www_dns_name}'],
	"region": "${region}",
	"campaign_max_price": ${campaign_max_price},
	"critical_events_sns_topic": "${critical_events_sns_topic}",
	"availabilityZones": {
  "us-east-1": [
    "us-east-1a",
    "us-east-1b",
    "us-east-1c",
    "us-east-1d",
    "us-east-1e",
    "us-east-1f"
  ],
  "us-east-2": [
    "us-east-2a",
    "us-east-2b",
    "us-east-2c"
  ],
  "us-west-1": [
    "us-west-1a",
    "us-west-1c"
  ],
  "us-west-2": [
    "us-west-2a",
    "us-west-2b",
    "us-west-2c",
    "us-west-2d"
  ]
}
}