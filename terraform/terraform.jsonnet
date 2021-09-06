local backend = import 'jsonnet/backend.libsonnet';
local provider = import 'jsonnet/provider.libsonnet';

local iam = import 'jsonnet/iam.libsonnet';
local igw = import 'jsonnet/igw.libsonnet';
local acm = import 'jsonnet/acm.libsonnet';
local api_gateway_map = import 'jsonnet/api_gateway_map.libsonnet';
local cloudfront = import 'jsonnet/cloudfront.libsonnet';
local cloudwatch = import 'jsonnet/cloudwatch.libsonnet';
local cognito = import 'jsonnet/cognito.libsonnet';
local cognito_iam_roles = import 'jsonnet/cognito_iam_roles.libsonnet';
local dynamodb = import 'jsonnet/dynamodb.libsonnet';
local dynamodb_settings = import 'jsonnet/dynamodb_settings.libsonnet';
local ec2_iam_roles = import 'jsonnet/ec2_iam_roles.libsonnet';
local keepers = import 'jsonnet/keepers.libsonnet';
local lambda = import 'jsonnet/lambda.libsonnet';
// local lambda_functions = import 'jsonnet/lambda_functions.libsonnet';
// local lambda_iam_roles = import 'jsonnet/lambda_iam_roles.libsonnet';
local null_resources = import 'jsonnet/null_resources.libsonnet';
local route = import 'jsonnet/routetable.libsonnet';
local route53 = import 'jsonnet/route53.libsonnet';
local s3 = import 'jsonnet/s3.libsonnet';
local subnet = import 'jsonnet/subnet.libsonnet';
local templates = import 'jsonnet/templates.libsonnet';
local variables = import 'jsonnet/variables.libsonnet';
local vpc = import 'jsonnet/vpc.libsonnet';

local npksettings = import 'npk-settings.json';
local regions = import 'regions.json';
local quotas = import 'quotas.json';

local settings = npksettings + {
	defaultRegion: "us-west-2",
	regions: regions,
	quotas: quotas,
	useCustomDNS: std.objectHas(npksettings, 'dnsBaseName'),
	[if std.objectHas(npksettings, 'dnsBaseName') then 'wwwEndpoint']: "www.%s" % [npksettings.dnsBaseName],
	[if std.objectHas(npksettings, 'dnsBaseName') then 'apiEndpoint']: "api.%s" % [npksettings.dnsBaseName],
	[if std.objectHas(npksettings, 'dnsBaseName') then 'authEndpoint']: "auth.%s" % [npksettings.dnsBaseName],
	useSAML: std.objectHas(npksettings, 'sAMLMetadataFile') || std.objectHas(npksettings, 'sAMLMetadataUrl')
};

local regionKeys = std.objectFields(settings.regions);

