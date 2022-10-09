window.aws_region = "${aws_region}";

angular.module('app')
	.constant('COGNITO_CONFIG', {
		"UserPoolId": "${user_pool_id}",
		"ClientId": "${client_id}"
	})
	.constant('COGNITO_CREDENTIALS', {
		"IdentityPoolId": "${identity_pool_id}",
		"Logins": {
			'cognito-idp.${primary_region}.amazonaws.com/${user_pool_id}': ""
		}
	})
	.constant('DICTIONARY_BUCKET', {
		name: "${dictionary_bucket}",
		region: "${primary_region}"
	})
	.constant('SAMLSSO', {
		"useSamlSSO": "${use_SAML}",
		"SAMLDomain": "${saml_domain}",
		"SAMLRedirectUrl": "${saml_redirect}",
		"SAMLIdp": "NPKSAML"
	})
	.constant('FAMILYREGIONS', ${familyRegions})
	.constant('FAMILIES', ${families})
	.constant('QUOTAS', ${quotas})
	.constant('REGIONS', ${regions})
	.constant('USERDATA_BUCKET', {
		name: "${userdata_bucket}",
		region: "${primary_region}"
	})
	.constant('APIGATEWAY_URL', "${api_gateway_url}")
	;