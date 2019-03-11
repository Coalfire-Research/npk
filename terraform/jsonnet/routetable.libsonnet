local routetable(region) = {
	provider: "aws." + region,
	vpc_id: "${aws_vpc." + region + ".id}",
	route: {
		cidr_block: "0.0.0.0/0",
		gateway_id: "${aws_internet_gateway." + region + ".id}"
	}
};

local endpoint(region, endpoint) = {
	provider: "aws." + region,
	vpc_endpoint_id: "${aws_vpc_endpoint." + endpoint + ".id}",
	route_table_id: "${aws_route_table." + region + ".id}"
};

local association(region, az) = {
	provider: "aws." + region,
	subnet_id: "${aws_subnet." + az + ".id}",
	route_table_id: "${aws_route_table." + region + ".id}"
};

{
	routetable: routetable,
	endpoint: endpoint,
	association: association
}