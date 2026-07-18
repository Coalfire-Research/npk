local cors_rule(origin) = {
	"allowed_headers": ["*"],
	"allowed_methods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
	"allowed_origins": [origin],
	"expose_headers": ["x-amz-meta-lines", "x-amz-meta-size", "x-amz-meta-type", "content-length", "ETag"],
	"max_age_seconds": 3000
};

local bucket(name, cors=null) =
	if std.type(cors) == "null" then
		{ "bucket_prefix": name, "force_destroy": true}
	else
		{ "bucket_prefix": name, "force_destroy": true, "cors_rule": cors };

{
	"cors_rule": cors_rule,
	"bucket": bucket
}