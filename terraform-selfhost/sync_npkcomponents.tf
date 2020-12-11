resource "null_resource" "sync_npkcomponents" {
    triggers {
        content = "${local_file.sync_npkcomponents.content}"
    }

    provisioner "local-exec" {
        command = "${local_file.sync_npkcomponents.filename}"

        environment {
            AWS_PROFILE = "${var.aws_profile}"
        }
    }

    depends_on = [
        "aws_s3_bucket.dictionary-east-1",
        "aws_s3_bucket.dictionary-east-2",
        "aws_s3_bucket.dictionary-west-1",
        "aws_s3_bucket.dictionary-west-2",
        "local_file.sync_npkcomponents"
    ]
}