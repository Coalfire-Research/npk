/* Static Site Bucket Policy */

data "aws_iam_policy_document" "s3_static_site" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.static_site.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = ["${aws_cloudfront_origin_access_identity.npk.iam_arn}"]
    }
  }
}

resource "aws_s3_bucket_policy" "s3_static_site" {
  bucket = "${aws_s3_bucket.static_site.id}"
  policy = "${data.aws_iam_policy_document.s3_static_site.json}"
}