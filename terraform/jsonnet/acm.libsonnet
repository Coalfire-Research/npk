{
	certificate(name, dns_name, san, zone): {
		aws_acm_certificate: {
			[name]: {
				provider: "aws.us-east-1",
				domain_name: dns_name,
				subject_alternative_names: san,
				validation_method: "DNS",

				lifecycle: {
					create_before_destroy: true
				}
			}
		},
		aws_route53_record: {
			[name + "-acm"]: {
				name: "${tolist(aws_acm_certificate." + name + ".domain_validation_options)[0].resource_record_name}",
				type: "${tolist(aws_acm_certificate." + name + ".domain_validation_options)[0].resource_record_type}",
				records: ["${tolist(aws_acm_certificate." + name + ".domain_validation_options)[0].resource_record_value}"],
				zone_id: zone,
				ttl: 60
			}
		},
		aws_acm_certificate_validation: {
			[name]: {
				provider: "aws.us-east-1" ,
				certificate_arn: "${aws_acm_certificate." + name + ".arn}",
				validation_record_fqdns: ["${aws_route53_record." + name + "-acm.fqdn}"]
			}
		}
	}
}