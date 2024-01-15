{
	base_vpc(basename, region, cidr, azs, baseendpoints):: {

		// Overload the name for scalability.
		local name = "%s-%s" % [basename, region],
		local provider = "aws.%s" % [region],
		local vpc_id = "${aws_vpc.%s.id}" % [name],

		// Since Jsonnet doesn't have a log2(), we need to do some hackery.
		// This only works up to 17, but that should be more than plenty.
		local log2map = [0, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5],
		local segments = log2map[std.length(azs)],

		local gatewayEndpoints = ["s3", "dynamodb"],

		// Interpolate a single '%s' as region.
		local endpointName(endpoint) = [std.strReplace(endpoint, ".", "-"), 'com.amazonaws.%s.%s' % [region, endpoint]],

		// Interpolate all services now.
		local endpoints = std.map(endpointName, baseendpoints),

		resource: {
			aws_vpc: {
				[name]: {
					provider: provider,
					cidr_block: cidr,
					enable_dns_support: true,
					enable_dns_hostnames: true,

					tags: {
						Name: name
					}
				}
			},
			aws_subnet: {
				["%s-subnet-%s" % [name, azs[i]]]: {
					provider: provider,
					cidr_block: "${cidrsubnet(aws_vpc.%s.cidr_block, %d, %d)}" % [name, segments, i],
					availability_zone: azs[i],
					vpc_id: vpc_id,

					tags: {
						Name: "%s-subnet-%s" % [name, azs[i]]
					}
				}
				for i in std.range(0, std.length(azs) - 1)
			},
			aws_route_table: {
				[name]: {
					provider: provider,
					vpc_id: vpc_id,

					tags: {
						Name: name
					}
				}
			},
			aws_main_route_table_association: {
				[name]: {
					provider: provider,
					vpc_id: vpc_id,
					route_table_id: "${aws_route_table.%s.id}" % [name]
				}
			},
			aws_route_table_association: {

				["%s-%s" % [name, azName]]: {
					local subnetName = "%s-subnet-%s" % [name, azName],

					provider: provider,
					route_table_id: "${aws_route_table.%s.id}" % [name],
					subnet_id: "${aws_subnet.%s.id}" % [subnetName]
				}
				for azName in azs
			},
			aws_security_group: {
				["%s-default" % name]: {
					provider: provider,
					name: "%s-default" % name,
					vpc_id: vpc_id,

					ingress: [{
						description: "Allow same group.",
						from_port: 0,
						to_port: 0,
						protocol: "-1",
						cidr_blocks: [],
						'self': true,
						prefix_list_ids: [],
						security_groups: [],
						ipv6_cidr_blocks: []
					}],

					egress: [{
						description: "Allow internet acces",
						protocol: "-1",
						from_port: 0,
						to_port: 0,
						cidr_blocks: ["0.0.0.0/0"],
						'self': false,
						prefix_list_ids: [],
						security_groups: [],
						ipv6_cidr_blocks: []
					}]
				}
			}
		} + std.prune({
			aws_vpc_endpoint: {
				["%s-%s" % [name, endpoint[0]]]: {
					provider: provider,
					service_name: endpoint[1],
					vpc_id: vpc_id,

					[if std.member(gatewayEndpoints, endpoint[0]) then null else 'vpc_endpoint_type']: "Interface",
					[if std.member(gatewayEndpoints, endpoint[0]) then null else 'private_dns_enabled']: true,
					[if std.member(gatewayEndpoints, endpoint[0]) then null else 'security_group_ids']: [
						"${aws_security_group.%s-default.id}" % name
					],

					tags: {
						Name: "%s-%s" % [name, endpoint[1]]
					}
				}
				for endpoint in endpoints
			},
			aws_vpc_endpoint_subnet_association: {
				[if std.member(gatewayEndpoints, endpoint[0]) then null else "%s-%s-%s" % [name, endpoint[0], i]]: {
					local vpceName = "%s-%s" % [name, endpoint[0]],
					local subnetName = "%s-subnet-%s" % [name, azs[i]],

					provider: provider,
					subnet_id: "${aws_subnet.%s.id}" % [subnetName],
					vpc_endpoint_id: "${aws_vpc_endpoint.%s.id}" % [vpceName]
				}
				for endpoint in endpoints
				for i in std.range(0, std.length(azs) - 1)
			},
			aws_vpc_endpoint_route_table_association: {
				[if std.member(gatewayEndpoints, endpoint[0]) then "%s-%s" % [name, endpoint[0]] else null]: {
					local vpceName = "%s-%s" % [name, endpoint[0]],

					provider: provider,
					route_table_id: "${aws_route_table.%s.id}" % [name],
					vpc_endpoint_id: "${aws_vpc_endpoint.%s.id}" % [vpceName]
				}
				for endpoint in endpoints
			}
		})
	},
	public_vpc(basename, region, cidr, azs, baseendpoints):: $.base_vpc(basename, region, cidr, azs, baseendpoints) + {
		// Overload the name for scalability.
		local name = "%s-%s" % [basename, region],
		local provider = "aws.%s" % [region],
		local vpc_id = "${aws_vpc.%s.id}" % [name],

		// Interpolate a single '%s' as region.
		local endpointName(endpoint) =
			if (std.length(std.findSubstr('%s')) == 1) then
				endpoint % [region]
			else
				endpoint,

		// Interpolate all services now.
		local endpoints = std.map(endpointName, baseendpoints),

		resource+: {
			aws_route+: {
				["%s-igw" % [name]]: {
					provider: provider,
					route_table_id: "${aws_route_table.%s.id}" % [name],
					destination_cidr_block: "0.0.0.0/0",
					gateway_id: "${aws_internet_gateway.%s.id}" % [name]
				}
			},
			aws_internet_gateway+: {
				[name]: {
					provider: provider,
					vpc_id: vpc_id,

					tags: {
						Name: name
					}
				}
			}
		}
	}
}