local subnet(region, az, i) = 
	{
		provider: "aws." + region,
		vpc_id: "${aws_vpc." + region + ".id}",
		availability_zone: az,
		cidr_block: "${cidrsubnet(aws_vpc." + region + ".cidr_block, 8, " + (i + 1) + ")}"
	};

subnet