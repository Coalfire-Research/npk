local npksettings = import 'generated-settings.jsonnet';
local provider = import 'jsonnet/provider.libsonnet';
local vpc = import 'jsonnet/vpc.libsonnet';
local subnet = import 'jsonnet/subnet.libsonnet';
local route = import 'jsonnet/routetable.libsonnet';
local igw = import 'jsonnet/igw.libsonnet';
local dynamodb = import 'jsonnet/dynamodb.libsonnet';
local dynamodb_settings = import 'jsonnet/dynamodb_settings.libsonnet';
local cognito_iam_roles = import 'jsonnet/cognito_iam_roles.libsonnet';
local route53 = import 'jsonnet/route53.libsonnet';
local s3 = import 'jsonnet/s3.libsonnet';
local acm = import 'jsonnet/acm.libsonnet';
local api_gateway = import 'jsonnet/api_gateway.libsonnet';
local cloudfront = import 'jsonnet/cloudfront.libsonnet';
local cloudwatch = import 'jsonnet/cloudwatch.libsonnet';
local cognito = import 'jsonnet/cognito.libsonnet';
local ec2_iam_roles = import 'jsonnet/ec2_iam_roles.libsonnet';
local keepers = import 'jsonnet/keepers.libsonnet';
local lambda_functions = import 'jsonnet/lambda_functions.libsonnet';
local lambda_iam_roles = import 'jsonnet/lambda_iam_roles.libsonnet';
local templates = import 'jsonnet/templates.libsonnet';
local variables = import 'jsonnet/variables.libsonnet';
local templates = import 'jsonnet/templates.libsonnet';
local null_resources = import 'jsonnet/null_resources.libsonnet';

local settings = npksettings + {
	"defaultRegion": "us-west-2"
};

local defaultResource = {
	"tags": {
		"Project": "NPK"
	}
};

local regionKeys = std.objectFields(settings.regions);

