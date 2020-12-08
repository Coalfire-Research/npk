variable aws_profile {}
variable region { default = "us-west-2" }

provider "aws" {
	profile = "${var.aws_profile}"
	region     = "${var.region}"
}

provider "aws" {
	alias  = "east_1"
	profile = "${var.aws_profile}"
	region = "us-east-1"
}

provider "aws" {
	alias  = "east_2"
	profile = "${var.aws_profile}"
	region = "us-east-2"
}

provider "aws" {
	alias  = "west_1"
	profile = "${var.aws_profile}"
	region = "us-west-1"
}

provider "aws" {
	alias  = "west_2"
	profile = "${var.aws_profile}"
	region = "us-west-2"
}

provider "null" {}