{
	[if settings.useCustomDNS then 'acm.tf.json' else null]: {
		resource: acm.certificate("main", "*.%s" % [settings.dnsBaseName], [settings.dnsBaseName], settings.route53Zone)
	},
	'api_gateway.tf.json': api_gateway_map.rest_api('npk', {
  		parameters: {
  			endpoint_configuration: {
  				types: ["EDGE"]
  			}
  		},
  		deployment: {
  			stage_name: "v1"
  		},
  		root: {
  			children: [{
  				pathPart: "userproxy",
  				methods: {
  					OPTIONS: {
  						optionsIntegration: true,
  						parameters: {
	  						authorization: "NONE",
	  						request_parameters: {
								"method.request.path.proxy": true
							}
						}
  					}
  				},
  				children: [{
  					pathPart: "campaign",
  					methods: {
  						POST: {
  							lambdaIntegration: "create_campaign",
  							parameters: {
  								authorization: "AWS_IAM"
  							}
  						},
  						OPTIONS: {
	  						optionsIntegration: true,
	  						parameters: {
		  						authorization: "NONE",
		  						request_parameters: {
									"method.request.path.proxy": true
								}
							}
	  					}
  					},
  					children: [{
  						pathPart: "{campaign}",
  						methods: {
  							DELETE: {
	  							lambdaIntegration: "delete_campaign",
	  							parameters: {
	  								authorization: "AWS_IAM",
	  								request_parameters: {
										"method.request.path.campaign": true
									}
	  							}
	  						},
	  						PUT: {
	  							lambdaIntegration: "execute_campaign",
	  							parameters: {
	  								authorization: "AWS_IAM"
	  							}
	  						},
	  						OPTIONS: {
		  						optionsIntegration: true,
		  						parameters: {
			  						authorization: "NONE",
			  						request_parameters: {
										"method.request.path.proxy": true
									}
								}
		  					}
	  					},
  					}]
  				}]
  			}, {
  				pathPart: "statusreport",
  				methods: {
  					OPTIONS: {
  						optionsIntegration: true,
  						parameters: {
	  						authorization: "NONE",
	  						request_parameters: {
								"method.request.path.proxy": true
							}
						}
  					}
  				},
  				children: [{
  					pathPart: "{proxy+}",
  					methods: {
  						POST: {
  							lambdaIntegration: "status_reporter",
  							parameters: {
  								authorization: "AWS_IAM"
  							}
  						},
  						OPTIONS: {
	  						optionsIntegration: true,
	  						parameters: {
		  						authorization: "NONE",
		  						request_parameters: {
									"method.request.path.proxy": true
								}
							}
	  					}
  					}
  				}]
  			}]
  		}
  	}),
	'api_gateway_addons.tf.json': {
		resource: {
			aws_api_gateway_account: {
				"us-west-2": {
					cloudwatch_role_arn: "${aws_iam_role.npk-apigateway_cloudwatch.arn}"
				}
			},
			aws_api_gateway_authorizer: {
				npk: {
					name: "npk",
					type: "COGNITO_USER_POOLS",
					rest_api_id: "${aws_api_gateway_rest_api.npk.id}",
					provider_arns: [
						"${aws_cognito_user_pool.npk.arn}"
					]
				}
			},
		}
	},
	[if settings.useCustomDNS then 'api_gateway_addons-useCustomDNS.tf.json' else null]: {
		resource: {
			aws_api_gateway_base_path_mapping: {
				npk: {
					api_id: "${aws_api_gateway_rest_api.npk.id}",
					stage_name: "${aws_api_gateway_deployment.npk.stage_name}",
					domain_name: "${aws_api_gateway_domain_name.npk.domain_name}",
					base_path: "v1"
				}
			},
			aws_api_gateway_domain_name: {
				npk: {
					certificate_arn: "${aws_acm_certificate.main.arn}",
					domain_name: "api.%s" % [settings.dnsBaseName],
					depends_on: ["aws_acm_certificate_validation.main"]
				}
			}
		}
	},
	'backend.tf.json': backend(settings),
	'cloudfront.tf.json': {
		resource: cloudfront.resource(settings),
		output: cloudfront.output
	},
	'cloudwatch.tf.json': cloudwatch,
	'cloudwatch-policy.tf.json': {
		data: {
			aws_iam_policy_document: {
				cloudwatch_invoke_spot_monitor: {
					statement: {
						actions: ["lambda:Invoke"],
						resources: ["${aws_lambda_function.spot_monitor.arn}"]
					}
				}
			}
		}
	},
	'cloudwatch-api-gateway-role.tf.json': {
		resource: iam.iam_role(
			"npk-apigateway_cloudwatch",
			"Allow APIGateway to write to CloudWatch Logs",
			{},
	        {
	        	CloudWatchPut: [{
	        		Sid: "logs",
		            Effect: "Allow",
		            Action: [
		                "logs:CreateLogGroup",
		                "logs:CreateLogStream",
		                "logs:DescribeLogGroups",
		                "logs:DescribeLogStreams",
		                "logs:PutLogEvents",
		                "logs:GetLogEvents",
		                "logs:FilterLogEvents"
		            ],
		            Resource: "arn:aws:logs:*"
	        	}]
	        },
			[{
				Effect: "Allow",
				Principal: {
					Service: "apigateway.amazonaws.com"
				},
				Action: "sts:AssumeRole"
			}]
		)
	},
	'cognito_iam_roles.tf.json': {
		resource: cognito_iam_roles.resource,
		data: cognito_iam_roles.data(settings)
	},
	'cognito.tf.json': {
		resource: cognito.resource(settings),
		output: cognito.output(settings)
	},
	'data.tf.json': {
		data: {
			aws_caller_identity: {
				current: {}
			}
		}
	},
	'dynamodb.tf.json': {
		resource: {
			aws_dynamodb_table: {
				[i]: dynamodb[i] for i in std.objectFields(dynamodb)
			}
		}
	},
	'dynamodb_settings.tf.json': {
		resource: dynamodb_settings
	},
	'ec2_iam_roles.tf.json': ec2_iam_roles,
	'igw.tf.json': {
		resource: {
			aws_internet_gateway: {
				[regionKeys[i]]: igw(regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			}
		}
	},
	'keepers.tf.json': {
		resource: keepers.resource(settings.adminEmail),
		output: keepers.output	
	},
	'keys.tf.json': {
		resource: {
			tls_private_key: {
				ssh: {
					algorithm: "RSA",
					rsa_bits: 4096
				}
			},
			aws_key_pair: {
				[region]: {
					provider: "aws." + region,
					key_name: "npk-key",
					public_key: "${tls_private_key.ssh.public_key_openssh}"
				} for region in regionKeys
			},
			local_file: {
				ssh_key: {
					sensitive_content: "${tls_private_key.ssh.private_key_pem}",
					filename: "${path.module}/npk.pem",
					file_permission: "0600"
				}
			}
		}
	},
	'lambda-create_campaign.tf.json': lambda.lambda_function("create_campaign", {
		handler: "main.main",
		timeout: 20,
		memory_size: 512,

		environment: {
			variables: {

				www_dns_names: std.toString(settings.wwwEndpoint),
				campaign_max_price: "${var.campaign_max_price}",
				gQuota: settings.quotas.gquota,
				pQuota: settings.quotas.pquota,
				userdata_bucket: "${aws_s3_bucket.user_data.id}",
				instanceProfile: "${aws_iam_instance_profile.npk_node.arn}",
				iamFleetRole: "${aws_iam_role.npk_fleet_role.arn}",
				availabilityZones: std.strReplace(std.manifestJsonEx({
					[regionKeys[i]]: {
						[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
							for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
					}
					for i in std.range(0, std.length(regionKeys) - 1)
				}, ""), "\n", ""),
				dictionaryBuckets: std.strReplace(std.manifestJsonEx({
					[regionKeys[i]]: "${var.dictionary-" + regionKeys[i] + "-id}"
					for i in std.range(0, std.length(regionKeys) - 1)
				}, ""), "\n", ""),
				apigateway: if settings.useCustomDNS then
					settings.apiEndpoint
				else
					"${aws_api_gateway_rest_api.npk.id}.execute-api." + settings.defaultRegion + ".amazonaws.com"
			}
		},
	}, {
		statement: [{
			sid: "s3Put",
			actions: [
				"s3:PutObject"
			],
			resources: [
				"${aws_s3_bucket.user_data.arn}/*/campaigns/*/manifest.json",
				"${aws_s3_bucket.logs.arn}/api_gateway_proxy/*",
			]
		},{
			sid: "s3GetUserFile",
			actions: [
				"s3:GetObject"
			],
			resources: [
				"${aws_s3_bucket.user_data.arn}/*"
			]
		},{
			sid: "s3GetDictionaryFile",
			actions: [
				"s3:GetObject"
			],
			resources: [
				"${var.dictionary-" + regionKeys[i] + "}/*"
				for i in std.range(0, std.length(regionKeys) - 1)
			]
		},{
			sid: "ddb",
			actions: [
				"dynamodb:Query",
				"dynamodb:UpdateItem"
			],
			resources: [
				"${aws_dynamodb_table.campaigns.arn}"
			]
		},{
			sid: "adminGetUser",
			actions: [
				"cognito-idp:AdminGetUser"
			],
			resources: [
				"${aws_cognito_user_pool.npk.arn}"
			]
		}]
	}),
	'lambda-delete_campaign.tf.json': lambda.lambda_function("delete_campaign", {
		handler: "main.main",
		timeout: 20,
		memory_size: 512,

		environment: {
			variables: {
				www_dns_names: std.toString([settings.wwwEndpoint])
			}
		}
	}, {
		statement: [{
			sid: "ec2",
			actions: [
				"ec2:CancelSpotFleetRequests",
				"ec2:CreateTags",
				"ec2:DescribeImages",
				"ec2:DescribeSpotPriceHistory",
				"ec2:DescribeSpotFleetRequests"
			],
			resources: ["*"]
		},{
			sid: "ddb",
			actions: [
				"dynamodb:Query",
				"dynamodb:UpdateItem",
				"dynamodb:DeleteItem"
			],
			resources: [
				"${aws_dynamodb_table.campaigns.arn}"
			]
		},{
			sid: "adminGetUser",
			actions: [
				"cognito-idp:AdminGetUser"
			],
			resources: [
				"${aws_cognito_user_pool.npk.arn}"
			]
		}]
	}),
	'lambda-execute_campaign.tf.json': lambda.lambda_function("execute_campaign", {
		handler: "main.main",
		timeout: 60,
		memory_size: 512,

		environment: {
			variables: {
				www_dns_names: std.toString(settings.wwwEndpoint),
				campaign_max_price: "${var.campaign_max_price}",
				gQuota: settings.quotas.gquota,
				pQuota: settings.quotas.pquota,
				userdata_bucket: "${aws_s3_bucket.user_data.id}",
				instanceProfile: "${aws_iam_instance_profile.npk_node.arn}",
				iamFleetRole: "${aws_iam_role.npk_fleet_role.arn}",
				availabilityZones: std.strReplace(std.manifestJsonEx({
					[regionKeys[i]]: {
						[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
							for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
					}
					for i in std.range(0, std.length(regionKeys) - 1)
				}, ""), "\n", ""),
				dictionaryBuckets: std.strReplace(std.manifestJsonEx({
					[regionKeys[i]]: "${var.dictionary-" + regionKeys[i] + "-id}"
					for i in std.range(0, std.length(regionKeys) - 1)
				}, ""), "\n", ""),
				apigateway: if settings.useCustomDNS then
					settings.apiEndpoint
				else
					"${aws_api_gateway_rest_api.npk.id}.execute-api." + settings.defaultRegion + ".amazonaws.com"
			}
		},

		depends_on: ["local_file.userdata_template"]
	}, {
		statement: [{
			sid: "s3GetUserFile",
			actions: [
				"s3:GetObject"
			],
			resources: [
				"${aws_s3_bucket.user_data.arn}/*"
			]
		},{
			sid: "ec2",
			actions: [
				"ec2:DescribeImages",
				"ec2:DescribeSpotFleetRequests",
				"ec2:DescribeSpotPriceHistory",
				"ec2:RequestSpotFleet",
				"ec2:RunInstances",
				"ec2:CreateTags"
			],
			resources: ["*"]
		},{
			sid: "ddb",
			actions: [
				"dynamodb:Query",
				"dynamodb:UpdateItem",
				"dynamodb:DeleteItem"
			],
			resources: [
				"${aws_dynamodb_table.campaigns.arn}"
			]
		},{
			sid: "passrole",
			actions: [
				"iam:PassRole"
			],
			resources: [
				"${aws_iam_role.npk_instance_role.arn}",
				"${aws_iam_role.npk_fleet_role.arn}"
			]
		},{
			sid: "adminGetUser",
			actions: [
				"cognito-idp:AdminGetUser"
			],
			resources: [
				"${aws_cognito_user_pool.npk.arn}"
			]
		}]
	}),
	'lambda-spot_monitor.tf.json': lambda.lambda_function("spot_monitor", {
		handler: "main.main",
		timeout: 10,
		memory_size: 512,

		environment: {
			variables: {
				www_dns_name: std.toString(settings.wwwEndpoint),
				region: "${var.region}",
				campaign_max_price: "${var.campaign_max_price}",
				critical_events_sns_topic: "${aws_sns_topic.critical_events.id}",
				availabilityZones: std.manifestJsonEx({
					[regionKeys[i]]: {
						[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
							for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
					}
					for i in std.range(0, std.length(regionKeys) - 1)
				}, "")
			}
		},

		dead_letter_config: {
			target_arn:	"${aws_sns_topic.critical_events.arn}"
		}
	}, {
		statement: [{
			sid: "sns",
			actions: [
				"sns:Publish"
			],
			resources: [
				"${aws_sns_topic.critical_events.arn}"
			]
		},{
			sid: "ec2",
			actions: [
				"ec2:CancelSpotFleetRequests",
				"ec2:DescribeTags",
				"ec2:DescribeInstances",
				"ec2:DescribeInstanceStatus",
				"ec2:DescribeSpotFleetRequests",
				"ec2:DescribeSpotFleetRequestHistory",
				"ec2:DescribeSpotFleetInstances",
				"ec2:DescribeSpotInstanceRequests",
				"ec2:DescribeSpotPriceHistory"
			],
			resources: ["*"]
		},{
			sid: "ddb",
			actions: [
				"dynamodb:GetItem",
				"dynamodb:UpdateItem",
				"dynamodb:Query"
			],
			resources: [
				"${aws_dynamodb_table.campaigns.arn}",
				"${aws_dynamodb_table.campaigns.arn}/index/SpotFleetRequests"
			]
		}]
	}),
	'lambda-status_reporter.tf.json': lambda.lambda_function("status_reporter", {
		handler: "main.main",
		timeout: 10,
		memory_size: 512,

		environment: {
			variables: {
				www_dns_name: std.toString(settings.wwwEndpoint),
				region: "${var.region}",
				campaign_max_price: "${var.campaign_max_price}",
				critical_events_sns_topic: "${aws_sns_topic.critical_events.id}",
				availabilityZones: std.manifestJsonEx({
					[regionKeys[i]]: {
						[settings.regions[regionKeys[i]][azi]]: "${aws_subnet." + settings.regions[regionKeys[i]][azi] + ".id}"
							for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
					}
					for i in std.range(0, std.length(regionKeys) - 1)
				}, "")
			}
		},

		dead_letter_config: {
			target_arn:	"${aws_sqs_queue.status_reporter_dlq.arn}"
		},
	}, {
		statement: [{
			sid: "s3Put",
			actions: [
				"s3:PutObject"
			],
			resources: [
				"${aws_s3_bucket.user_data.arn}/*",
				"${aws_s3_bucket.logs.arn}/api_gateway_proxy/*",
			]
		},{
			sid: "s3GetDelete",
			actions: [
				"s3:GetObject",
				"s3:DeleteObject"
			],
			resources: [
				"${aws_s3_bucket.user_data.arn}/*"
			]
		},{
			sid: "ddb",
			actions: [
				"dynamodb:Query",
				"dynamodb:UpdateItem"
			],
			resources: [
				"${aws_dynamodb_table.campaigns.arn}"
			]
		},{
			sid: "sqs",
			actions: [
				"sqs:SendMessage"
			],
			resources: [
				"${aws_sqs_queue.status_reporter_dlq.arn}"
			]
		}]
	}),
	'null_resources.tf.json': null_resources.resource(settings),
	'provider.tf.json': {
		terraform: {
			required_providers: {
				aws: {
					source: "hashicorp/aws",
					version: "~> 3.57.0"
				},
				archive: {
					source: "hashicorp/archive",
					version: "~> 2.2.0"
				}
			}
		},
		provider: [{
			aws: {
				profile: settings.awsProfile,
				region: "us-west-2"
			}
		}, {
			archive: {}
		}] + [{
			aws: {
				alias: region,
				profile: settings.awsProfile,
				region: region
			}
		} for region in regionKeys]
	},
	# 'provider-aws.tf.json': {
	# 	provider: [
	# 		provider.aws_provider
	# 	] + [
	# 		provider.aws_alias(region) for region in regionKeys
	# 	]
	# },
	# 'provider-other.tf.json': {
	# 	provider: {
	# 		archive: {}
	# 	}
	# },
	[if settings.useCustomDNS then 'route53-main.tf.json' else null]: {
		resource: {
			aws_route53_record: {
				www: route53.record(
					settings.wwwEndpoint,
					settings.route53Zone,
					route53.alias(
						"${aws_cloudfront_distribution.npk.domain_name}",
						"${aws_cloudfront_distribution.npk.hosted_zone_id}"
					)
				)
			} + {
				api: route53.record(
					"api.%s" % [settings.dnsBaseName],
					settings.route53Zone,
					route53.alias(
						"${aws_api_gateway_domain_name.npk.cloudfront_domain_name}",
						"${aws_api_gateway_domain_name.npk.cloudfront_zone_id}"
					)
				)
			}
		}
	},
	[if settings.useSAML then 'route53-saml.tf.json' else null]: {
		resource: {
			saml: route53.record(
				settings.authEndpoint,
				settings.route53Zone,
				route53.alias(
					"${aws_cognito_user_pool_domain.saml.cloudfront_distribution_arn}",
					"Z2FDTNDATAQYW2"
				)
			)
		}
	},
	'routetable.tf.json': {
		resource: {
			aws_route_table: {
				[regionKeys[i]]: route.routetable(regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			},
			aws_route_table_association: { 
				[settings.regions[regionKeys[i]][azi]]: route.association(regionKeys[i], settings.regions[regionKeys[i]][azi])
					for i in std.range(0, std.length(regionKeys) - 1)
					for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1)
			},
			aws_vpc_endpoint_route_table_association: { 
				[regionKeys[i]]: route.endpoint(regionKeys[i], "s3-" + regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			},
		}
	},
	's3.tf.json': {
		resource: {
			aws_s3_bucket: {
				user_data: s3.bucket(
					"npk-user-data-",
					std.map(
						s3.cors_rule,
						[
							"http://localhost"
						] + if settings.useCustomDNS then
								[ "https://www.%s" % [settings.dnsBaseName] ]
							else
								[ "https://${aws_cloudfront_distribution.npk.domain_name}" ]
					)
				) + {
					lifecycle_rule: {
						enabled: "true",
						expiration: {
							days: 7
						},
						abort_incomplete_multipart_upload_days: 1
					}
				},
				static_site: s3.bucket("npk-site-content-"),
				logs: s3.bucket("npk-logs-") + {
					acl: "log-delivery-write"
				}
			}
		},
		output: {
			s3_static_site_sync_command: {
				value: "aws --profile " + settings.awsProfile + " s3 --region " + settings.defaultRegion + " sync ${path.module}/../site-content/ s3://${aws_s3_bucket.static_site.id}"
			}
		}
	},
	's3_policies.tf.json': {
		data: {
			aws_iam_policy_document: {
				s3_static_site: {
					statement: {
						actions: ["s3:GetObject"],
						resources: ["${aws_s3_bucket.static_site.arn}/*"],
						principals: {
							type: "AWS",
							identifiers: ["${aws_cloudfront_origin_access_identity.npk.iam_arn}"]
						}
					}
				}
			}
		},
		resource: {
			aws_s3_bucket_policy: {
				s3_static_site: {
					bucket: "${aws_s3_bucket.static_site.id}",
					policy: "${data.aws_iam_policy_document.s3_static_site.json}"
				}
			}
		}
	},
	'sns.tf.json': {
		resource: {
			aws_sns_topic: {
				critical_events: {
					name: "critical_events"
				}
			},
			aws_sns_topic_subscription: {
				critical_events_sms: {
					depends_on: ["aws_cloudfront_distribution.npk"],

					topic_arn: "${aws_sns_topic.critical_events.arn}",
					protocol: "sms",
					endpoint: settings.criticalEventsSMS
				}
			}
		}
	},
	'sqs.tf.json': {
		resource: {
			aws_sqs_queue: {
				api_handler_dlq: {
					name: "api_handler_dlq"
				},
				status_reporter_dlq: {
					name: "status_reporter_dlq"
				}
			}
		}
	},
	'subnet.tf.json': {
		resource: {
			aws_subnet: {
				[settings.regions[regionKeys[i]][azi]]: subnet(regionKeys[i], settings.regions[regionKeys[i]][azi], azi)
					for i in std.range(0, std.length(regionKeys) - 1)
					for azi in std.range(0, std.length(settings.regions[regionKeys[i]]) - 1) 
			} 
		}
	},
	'templates.tf.json': {
		data: templates.data(settings),
		resource: templates.resource
	},
	'template-inject_api_handler.json': {
		[regionKeys[i]]: templates.az(settings.regions[regionKeys[i]])
			for i in std.range(0, std.length(regionKeys) - 1)
	},
	'variables.tf.json': {
		variable: variables.variables(settings) + {
			profile: { default: settings.awsProfile },
	    	region: { default: settings.defaultRegion },
	    	campaign_data_ttl: { default: settings.campaign_data_ttl },
	    	campaign_max_price: { default: settings.campaign_max_price },
	    	useSAML: { default: settings.useSAML }
		}
	},
	'vpc.tf.json': {
		resource: {
			aws_vpc: {
				[regionKeys[i]]: vpc.vpc(regionKeys[i], i) for i in std.range(0, std.length(regionKeys) - 1)
			},
			aws_vpc_endpoint: {
				["s3-" + regionKeys[i]]: vpc.endpoint(regionKeys[i]) for i in std.range(0, std.length(regionKeys) - 1)
			},
		}
	}
}