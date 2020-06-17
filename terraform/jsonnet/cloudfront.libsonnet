
{
	resource(settings): {
		"aws_cloudfront_origin_access_identity": {
			"npk": {
				"comment": "OAI for NPK",
			},
		},
		"aws_cloudfront_distribution": {
			"npk": {
				"comment": "NPK",
				"enabled": true,
				"is_ipv6_enabled": false,
				"default_root_object": "index.html",
				"logging_config": {
					"include_cookies": false,
					"bucket": "${aws_s3_bucket.logs.bucket_domain_name}",
					"prefix": "cloudfront",
				},
				"origin": {
					"domain_name": "${aws_s3_bucket.static_site.bucket_regional_domain_name}",
					"origin_id": "static",

					"s3_origin_config": {
						"origin_access_identity": "${aws_cloudfront_origin_access_identity.npk.cloudfront_access_identity_path}",
					}
				},
				"default_cache_behavior": {
					"allowed_methods": ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
					"cached_methods": ["GET", "HEAD"],
					"target_origin_id": "static",
					"forwarded_values": {
						"query_string": false,
						"headers": ["Origin","Access-Control-Allow-Origin","Access-Control-Request-Method","Access-Control-Request-Headers"],
						"cookies": {
							"forward": "none",
						}
					},
					"viewer_protocol_policy": "redirect-to-https",
					"min_ttl": 0,
					"max_ttl": 300,
					"default_ttl": 0,
				},
				"price_class": "PriceClass_100",
				"tags": {
					"Project": "NPK",
				},
				"viewer_certificate": {
					"cloudfront_default_certificate": true,
				}
			} + if std.objectHas(settings, "georestrictions") && std.length(settings.georestrictions) > 0 then {
				"restrictions": {
					"geo_restriction": {
						"restriction_type": "whitelist",
						"locations"       : settings.georestrictions,
					}
				}
			} else {
				"restrictions": {
					"geo_restriction": {
						"restriction_type": "none",
					}
				}
			} + if settings.useCustomDNS then {
				"aliases": [i for i in settings.dnsNames.www],
				"viewer_certificate": {
					"cloudfront_default_certificate": false,
					"acm_certificate_arn": "${aws_acm_certificate.www-0.arn}",
					"ssl_support_method": "sni-only",
				}
			} else { }
		}
	},
	"output": {
		"cloudfront_url": {
			"value": "${aws_cloudfront_distribution.npk.domain_name}"
		}
	}
}
