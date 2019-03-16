window.aws_region = "us-west-2";

angular.module('app')
	.constant('COGNITO_CONFIG', {
		"UserPoolId": "us-west-2_88LUVcE9O",
		"ClientId": "38uhcq8sjfod7b86vqmk0ao7fb"
	})
	.constant('COGNITO_CREDENTIALS', {
		"IdentityPoolId": "us-west-2:fec93a8e-63d8-4942-91e0-d954f3520aab",
		"Logins": {
			'cognito-idp.us-west-2.amazonaws.com/us-west-2_88LUVcE9O': ""
		}
	})
	.constant('USERDATA_BUCKET', "npk-user-data-20190314165032881400000010")
	.constant('APIGATEWAY_URL', "rc9vbh8dlk.execute-api.us-west-2.amazonaws.com")
	;