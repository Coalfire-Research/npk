/*resource "null_resource" "upload_npkcomponents" {
    triggers {
        content = "${local_file.upload_npkcomponents.content}"
    }

    provisioner "local-exec" {
        command = "${local_file.upload_npkcomponents.filename}"

        environment {
            AWS_PROFILE = "${var.aws_profile}"
        }
    }

    depends_on = [
        "data.archive_file.compute-node",
        "null_resource.upload_npkcomponents"
    ]
}*/

data "archive_file" "compute-node" {
  type        = "zip"
  source_dir  = "${path.module}/compute-node/"
  output_path = "${path.module}/components/compute-node.zip"

  depends_on = ["null_resource.npk_npm_install"]
}

resource "null_resource" "npk_npm_install" {
    triggers {
        content = "${local_file.upload_npkcomponents.content}"
    }

    provisioner "local-exec" {
        command = "cd ${path.module}/compute-node/ && npm install"
    }
}