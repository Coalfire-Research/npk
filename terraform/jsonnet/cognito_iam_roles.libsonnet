{
	"aws_iam_role": {
		"cognito_authenticated": {
			"name_prefix": "cognito_authenticated_role_",
			"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
		    	"Effect": "Allow",
		    	"Principal": {"Federated": "cognito-identity.amazonaws.com"},
		    	"Action": "sts:AssumeRoleWithWebIdentity",
		    	"Condition": {
		    		"StringEquals": {"cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.main.id}"},
		    		"ForAnyValue:StringLike": {"cognito-identity.amazonaws.com:amr": "authenticated"}
			}}]}'
		},
		"cognito_unauthenticated": {
			"name_prefix": "cognito_unauthenticated_role_",
			"assume_role_policy": '{"Version": "2012-10-17","Statement": [{
				"Effect": "Allow","Principal": {"Federated": "cognito-identity.amazonaws.com"},
				"Action": "sts:AssumeRoleWithWebIdentity"}
			]}'
		},
	},
	"aws_iam_role_policy": {
		"cognito_authenticated": {
			"name_prefix": "cognito_authenticated_policy_",
			"role": "${aws_iam_role.cognito_authenticated.id}",
			"policy": "${data.aws_iam_policy_document.cognito_authenticated.json}"
		},
		"cognito_unauthenticated": {
			"name_prefix": "cognito_authenticated_policy_",
			"role": "${aws_iam_role.cognito_unauthenticated.id}",
			"policy": "${data.aws_iam_policy_document.cognito_unauthenticated.json}"
		}
	},
	"aws_cognito_identity_pool_roles_attachment": {
		"default": {
			"identity_pool_id": "${aws_cognito_identity_pool.main.id}",
			"roles": {
				"authenticated": "${aws_iam_role.cognito_authenticated.arn}",
				"unauthenticated": "${aws_iam_role.cognito_unauthenticated.arn}"
			}
		}
	}
}