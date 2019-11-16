data "aws_iam_policy_document" "cognito_authenticated" {

	/* TODO: This might require revision, but it's the default for Cognito-assumable roles */
	statement {
		sid = "1"

		actions = [
			"cognito-identity:*",
			"mobileanalytics:PutEvents",
			"cognito-sync:*",
			"ec2:describeSpotPriceHistory",
			"pricing:*"
		]

		resources = [
			"*"
		]
	}

	statement {
		sid = "2"

		actions = [
			"s3:PutObject"
		]

		resources = [
			"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}/uploads/*"
		]
	}

	// TODO: This statement doesn't restrict file, mime, or content types
	// IAM doesn't support such restrictions.
	// Write an S3 upload hook to boot not-ok files.
	statement {
		sid = "3"

		actions = [
			"s3:GetObject",
			"s3:ListObjectVersions",
			"s3:DeleteObject"
		]

		resources = [
			"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}",
			"${aws_s3_bucket.user_data.arn}/&{cognito-identity.amazonaws.com:sub}/*"
		]
	}

	statement {
		sid = "4"

		actions = [
			"s3:ListBucket"
		]

		resources = [
			"${aws_s3_bucket.user_data.arn}",
		]

		condition {
			test = "StringLike"
			variable = "s3:prefix"

			values = [
				"&{cognito-identity.amazonaws.com:sub}/",
				"&{cognito-identity.amazonaws.com:sub}/*",
			]
		}
	}

	statement {
		sid = "5"

		actions = [
			"s3:ListBucket"
		]

		resources = [
			"${aws_s3_bucket.user_data.arn}",
		]

		condition {
			test = "StringLike"
			variable = "s3:prefix"

			values = [
				"&{cognito-identity.amazonaws.com:sub}/",
				"&{cognito-identity.amazonaws.com:sub}/*",
			]
		}
	}

	statement {
		sid = "6"

		actions = [
			"dynamodb:GetItem",
			"dynamodb:BatchGetItem",
			"dynamodb:Query"
		]

		resources = [
			"${aws_dynamodb_table.campaigns.arn}",
			"${aws_dynamodb_table.settings.arn}"
		]

		condition {
			test = "ForAllValues:StringEquals"
			variable = "dynamodb:LeadingKeys"

			values = [
				"&{cognito-identity.amazonaws.com:sub}",
				"admin"
			]
		}
	}

	statement {
		sid = "7"

		actions = [
			"s3:ListBucket"
		]

		resources = [
			"${var.dictionary-east-1}",
			"${var.dictionary-east-2}",
			"${var.dictionary-west-1}",
			"${var.dictionary-west-2}"
		]
	}

	statement {
		sid = "8"

		actions = [
			"s3:GetObject"
		]

		resources = [
			"${var.dictionary-east-1}/*",
			"${var.dictionary-east-2}/*",
			"${var.dictionary-west-1}/*",
			"${var.dictionary-west-2}/*"
		]
	}

	statement {
		sid = "9"

		actions = [
			"execute-api:Invoke"
		]

		resources = [
			"${aws_api_gateway_deployment.npk.execution_arn}/*/userproxy/*"
		]
	}

	/* TODO: Add DynamoDB and Lambda policy items */
}

data "aws_iam_policy_document" "cognito_unauthenticated" {
	statement {
		sid = "1"

		actions = [
			"cognito-identity:*",
			"mobileanalytics:PutEvents",
			"cognito-sync:*"
		]

		resources = [
			"*"
		]
	}
}