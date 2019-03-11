local vpc(region, index) = {
	provider: "aws." + region,
	cidr_block: "10." + (200 + (index - 1)) + ".0.0/16"
};

local endpoint(region) = {
	provider: "aws." + region,
	vpc_id: "${aws_vpc." + region + ".id}",
	service_name: "com.amazonaws." + region + ".s3"
};

{
	vpc: vpc,
	endpoint: endpoint
}