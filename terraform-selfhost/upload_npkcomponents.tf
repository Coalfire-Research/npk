resource "null_resource" "npk_component" {
    triggers {
        content = "${local_file.upload_npkcomponents.content}"
        compute = "${data.archive_file.compute-node.output_sha}"
    }

    provisioner "local-exec" {
        command = "${local_file.upload_npkcomponents.filename}"

        environment {
            AWS_ACCESS_KEY_ID       = "${var.access_key}"
            AWS_SECRET_ACCESS_KEY   = "${var.secret_key}"
        }
    }

    depends_on = ["data.archive_file.compute-node"]
}

data "archive_file" "compute-node" {
  type        = "zip"
  source_dir  = "${path.module}/compute-node/"
  output_path = "${path.module}/components/compute-node.zip"
}