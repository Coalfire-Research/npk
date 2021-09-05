local routetable(region) = {
	provider: "aws." + region,
	vpc_id: "${aws_vpc." + region + ".id}",
	route: [{
		cidr_block: "0.0.0.0/0",
		gateway_id: "${aws_internet_gateway." + region + ".id}",
		egress_only_gateway_id: "",
		instance_id: "",
		ipv6_cidr_block: "",
		local_gateway_id: "",
		nat_gateway_id: "",
		network_interface_id: "",
		transit_gateway_id: "",
		vpc_peering_connection_id: "",
		carrier_gateway_id: "",
		destination_prefix_list_id: "",
		vpc_endpoint_id: ""
	}]
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