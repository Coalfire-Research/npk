local aws = import 'aws-sdk';
local sonnetry = import 'sonnetry';
local modules = import 'modules';

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
local gpu_instance_families = import 'jsonnet/gpu_instance_families.json';
local keepers = import 'jsonnet/keepers.libsonnet';
local lambda = import 'jsonnet/lambda.libsonnet';
// local lambda_functions = import 'jsonnet/lambda_functions.libsonnet';
// local lambda_iam_roles = import 'jsonnet/lambda_iam_roles.libsonnet';
local null_resources = import 'jsonnet/null_resources.libsonnet';
local route = import 'jsonnet/routetable.libsonnet';
local route53 = import 'jsonnet/route53.libsonnet';
local s3 = import 'jsonnet/s3.libsonnet';
local subnet = import 'jsonnet/subnet.libsonnet';
// local templates = import 'jsonnet/templates.libsonnet';
local variables = import 'jsonnet/variables.libsonnet';
local vpc = import 'jsonnet/vpc.libsonnet';

local validatedSettings = std.extVar('validatedSettings');

local npksettings = import 'npk-settings.json';
// local regions = import 'regions.json';
// local quotas = import 'quotas.json';
// local hostedZone = import 'hostedZone.json';
// local providerRegions = import 'providerRegions.json';

local settings = {
	georestrictions: [],
	campaign_data_ttl: 604800,
	campaign_max_price: 50,
	awsProfile: "default",
	wwwEndpoint: "${aws_cloudfront_distribution.npk.domain_name}",
	primaryRegion: "us-west-2",
} + npksettings + {
	familyRegions: validatedSettings.familyRegions,
	families: gpu_instance_families,
	regions: validatedSettings.regions,
	quotas: validatedSettings.quotas,
	useCustomDNS: std.objectHas(validatedSettings, 'dnsBaseName'),
	useSAML: std.objectHas(npksettings, 'sAMLMetadataFile') || std.objectHas(npksettings, 'sAMLMetadataUrl')
} + if !std.objectHas(validatedSettings, 'dnsBaseName') then {} else {
	dnsBaseName: validatedSettings.dnsBaseName,
	wwwEndpoint: "%s" % [validatedSettings.dnsBaseName],
	apiEndpoint: "api.%s" % [validatedSettings.dnsBaseName],
	authEndpoint: "auth.%s" % [validatedSettings.dnsBaseName]
};

local accountDetails = {
	primaryRegion: settings.primaryRegion,
	families: gpu_instance_families,
	regions: validatedSettings.regions,
	quotas: validatedSettings.quotas
};

local apiName = "npkv3-%s" % std.md5(modules.random())[0:5];

local regionKeys = std.objectFields(settings.regions);

