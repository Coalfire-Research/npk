local igw(region) = {
	provider: "aws." + region,
	vpc_id: "${aws_vpc." + region + ".id}"
};

igw