// name: The name of the IAM role
// policy_attachments: an object as { "name": <policy ARN> } to attach to the role
// inline_policies: an objects as { "name": <raw_policy_string or statement_array> } to attach inline.
// trust_policy: a raw trust policy string or 'statements' array.


local iam_role(name, description, policy_attachments, inline_policies, trust_policy) = std.prune({
	aws_iam_role: {
		[name]: {
			name: name,
			description: description,
			assume_role_policy: if std.isArray(trust_policy) then std.manifestJsonEx({
				Version: "2012-10-17",
				Statement: trust_policy
			}, " ") else trust_policy,
		}
	},
	aws_iam_role_policy_attachment: {
		[name + "-" + i]: {
			role: "${aws_iam_role." + name + ".id}",
			policy_arn: policy_attachments[i]
		}
		for i in std.objectFields(policy_attachments)
	},
	aws_iam_role_policy: {
		[name + "-" + i]: {
			name: i,
			role: "${aws_iam_role." + name + ".id}",
			policy: if std.isArray(inline_policies[i]) then std.manifestJsonEx({
				Version: "2012-10-17",
				Statement: inline_policies[i]
			}, " ") else inline_policies[i]
		}
		for i in std.objectFields(inline_policies)
	}
});

{
	iam_role: iam_role
}