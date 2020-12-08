variable "hashcat" {}

# dictionaries.auto.tfvars
data "template_file" "dictionaries_variables" {
	template = "${file("${path.module}/templates/dictionaries.auto.tfvars.tpl")}"

	vars {
		de1 = "${aws_s3_bucket.dictionary-east-1.arn}"
		de2 = "${aws_s3_bucket.dictionary-east-2.arn}"
		dw1 = "${aws_s3_bucket.dictionary-west-1.arn}"
		dw2 = "${aws_s3_bucket.dictionary-west-2.arn}"

		de1i = "${aws_s3_bucket.dictionary-east-1.id}"
		de2i = "${aws_s3_bucket.dictionary-east-2.id}"
		dw1i = "${aws_s3_bucket.dictionary-west-1.id}"
		dw2i = "${aws_s3_bucket.dictionary-west-2.id}"
	}
}

resource "local_file" "dictionaries_variables" {
	content = "${data.template_file.dictionaries_variables.rendered}"
	filename = "${path.module}/../terraform/dictionaries.auto.tfvars"
}

output "dictionaries_variables" {
	value = "${local_file.dictionaries_variables.filename}"
}

# dictionary-buckets.js
data "template_file" "dictionary-buckets" {
	template = "${file("${path.module}/templates/dictionary-buckets.js.tpl")}"

	vars {
		de1 = "${aws_s3_bucket.dictionary-east-1.id}"
		de2 = "${aws_s3_bucket.dictionary-east-2.id}"
		dw1 = "${aws_s3_bucket.dictionary-west-1.id}"
		dw2 = "${aws_s3_bucket.dictionary-west-2.id}"
	}
}

resource "local_file" "dictionary-buckets" {
	content = "${data.template_file.dictionary-buckets.rendered}"
	filename = "${path.module}/../site-content/assets/js/dictionary-buckets.js"
}

output "dictionary-buckets" {
	value = "${local_file.dictionary-buckets.filename}"
}

# upload_npkfile.sh
data "template_file" "upload_npkfile" {
	template = "${file("${path.module}/templates/upload_npkfile.sh.tpl")}"

	vars {
		de1 = "${aws_s3_bucket.dictionary-east-1.id}"
		de2 = "${aws_s3_bucket.dictionary-east-2.id}"
		dw1 = "${aws_s3_bucket.dictionary-west-1.id}"
		dw2 = "${aws_s3_bucket.dictionary-west-2.id}"
	}
}

resource "local_file" "upload_npkfile" {
	content = "${data.template_file.upload_npkfile.rendered}"
	filename = "${path.module}/upload_npkfile.sh"
}

output "upload_npkfile" {
	value = "${local_file.upload_npkfile.filename}"
}

# upload_npkcomponents.sh
data "template_file" "upload_npkcomponents" {
	template = "${file("${path.module}/templates/upload_npkcomponents.sh.tpl")}"

	vars {
		de1 		= "${aws_s3_bucket.dictionary-east-1.id}"
		de2 		= "${aws_s3_bucket.dictionary-east-2.id}"
		dw1 		= "${aws_s3_bucket.dictionary-west-1.id}"
		dw2 		= "${aws_s3_bucket.dictionary-west-2.id}"
		hashcat 	= "${var.hashcat}"
		basepath 	= "${path.module}"
	}
}

# sync_npkcomponents.sh
data "template_file" "sync_npkcomponents" {
	template = "${file("${path.module}/templates/sync_npkcomponents.sh.tpl")}"

	vars {
		de1 		= "${aws_s3_bucket.dictionary-east-1.id}"
		de2 		= "${aws_s3_bucket.dictionary-east-2.id}"
		dw1 		= "${aws_s3_bucket.dictionary-west-1.id}"
		dw2 		= "${aws_s3_bucket.dictionary-west-2.id}"
		basepath 	= "${path.module}"
	}
}

resource "local_file" "upload_npkcomponents" {
	content = "${data.template_file.upload_npkcomponents.rendered}"
	filename = "${path.module}/upload_npkcomponents.sh"
}

resource "local_file" "sync_npkcomponents" {
	content = "${data.template_file.sync_npkcomponents.rendered}"
	filename = "${path.module}/sync_npkcomponents.sh"
}

output "upload_npkcomponents" {
	value = "${local_file.upload_npkcomponents.filename}"
}