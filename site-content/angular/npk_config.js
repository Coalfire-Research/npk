window.aws_region = "us-west-2";

angular.module('app')
	.constant('COGNITO_CONFIG', {
		"UserPoolId": "us-west-2_FGkZ2IbF1",
		"ClientId": "4jdhd3gafl5asg8od0p6oicd5v"
	})
	.constant('COGNITO_CREDENTIALS', {
		"IdentityPoolId": "us-west-2:b3280cc1-56c4-4034-b5e5-ddf9cf4c2e06",
		"Logins": {
			'cognito-idp.us-west-2.amazonaws.com/us-west-2_FGkZ2IbF1': ""
		}
	})
	.constant('USERDATA_BUCKET', "npk-user-data-20190317161841875700000010")
	.constant('APIGATEWAY_URL', "api.dev.npkproject.io")
	;