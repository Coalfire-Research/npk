/* Dictionary Buckets */

# TODO: Update the CORS rules to match the bucket/dns URLs.

# Primary Bucket
resource "aws_s3_bucket" "dictionary-west-2" {
	provider = "aws.west_2"
	bucket_prefix = "npk-dictionary-west-2-"
	acl = "private"
	force_destroy = true

	cors_rule {
	    allowed_headers = ["*"]
	    allowed_methods = ["GET", "HEAD"]
	    allowed_origins = ["*"]
	    expose_headers  = ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length"]
	    max_age_seconds = 3000
	}

	tags {
		Project = "NPK"
	}
}


# Other Buckets
resource "aws_s3_bucket" "dictionary-east-1" {
	provider = "aws.east_1"
	bucket_prefix = "npk-dictionary-east-1-"
	acl = "private"
	force_destroy = true

	cors_rule {
	    allowed_headers = ["*"]
	    allowed_methods = ["GET", "HEAD"]
	    allowed_origins = ["*"]
	    expose_headers  = ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length"]
	    max_age_seconds = 3000
	}

	tags {
		Project = "NPK"
	}
}

resource "aws_s3_bucket" "dictionary-east-2" {
	provider = "aws.east_2"
	bucket_prefix = "npk-dictionary-east-2-"
	acl = "private"
	force_destroy = true

	cors_rule {
	    allowed_headers = ["*"]
	    allowed_methods = ["GET", "HEAD"]
	    allowed_origins = ["*"]
	    expose_headers  = ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length"]
	    max_age_seconds = 3000
	}

	tags {
		Project = "NPK"
	}
}

resource "aws_s3_bucket" "dictionary-west-1" {
	provider = "aws.west_1"
	bucket_prefix = "npk-dictionary-west-1-"
	acl = "private"
	force_destroy = true

	cors_rule {
	    allowed_headers = ["*"]
	    allowed_methods = ["GET", "HEAD"]
	    allowed_origins = ["*"]
	    expose_headers  = ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length"]
	    max_age_seconds = 3000
	}

	tags {
		Project = "NPK"
	}
}