{
	'acm.tf.json': if settings.useCustomDNS then {
		// TODO: Fix this to get 1 cert for all names.
		"resource": {
			"aws_acm_certificate": {
				["www-" + i]: defaultResource + acm.certificate(settings.dnsNames.www[i]) for i in std.range(0, std.length(settings.dnsNames.www) - 1)
			} + {
				["api-" + i]: defaultResource + acm.certificate(settings.dnsNames.api[i]) for i in std.range(0, std.length(settings.dnsNames.api) - 1)
			}
		} + if std.type(settings.route53Zone) == "string" then {
			"aws_route53_record": {
				["acm-validation-www-" + i]: acm.route53_record(
					"${aws_acm_certificate.www-" + i + ".domain_validation_options.0.resource_record_name}",
					"${aws_acm_certificate.www-" + i + ".domain_validation_options.0.resource_record_type}",
					"${aws_acm_certificate.www-" + i + ".domain_validation_options.0.resource_record_value}",
					settings.route53Zone
				) for i in std.range(0, std.length(settings.dnsNames.www) - 1)
			} + {
				["acm-validation-api-" + i]: acm.route53_record(
					"${aws_acm_certificate.api-" + i + ".domain_validation_options.0.resource_record_name}",
					"${aws_acm_certificate.api-" + i + ".domain_validation_options.0.resource_record_type}",
					"${aws_acm_certificate.api-" + i + ".domain_validation_options.0.resource_record_value}",
					settings.route53Zone
				) for i in std.range(0, std.length(settings.dnsNames.api) - 1)
			},
			"aws_acm_certificate_validation": {
				["www-" + i]: acm.certificate_validation(
					"${aws_acm_certificate.www-" + i + ".arn}",
					"${aws_route53_record.acm-validation-www-" + i + ".fqdn}"
				) for i in std.range(0, std.length(settings.dnsNames.www) - 1)
			} + {
				["api-" + i]: acm.certificate_validation(
					"${aws_acm_certificate.api-" + i + ".arn}",
					"${aws_route53_record.acm-validation-api-" + i + ".fqdn}"
				) for i in std.range(0, std.length(settings.dnsNames.api) - 1)
			}
		} else {}
	} + if std.type(settings.route53Zone) != "string" then {
		"output": {
			["acm-validation-www-" + i]: acm.manual_record(
				"${aws_acm_certificate.www-" + i + ".domain_validation_options.0.resource_record_name}",
				"${aws_acm_certificate.www-" + i + ".domain_validation_options.0.resource_record_type}",
				"${aws_acm_certificate.www-" + i + ".domain_validation_options.0.resource_record_value}"
			) for i in std.range(0, std.length(settings.dnsNames.www) - 1)
		} + {
			["acm-validation-api-" + i]: acm.manual_record(
				"${aws_acm_certificate.api-" + i + ".domain_validation_options.0.resource_record_name}",
				"${aws_acm_certificate.api-" + i + ".domain_validation_options.0.resource_record_type}",
				"${aws_acm_certificate.api-" + i + ".domain_validation_options.0.resource_record_value}"
			) for i in std.range(0, std.length(settings.dnsNames.api) - 1)
		}
	} else {}
	else {},
	'api_gateway.tf.json': {
		"resource": api_gateway.resource + if settings.useCustomDNS then {
			"aws_api_gateway_domain_name": {
				["api-url-" + i]: api_gateway.domain_name(
					settings.dnsNames.api[i],
					"${aws_acm_certificate.api-" + i + ".arn}"
				) for i in std.range(0, std.length(settings.dnsNames.api) - 1)
			},
			"aws_api_gateway_base_path_mapping": {
				["api-url-" + i]: api_gateway.base_path("${aws_api_gateway_domain_name.api-url-" + i + ".domain_name}")
					for i in std.range(0, std.length(settings.dnsNames.api) - 1)
			},
		} else {}
	},
	'cloudfront.tf.json': {
		"resource": cloudfront.resource(settings),
		"output": cloudfront.output
	},
	'cloudwatch.tf.json': cloudwatch,
	'cognito_iam_roles.tf.json': {
		"resource": cognito_iam_roles
	},
	'cognito.tf.json': {
		"resource": cognito.resource(settings),
		"output": cognito.output(settings)
	},
	'data.tf.json': {
		"data": {
			"aws_caller_identity": {
				"current": {}
			}
		}
	},
	'dynamodb.tf.json': {
		"resource": {
			"aws_dynamodb_table": {
				[i]: defaultResource + dynamodb[i] for i in std.objectFields(dynamodb)
			}
		}
	},
	'dynamodb_settings.tf.json': {
		"resource": dynamodb_settings
	},
	'ec2_iam_roles.tf.json': ec2_iam_roles,
	'igw.tf.json': {
		"resource": {
			"aws_internet_gateway": {
				[regionKeys[i]]: defaultResource + igw(regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			}
		}
	},
	'keepers.tf.json': {
		"resource": keepers.resource(settings.adminEmail),
		"output": keepers.output	
	},
	'keys.tf.json': {
		"resource": {
			"tls_private_key": {
				"ssh": {
					"algorithm": "RSA",
					"rsa_bits": 4096
				}
			},
			"aws_key_pair": {
				[region]: {
					"provider": "aws." + region,
					"key_name": "npk-key",
					"public_key": "${tls_private_key.ssh.public_key_openssh}"
				} for region in regionKeys
			}
		}
	},
	'lambda_functions.tf.json': lambda_functions,
	'lambda_iam_roles.tf.json': lambda_iam_roles,
	'null_resources.tf.json': null_resources.resource(settings),
	'provider-aws.tf.json': {
		"provider": [
			provider.aws_provider
		] + [
			provider.aws_alias(region) for region in regionKeys
		]
	},
	'provider-other.tf.json': {
		"provider": {
			"archive": {}
		}
	},
	'route53.tf.json': if settings.useCustomDNS && std.type(settings.route53Zone) == "string" then 
		{
			"resource": {
				"aws_route53_record": {
					["www-record-" + i]: route53.record(
						settings.dnsNames.www[i],
						settings.route53Zone,
						route53.alias(
							"${aws_cloudfront_distribution.npk.domain_name}",
							"${aws_cloudfront_distribution.npk.hosted_zone_id}"
						)
					) for i in std.range(0, std.length(settings.dnsNames.www) - 1)
				} + {
					["api-record-" + i]: route53.record(
						settings.dnsNames.api[i],
						settings.route53Zone,
						route53.alias(
							"${aws_api_gateway_domain_name.api-url-" + i + ".cloudfront_domain_name}",
							"${aws_api_gateway_domain_name.api-url-" + i + ".cloudfront_zone_id}"
						)
					) for i in std.range(0, std.length(settings.dnsNames.api) - 1)
				}
			}
		} else {},
	'routetable.tf.json': {
		"resource": {
			"aws_route_table": {
				[regionKeys[i]]: defaultResource + route.routetable(regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			},
			"aws_route_table_association": { 
				[settings.regions[regionKeys[i]][azi]]: route.association(regionKeys[i], settings.regions[regionKeys[i]][azi])
					for i in std.range(0, std.length(regionKeys) - 1)
					for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
			},
			"aws_vpc_endpoint_route_table_association": { 
				[regionKeys[i]]: route.endpoint(regionKeys[i], "s3-" + regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			},
		}
	},
	's3.tf.json': {
		"resource": {
			"aws_s3_bucket": {
				"user_data": defaultResource + s3.bucket(
					"npk-user-data-",
					std.map(
						s3.cors_rule,
						[
							"http://localhost"
						] + if settings.useCustomDNS then
								[ "https://" + i for i in settings.dnsNames.www ]
							else
								[ "https://${aws_cloudfront_distribution.npk.domain_name}" ]
					)
				) + {
					"lifecycle_rule": {
						"enabled": "true",
						"expiration": {
							"days": 7
						},
						"abort_incomplete_multipart_upload_days": 1
					}
				},
				"static_site": defaultResource + s3.bucket("npk-site-content-"),
				"logs": defaultResource + s3.bucket("npk-logs-") + {
					"acl": "log-delivery-write"
				}
			}
		},
		"output": {
			"s3_static_site_sync_command": {
				"value": "aws --profile " + settings.awsProfile + " s3 --region " + settings.defaultRegion + " sync ${path.module}/../site-content/ s3://${aws_s3_bucket.static_site.id}"
			}
		}
	},
	's3_policies.tf.json':: {
		"data": {
			"aws_iam_policy_document": {
				"s3_static_site": {
					"statement": {
						"actions": ["s3:GetObject"],
						"resources": ["${aws_s3_bucket.static_site.arn}/*"],
						"principals": {
							"type": "AWS",
							"identifiers": ["${aws_cloudfront_origin_access_identity.npk.iam_arn}"]
						}
					}
				}
			}
		},
		"resource": {
			"aws_s3_bucket_policy": {
				"s3_static_site": {
					"bucket": "${aws_s3_bucket.static_site.id}",
					"policy": "${data.aws_iam_policy_document.s3_static_site.json}"
				}
			}
		}
	},
	'sns.tf.json': {
		"resource": {
			"aws_sns_topic": {
				"critical_events": {
					"name": "critical_events"
				}
			},
			"aws_sns_topic_subscription": {
				"critical_events_sms": {
					"depends_on": ["aws_cloudfront_distribution.npk"],

					"topic_arn": "${aws_sns_topic.critical_events.arn}",
					"protocol": "sms",
					"endpoint": settings.criticalEventsSMS
				}
			}
		}
	},
	'sqs.tf.json': {
		"resource": {
			"aws_sqs_queue": {
				"api_handler_dlq": {
					"name": "api_handler_dlq"
				},
				"status_reporter_dlq": {
					"name": "status_reporter_dlq"
				}
			}
		}
	},
	'subnet.tf.json': {
		"resource": {
			"aws_subnet": {
				[settings.regions[regionKeys[i]][azi]]: subnet(regionKeys[i], settings.regions[regionKeys[i]][azi], azi)
					for i in std.range(0, std.length(regionKeys) - 1)
					for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1) 
			} 
		}
	},
	'templates.tf.json': {
		"data": templates.data(settings),
		"resource": templates.resource
	},
	'template-inject_api_handler.json': {
		[regionKeys[i]]: templates.az(settings.regions[regionKeys[i]])
			for i in std.range(0, std.length(regionKeys) - 1)
	},
	'variables.tf.json': {
		"variable": variables.variables + {
			"access_key": { "default": settings.access_key },
	    	"secret_key": { "default": settings.secret_key },
	    	"region": { "default": settings.defaultRegion },
	    	"campaign_data_ttl": { "default": settings.campaign_data_ttl },
	    	"campaign_max_price": { "default": settings.campaign_max_price }
		}
	},
	'vpc.tf.json': {
		"resource": {
			"aws_vpc": {
				[regionKeys[i]]: vpc.vpc(regionKeys[i], i) for i in std.range(0, std.length(regionKeys) - 1)
			},
			"aws_vpc_endpoint": {
				["s3-" + regionKeys[i]]: vpc.endpoint(regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			},
		}
	}
}