local npksettings = import '../terraform/npk-settings.json';
local regions = import '../terraform/regions.json';

local settings = npksettings + {
	defaultRegion: "us-west-2",
	regions: regions
};

local defaultResource = {
	"tags": {
		"Project": "NPK"
	}
};

local regionKeys = std.objectFields(settings.regions);

{
	'backend.tf.json': {
		terraform: {
			backend: {
				s3: {
					bucket: settings.backend_bucket,
					key: "c6fc.io/npk/terraform-selfhost.tfstate",
					profile: settings.awsProfile,
					region: settings.defaultRegion
				}
			}
		}
	},
	'provider.tf.json': {
		provider: [{
			aws: {
				alias: region,
				profile: settings.awsProfile,
				region: region
			}
		} for region in regionKeys ]
	},
	's3.tf.json': {
		resource: {
			aws_s3_bucket: {
				[region]: {
					provider: "aws." + region,
					bucket_prefix: "npk-dictionary-" + region + "-",
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
				} for region in regionKeys
			}
		}
	},
	'sync_npkcomponents.tf.json': {
		resource: {
			null_resource: {
				sync_npkcomponents: {
				    triggers: {
				        content: "${local_file.sync_npkcomponents.content}"
				    },

				    provisioner: {
				    	"local-exec": {
				        	command: "${local_file.sync_npkcomponents.filename}",

					        environment: {
					            AWS_PROFILE: settings.awsProfile
					        }
					    }
				    },

				    depends_on: ["local_file.sync_npkcomponents"] + [
				    	"aws_s3_bucket." + region
				    	for region in regionKeys
				    ]
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
						de1: "${aws_s3_bucket.us-east-1.arn}",
						de2: "${aws_s3_bucket.us-east-2.arn}",
						dw1: "${aws_s3_bucket.us-west-1.arn}",
						dw2: "${aws_s3_bucket.us-west-2.arn}",

						de1i: "${aws_s3_bucket.us-east-1.id}",
						de2i: "${aws_s3_bucket.us-east-2.id}",
						dw1i: "${aws_s3_bucket.us-west-1.id}",
						dw2i: "${aws_s3_bucket.us-west-2.id}"
					}
				},
				dictionary_buckets: {
					template: "${file(\"${path.module}/templates/dictionary-buckets.js.tpl\")}",

					vars: {
						de1: "${aws_s3_bucket.us-east-1.id}",
						de2: "${aws_s3_bucket.us-east-2.id}",
						dw1: "${aws_s3_bucket.us-west-1.id}",
						dw2: "${aws_s3_bucket.us-west-2.id}"
					}
				},
				upload_npkfile: {
					template: "${file(\"${path.module}/templates/upload_npkfile.sh.tpl\")}",

					vars: {
						de1: "${aws_s3_bucket.us-east-1.id}",
						de2: "${aws_s3_bucket.us-east-2.id}",
						dw1: "${aws_s3_bucket.us-west-1.id}",
						dw2: "${aws_s3_bucket.us-west-2.id}"
					}
				},
				upload_npkcomponents: {
					template: "${file(\"${path.module}/templates/upload_npkcomponents.sh.tpl\")}",

					vars: {
						de1: "${aws_s3_bucket.us-east-1.id}",
						de2: "${aws_s3_bucket.us-east-2.id}",
						dw1: "${aws_s3_bucket.us-west-1.id}",
						dw2: "${aws_s3_bucket.us-west-2.id}",
						basepath: "${path.module}"
					}
				},
				sync_npkcomponents: {
					template: "${file(\"${path.module}/templates/sync_npkcomponents.sh.tpl\")}",

					vars: {
						de1: "${aws_s3_bucket.us-east-1.id}",
						de2: "${aws_s3_bucket.us-east-2.id}",
						dw1: "${aws_s3_bucket.us-west-1.id}",
						dw2: "${aws_s3_bucket.us-west-2.id}",
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
				dictionary_buckets: {
					content: "${data.template_file.dictionary_buckets.rendered}",
					filename: "${path.module}/../site-content/assets/js/dictionary-buckets.js"
				},
				upload_npkfile: {
					content: "${data.template_file.upload_npkfile.rendered}",
					filename: "${path.module}/upload_npkfile.sh"
				},
				upload_npkcomponents: {
					content: "${data.template_file.upload_npkcomponents.rendered}",
					filename: "${path.module}/upload_npkcomponents.sh"
				},
				sync_npkcomponents: {
					content: "${data.template_file.sync_npkcomponents.rendered}",
					filename: "${path.module}/sync_npkcomponents.sh"
				}

			}
		},
		output: {
			dictionaries_variables: {
				value: "${local_file.dictionaries_variables.filename}"
			},
			dictionary_buckets: {
				value: "${local_file.dictionary_buckets.filename}"
			},
			upload_npkcomponents: {
				value: "${local_file.upload_npkcomponents.filename}"
			}
		}
	},
	'upload_npkcomponents.tf.json': {
		data: {
			archive_file: {
				compute_node: {
				  type: "zip",
				  source_dir: "${path.module}/compute-node/",
				  output_path: "${path.module}/components/compute-node.zip",

				  depends_on: ["null_resource.npk_npm_install"]
				}
			}
		},

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