{
	[if settings.useCustomDNS then 'acm.tf.json' else null]: {
		resource: acm.certificate("main", "*.%s" % [settings.dnsBaseName], [settings.dnsBaseName], settings.route53Zone)
	},
	'api_gateway.tf.json': api_gateway_map.rest_api(apiName, {
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
				npk: {
					cloudwatch_role_arn: "${aws_iam_role.npk-apigateway_cloudwatch.arn}"
				}
			},
			aws_api_gateway_authorizer: {
				npk: {
					name: "npk",
					type: "COGNITO_USER_POOLS",
					rest_api_id: "${aws_api_gateway_rest_api.%s.id}" % apiName,
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
				[apiName]: {
					api_id: "${aws_api_gateway_rest_api.%s.id}" % apiName,
					stage_name: "${aws_api_gateway_deployment.%s.stage_name}" % apiName,
					domain_name: "${aws_api_gateway_domain_name.npk.domain_name}",
					base_path: "v1"
				}
			},
			aws_api_gateway_domain_name: {
				npk: {
					certificate_arn: "${aws_acm_certificate.main.arn}",
					domain_name: settings.apiEndpoint,
					depends_on: ["aws_acm_certificate_validation.main"]
				}
			}
		}
	},
	'backend.tf.json': sonnetry.bootstrap('c6fc_npk'),
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
				},
				cloudwatch_invoke_spot_interrupt_catcher: {
					statement: {
						actions: ["lambda:Invoke"],
						resources: ["${aws_lambda_function.spot_interrupt_catcher.arn}"]
					}
				}
			}
		}
	},
	'cloudwatch-interrupt_rules.tf.json': {
		resource: {
			aws_cloudwatch_event_rule: {
				['spot_interrupt_catcher-%s' % region]: {
					provider: "aws." + region,
					name: "npkSpotInterruptCatcher",
					description: "Catches spot instance interrupt notifications",
					event_pattern: std.manifestJsonEx({
						"detail-type": ["EC2 Spot Instance Interruption Warning"],
						source: ["aws.ec2"]
					}, ""),
					role_arn: "${aws_iam_role.cloudwatch_invoke_spot_monitor.arn}"
				} for region in regionKeys
			},
			aws_cloudwatch_event_target:{
				['spot_interrupt_catcher-%s' % region]: {
					provider: "aws." + region,
					rule: "${aws_cloudwatch_event_rule.spot_interrupt_catcher-%s.name}" % region,
					arn: "${aws_lambda_function.spot_interrupt_catcher.arn}"
				} for region in regionKeys
			},
			aws_lambda_permission: {
				['spot_interrupt_catcher-%s' % region]: {
					statement_id: "spot_interrupt_catcher-%s" % region,
					action: "lambda:InvokeFunction",
					function_name: "${aws_lambda_function.spot_interrupt_catcher.function_name}",
					principal: "events.amazonaws.com",
					source_arn: "${aws_cloudwatch_event_rule.spot_interrupt_catcher-%s.arn}" % region,
				} for region in regionKeys
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
		data: cognito_iam_roles.data(settings, apiName)
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
	'ec2_iam_roles.tf.json': ec2_iam_roles.roles(apiName),
	'ec2_iam_roles-compress.tf.json': {
		resource: iam.iam_role(
			"npk_ec2_compress",
			"NPK Compression Nodes",
			{},
	        {
	        	EC2Compression: [{
					Sid: "s3ToProcess",
					Effect: "Allow",
					Action: [
						"s3:GetObject",
						"s3:DeleteObject"
					],
					Resource: "arn:aws:s3:::${aws_s3_bucket.dictionary.id}/to_process/*"
				}, {
					Sid: "s3PutFiles",
					Effect: "Allow",
					Action: "s3:PutObject",
					Resource: [
						"arn:aws:s3:::${aws_s3_bucket.dictionary.id}/wordlist/*",
						"arn:aws:s3:::${aws_s3_bucket.dictionary.id}/rules/*"
					]
				}]
	        },
			[{
				Effect: "Allow",
				Principal: {
					Service: "ec2.amazonaws.com"
				},
				Action: "sts:AssumeRole"
			}]
		) + {
			aws_iam_instance_profile: {
				npk_ec2_compress: {
					name_prefix: "npk_ec2_compress_",
					role: "${aws_iam_role.npk_ec2_compress.name}"
				}
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
			local_sensitive_file: {
				ssh_key: {
					content: "${tls_private_key.ssh.private_key_pem}",
					filename: "${path.module}/npk.pem",
					file_permission: "0600"
				}
			}
		}
	},
	'lambda-compression_pipe.tf.json': lambda.lambda_function("compression_pipe", {
		handler: "main.main",
		timeout: 900,
		memory_size: 2048,

		environment: {
			variables: {
				compressionProfile: "${aws_iam_instance_profile.npk_ec2_compress.arn}",
				iamFleetRole: "${aws_iam_role.npk_fleet_role.arn}",
				subnets: std.manifestJsonEx([
					"${aws_subnet.npk-%s-subnet-%s.id}" % [settings.primaryRegion, az]
					for az in settings.regions[settings.primaryRegion]
				], ""),
				dictionaryBucket: "${aws_s3_bucket.dictionary.id}",
			}
		}
	}, {
		statement: [{
			sid: "s3ToProcess",
			actions: [
				"s3:GetObject",
				"s3:DeleteObject"
			],
			resources: [
				"arn:aws:s3:::${aws_s3_bucket.dictionary.id}/to_process/*"
			]
		}, {
			sid: "s3PutFiles",
			actions: [
				"s3:PutObject",
				"s3:GetObject",
				"s3:DeleteObject"
			],
			resources: [
				"arn:aws:s3:::${aws_s3_bucket.dictionary.id}/wordlist/*",
				"arn:aws:s3:::${aws_s3_bucket.dictionary.id}/rules/*",
			]
		}, {
			sid: "passrole",
			actions: [
				"iam:PassRole"
			],
			resources: [
				"${aws_iam_role.npk_ec2_compress.arn}",
				"${aws_iam_role.npk_fleet_role.arn}"
			]
		}, {
			sid: "ec2",
			actions: [
				"ec2:DescribeImages",
				"ec2:DescribeSubnets",
				"ec2:RequestSpotFleet",
				"ec2:RunInstances",
				"ec2:CreateTags"
			],
			resources: ["*"]
		}, {
			sid: "sq",
			actions: [
				"servicequotas:GetServiceQuota"
			],
			resources: ["*"]
		}]
	}),
	'lambda-compression_pipe-permission.tf.json': {
		resource: {
			aws_lambda_permission: {
				uploads: {
					statement_id: "AllowBucketEvents",
					action: "lambda:InvokeFunction",
					function_name: "${aws_lambda_function.compression_pipe.id}",
					principal: "s3.amazonaws.com",
					source_arn: "${aws_s3_bucket.dictionary.arn}"
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

				www_dns_names: settings.wwwEndpoint,
				campaign_max_price: "${var.campaign_max_price}",
				quotas: std.strReplace(std.manifestJsonEx(settings.quotas, ""), "\n", ""),
				userdata_bucket: "${aws_s3_bucket.user_data.id}",
				instanceProfile: "${aws_iam_instance_profile.npk_node.arn}",
				iamFleetRole: "${aws_iam_role.npk_fleet_role.arn}",
				regions: std.manifestJsonEx({
					[region]: "${aws_vpc.npk-%s.id}" % region
					for region in regionKeys
				}, ""),
				dictionaryBucket: "${aws_s3_bucket.dictionary.id}",
				dictionaryBucketRegion: settings.primaryRegion,
				apigateway: if settings.useCustomDNS then
					settings.apiEndpoint
				else
					"${aws_api_gateway_rest_api.%s.id}.execute-api.%s.amazonaws.com" % [apiName, settings.primaryRegion]
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
				"arn:aws:s3:::${aws_s3_bucket.dictionary.id}/*"
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
				"cognito-idp:AdminGetUser",
				"cognito-idp:ListUsers"
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
				"cognito-idp:AdminGetUser",
				"cognito-idp:ListUsers"
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
				quotas: std.strReplace(std.manifestJsonEx(settings.quotas, ""), "\n", ""),
				userdata_bucket: "${aws_s3_bucket.user_data.id}",
				instanceProfile: "${aws_iam_instance_profile.npk_node.arn}",
				iamFleetRole: "${aws_iam_role.npk_fleet_role.arn}",
				regions: std.manifestJsonEx({
					[region]: "${aws_vpc.npk-%s.id}" % region
					for region in regionKeys
				}, ""),
				dictionaryBucket: "${aws_s3_bucket.dictionary.id}",
				apigateway: if settings.useCustomDNS then
					settings.apiEndpoint
				else
					"${aws_api_gateway_rest_api.%s.id}.execute-api.%s.amazonaws.com" % [apiName, settings.primaryRegion]
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
				"ec2:DescribeSubnets",
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
				"cognito-idp:AdminGetUser",
				"cognito-idp:ListUsers"
			],
			resources: [
				"${aws_cognito_user_pool.npk.arn}"
			]
		},{
            effect: "Allow",
            actions: [
            	"iam:CreateServiceLinkedRole"
            ],
            resources: [
            	"arn:aws:iam::*:role/aws-service-role/spotfleet.amazonaws.com/AWSServiceRoleForEC2SpotFleet*"
            ],
            condition: {
            	test: "StringLike",
            	variable: "iam:AWSServiceName",

            	values: ["spotfleet.amazonaws.com"]
           }
        },{
            effect: "Allow",
            actions: [
                "iam:AttachRolePolicy",
                "iam:PutRolePolicy"
            ],
            resources: [
            	"arn:aws:iam::*:role/aws-service-role/spotfleet.amazonaws.com/AWSServiceRoleForEC2SpotFleet*"
            ]
        }]
	}),
	'lambda-spot_interrupt_catcher.tf.json': lambda.lambda_function("spot_interrupt_catcher", {
		handler: "main.main",
		timeout: 10,
		memory_size: 512,

		environment: {
			variables: {
				region: "${var.region}",
				critical_events_sns_topic: "${aws_sns_topic.critical_events.id}",
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
				"ec2:DescribeInstances",
			],
			resources: ["*"]
		},{
			sid: "ddb",
			actions: [
				"dynamodb:UpdateItem"
			],
			resources: [
				"${aws_dynamodb_table.campaigns.arn}"
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
				regions: std.manifestJsonEx({
					[region]: "${aws_vpc.npk-%s.id}" % region
					for region in regionKeys
				}, ""),
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
				regions: std.manifestJsonEx({
					[region]: "${aws_vpc.npk-%s.id}" % region
					for region in regionKeys
				}, ""),
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
					version: "~> 4.66.0"
				},
				archive: {
					source: "hashicorp/archive",
					version: "~> 2.2.0"
				}
			}
		},
		provider: [{
			aws: {
				region: settings.primaryRegion
			}
		}, {
			archive: {}
		}] + [{
			aws: {
				alias: region,
				region: region
			}
		} for region in validatedSettings.providerRegions]
	},
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
					settings.apiEndpoint,
					settings.route53Zone,
					route53.alias(
						"${aws_api_gateway_domain_name.npk.cloudfront_domain_name}",
						"${aws_api_gateway_domain_name.npk.cloudfront_zone_id}"
					)
				)
			}
		}
	},
	[if settings.useCustomDNS then 'route53-auth.tf.json' else null]: {
		resource: {
			aws_route53_record: {
				saml: route53.record(
					settings.authEndpoint,
					settings.route53Zone,
					route53.alias(
						"${aws_cognito_user_pool_domain.saml.cloudfront_distribution_arn}",
						"Z2FDTNDATAQYW2"
					)
				)
			}
		}
	},
	's3.tf.json': {
		resource: {
			aws_s3_bucket: {
				user_data: s3.bucket("npk-user-data-"),
				static_site: s3.bucket("npk-site-content-"),
				logs: s3.bucket("npk-logs-")
			},
			aws_s3_bucket_acl: {
				logs: {
					bucket: "${aws_s3_bucket.logs.id}",
					acl: "log-delivery-write",

					depends_on: ["aws_s3_bucket_ownership_controls.logs"]
				}
			},
			aws_s3_bucket_lifecycle_configuration: {
				user_data: {
					bucket: "${aws_s3_bucket.user_data.id}",

					rule: {
						id: "1",
						status: "Enabled",
						expiration: {
							days: 7
						},
						abort_incomplete_multipart_upload: {
							days_after_initiation: 1
						}
					}
				}
			},
			aws_s3_bucket_ownership_controls: {
				logs: {
					bucket: "${aws_s3_bucket.logs.id}",

					rule: [{
						object_ownership: "BucketOwnerPreferred"
					}]
				}
			}
		},
		output: {
			s3_static_site_sync_command: {
				value: "aws s3 --region %s sync ${path.module}/../site-content/ s3://${aws_s3_bucket.static_site.id}" % [settings.primaryRegion]
			}
		}
	},
	's3_dictionary.tf.json': {
		resource: {
			aws_s3_bucket: {
				dictionary: {
					bucket_prefix: "npk-dictionary-" + settings.primaryRegion + "-",
					force_destroy: true,

					tags: {
						Project: "NPK"
					}
				}
			},
			aws_s3_bucket_cors_configuration: {
				dictionary: {
					bucket: "${aws_s3_bucket.dictionary.id}",

					cors_rule: {
					    allowed_headers: ["*"],
					    allowed_methods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
					    allowed_origins: ["*"],
					    expose_headers : ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length", "ETag"],
					    max_age_seconds: 3000
					},
				},
				user_data: {
					bucket: "${aws_s3_bucket.user_data.id}",

					cors_rule: {
					    allowed_headers: ["*"],
					    allowed_methods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
					    allowed_origins: [
							"http://localhost"
						] + if settings.useCustomDNS then
								[ "https://%s" % [settings.wwwEndpoint] ]
							else
								[ "https://${aws_cloudfront_distribution.npk.domain_name}" ],
					    expose_headers : ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length", "ETag"],
					    max_age_seconds: 3000
					},
				}
			},
			aws_s3_bucket_notification: {
				uploads: {
					bucket: "${aws_s3_bucket.dictionary.id}",

					lambda_function: {
						lambda_function_arn: "${aws_lambda_function.compression_pipe.arn}",
						events: ["s3:ObjectCreated:*"],
						filter_prefix: "to_process/"
					},

					depends_on: ["aws_lambda_permission.uploads"]
				}
			}
		},
		output: {
			wordlist_upload_cmd: {
				value: "aws s3 cp <file> s3://${aws_s3_bucket.dictionary.id}/to_process/<type>/"
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
					protocol: "email",
					endpoint: settings.adminEmail
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
	'sync_npkcomponents.tf.json': {
		resource: {
			null_resource: {
				sync_npkcomponents: {
				    triggers: {
				        content: "${timestamp()}"
				    },

				    provisioner: {
				    	"local-exec": {
				        	command: "aws s3 sync s3://npk-dictionary-west-2-20181029005812750900000002 s3://${aws_s3_bucket.dictionary.id} --request-payer requester --source-region us-west-2 --region " + settings.primaryRegion,
					    }
				    }
				}
			}
		},
		output: {
			aws_s3_sync_bucket_command: {
				value: "aws s3 sync s3://npk-dictionary-west-2-20181029005812750900000002 s3://${aws_s3_bucket.dictionary.id} --request-payer requester --source-region us-west-2 --region " + settings.primaryRegion
			}
		}
	},
	'templates.tf.json': {
		data: {
			template_file: {
				npk_config: {
					template: "${file(\"%s/templates/npk_config.tpl\")}" % sonnetry.path(),

					vars: {
						aws_region: "${var.region}",
						client_id: "${aws_cognito_user_pool_client.npk.id}",
						user_pool_id: "${aws_cognito_user_pool.npk.id}",
						identity_pool_id: "${aws_cognito_identity_pool.main.id}",
						userdata_bucket: "${aws_s3_bucket.user_data.id}",
						dictionary_bucket: "${aws_s3_bucket.dictionary.id}",
						primary_region: settings.primaryRegion,
						use_SAML: settings.useSAML,
						saml_domain: "",
						saml_redirect: "",
						familyRegions: std.strReplace(std.manifestJsonEx(settings.familyRegions, ""), "\n", ""),
						families: std.strReplace(std.manifestJsonEx(settings.families, ""), "\n", ""),
						quotas: std.strReplace(std.manifestJsonEx(settings.quotas, ""), "\n", ""),
						regions: std.strReplace(std.manifestJsonEx(settings.regions, ""), "\n", ""),
						api_gateway_url: if settings.useCustomDNS then
								settings.apiEndpoint
							else
								"${element(split(\"/\", aws_api_gateway_deployment.%s.invoke_url), 2)}" % apiName
					} + (if settings.useSAML && !settings.useCustomDNS then {
						saml_domain: "${aws_cognito_user_pool_domain.saml.domain}.auth." + settings.primaryRegion + ".amazoncognito.com",
						saml_redirect: "https://${aws_cloudfront_distribution.npk.domain_name}"
					} else {}) + (if settings.useSAML && settings.useCustomDNS then {
						saml_domain: settings.authEndpoint,
						saml_redirect: "https://" + settings.wwwEndpoint
					} else {})
				},
				userdata_template: {
					template: "${file(\"%s/templates/userdata.tpl\")}" % sonnetry.path(),

					vars: {
						dictionaryBucket: "${aws_s3_bucket.dictionary.id}",
						userdata: "${aws_s3_bucket.user_data.id}",
						userdataRegion: settings.primaryRegion
					}
				}
			}
		},
		resource: {
			local_file: {
				npk_config: {
					content: "${data.template_file.npk_config.rendered}",
					filename: "${path.module}/../site-content/angular/npk_config.js",
				},
				userdata_template: {
					content: "${data.template_file.userdata_template.rendered}",
					filename: "%s/lambda_functions/execute_campaign/userdata.sh" % sonnetry.path(),
				}
			}
		}
	},
	'templates-selfhost.tf.json': {
		data: {
			template_file: {
				upload_npkfile: {
					template: "${file(\"%s/templates/upload_npkfile.sh.tpl\")}" % sonnetry.path(),

					vars: {
						dictionaryBucket: "${aws_s3_bucket.dictionary.id}",
						dictionaryBucketRegion: settings.primaryRegion
					}
				},
				upload_npkcomponents: {
					template: "${file(\"%s/templates/upload_npkcomponents.sh.tpl\")}" % sonnetry.path(),

					vars: {
						dictionaryBucket: "${aws_s3_bucket.dictionary.id}",
						dictionaryBucketRegion: settings.primaryRegion,
						basepath: "${path.module}"
					}
				}
			}
		},
		resource: {
			local_file: {
				upload_npkfile: {
					content: "${data.template_file.upload_npkfile.rendered}",
					filename: "${path.module}/../tools/upload_npkfile.sh"
				},
				upload_npkcomponents: {
					content: "${data.template_file.upload_npkcomponents.rendered}",
					filename: "${path.module}/../tools/upload_npkcomponents.sh"
				}
			}
		}
	},
	'variables.tf.json': {
		variable: variables.variables(settings) + {
	    	region: { default: settings.primaryRegion },
	    	campaign_data_ttl: { default: settings.campaign_data_ttl },
	    	campaign_max_price: { default: settings.campaign_max_price },
	    	useSAML: { default: settings.useSAML }
		}
	}
} + {
	['vpc-%s.tf.json' % region]: vpc.public_vpc("npk", region, "172.21.16.0/20", settings.regions[region], ['s3'])
	for region in regionKeys
} + {
	['../lambda_functions/%s/accountDetails.json' % name]: accountDetails
	for name in ['compression_pipe', 'create_campaign', 'delete_campaign', 'execute_campaign', 'spot_monitor']
}