local npksettings = import '../terraform/npk-settings.json';
local regions = import '../terraform/regions.json';

local settings = npksettings + {
	primaryRegion: "us-west-2",
	regions: regions
};

local regionKeys = std.objectFields(settings.regions);

{
	'backend.tf.json': {
		terraform: {
			backend: {
				s3: {
					bucket: settings.backend_bucket,
					key: "c6fc.io/npkv3/terraform-selfhost.tfstate",
					profile: settings.awsProfile,
					region: settings.primaryRegion
				}
			}
		}
	},
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
		}] + [{
			aws: {
				alias: region,
				profile: settings.awsProfile,
				region: region
			}
		} for region in regionKeys]
	},
	's3.tf.json': {
		resource: {
			aws_s3_bucket: {
				[settings.primaryRegion]: {
					provider: "aws." + settings.primaryRegion,
					bucket_prefix: "npk-dictionary-" + settings.primaryRegion + "-",
					acl: "private",
					force_destroy: true,

					cors_rule: {
					    allowed_headers: ["*"],
					    allowed_methods: ["GET", "HEAD"],
					    allowed_origins: ["*"],
					    expose_headers : ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length"],
					    max_age_seconds: 3000
					},

					tags: {
						Project: "NPK"
					}
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
				        	command: "aws s3 sync s3://npk-dictionary-west-2-20181029005812750900000002 s3://${aws_s3_bucket." + settings.primaryRegion + ".id} --source-region us-west-2 --region " + settings.primaryRegion,

					        environment: {
					            AWS_PROFILE: settings.awsProfile
					        }
					    }
				    }
				}
			}
		}
	},
	'templates.tf.json': {
		data: {
			template_file: {
				dictionaries_variables: {
					template: "${file(\"${path.module}/templates/dictionaries.auto.tfvars.tpl\")}",

					vars: {
						dictionaryBucket: "${aws_s3_bucket.%s.id}" % settings.primaryRegion,
						dictionaryBucketRegion: settings.primaryRegion
					}
				},
				upload_npkfile: {
					template: "${file(\"${path.module}/templates/upload_npkfile.sh.tpl\")}",

					vars: {
						dictionaryBucket: "${aws_s3_bucket.%s.id}" % settings.primaryRegion,
						dictionaryBucketRegion: settings.primaryRegion
					}
				},
				upload_npkcomponents: {
					template: "${file(\"${path.module}/templates/upload_npkcomponents.sh.tpl\")}",

					vars: {
						dictionaryBucket: "${aws_s3_bucket.%s.id}" % settings.primaryRegion,
						dictionaryBucketRegion: settings.primaryRegion,
						basepath: "${path.module}"
					}
				}
			}
		},
		resource: {
			local_file: {
				dictionaries_variables: {
					content: "${data.template_file.dictionaries_variables.rendered}",
					filename: "${path.module}/../terraform/dictionaries.auto.tfvars"
				},
				upload_npkfile: {
					content: "${data.template_file.upload_npkfile.rendered}",
					filename: "${path.module}/upload_npkfile.sh"
				},
				upload_npkcomponents: {
					content: "${data.template_file.upload_npkcomponents.rendered}",
					filename: "${path.module}/upload_npkcomponents.sh"
				}
			}
		}
	},
	'upload_npkcomponents.tf.json': {

		resource: {
			null_resource: {
				npk_npm_install: {
				    triggers: {
				        content: "${local_file.upload_npkcomponents.content}"
				    },

				    provisioner: [{
				    	"local-exec": {
				        	command: "cd ${path.module}/compute-node/ && npm install"
				        }
				    }]
				}
			}
		}
	}

}