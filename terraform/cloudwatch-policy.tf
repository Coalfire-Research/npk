data "aws_iam_policy_document" "cloudwatch_invoke_spot_monitor" {

	statement {
		sid = "1"

		actions = [
			"lambda:InvokeFunction"
		]

		resources = [
			"${aws_lambda_function.spot_monitor.arn}"
		]
	}
}