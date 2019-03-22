window.aws_region = "us-west-2";

angular.module('app')
	.constant('COGNITO_CONFIG', {
		"UserPoolId": "us-west-2_rnLZywDSI",
		"ClientId": "dj6168v7cj93ol6knbjc2jvd"
	})
	.constant('COGNITO_CREDENTIALS', {
		"IdentityPoolId": "us-west-2:16a6905c-d4f1-4454-b98f-545450d8fb0c",
		"Logins": {
			'cognito-idp.us-west-2.amazonaws.com/us-west-2_rnLZywDSI': ""
		}
	})
	.constant('USERDATA_BUCKET', "npk-user-data-2019032216493250680000000f")
	.constant('APIGATEWAY_URL', "sq9rzmqkpk.execute-api.us-west-2.amazonaws.com")
	;