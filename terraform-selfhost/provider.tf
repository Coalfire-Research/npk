variable access_key {}
variable secret_key {}
variable region {}

provider "aws" {
	access_key = "${var.access_key}"
	secret_key = "${var.secret_key}"
	region     = "${var.region}"
}

provider "aws" {
	alias  = "east_1"
	access_key = "${var.access_key}"
	secret_key = "${var.secret_key}"
	region = "us-east-1"
}

provider "aws" {
	alias  = "east_2"
	access_key = "${var.access_key}"
	secret_key = "${var.secret_key}"
	region = "us-east-2"
}

provider "aws" {
	alias  = "west_1"
	access_key = "${var.access_key}"
	secret_key = "${var.secret_key}"
	region = "us-west-1"
}

provider "aws" {
	alias  = "west_2"
	access_key = "${var.access_key}"
	secret_key = "${var.secret_key}"
	region = "us-west-2"
}

provider "null" {}