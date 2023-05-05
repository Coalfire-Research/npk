local join_objects(objs) = 
    local aux(arr, i, running) =
        if i >= std.length(arr) then
            running
        else
            aux(arr, i + 1, std.mergePatch(running, arr[i])) tailstrict;
    aux(objs, 0, {});

local rest_api_map(api, pathParts) = {
	foo(api, parent, path, object):: 
	local thispath = std.strReplace(std.strReplace(std.strReplace("%s-%s" % [path, object.pathPart], "}", ""), "{", ""), "+", "");
	std.mergePatch({

		aws_api_gateway_resource: {
			[thispath]: {
				rest_api_id: "${aws_api_gateway_rest_api.%s.id}" % [api],
				parent_id: parent,
				path_part: object.pathPart
			}
		},
		aws_api_gateway_method: {
			[std.asciiLower("%s_%s" % [thispath, method])]: {
				rest_api_id: "${aws_api_gateway_rest_api.%s.id}" % [api],
				resource_id: "${aws_api_gateway_resource.%s.id}" % [thispath],
				http_method: method
			} + object.methods[method].parameters
			for method in std.objectFields(object.methods)
		},
		aws_api_gateway_integration: {
			[std.asciiLower("%s_%s" % [thispath, method])]: {
				rest_api_id: "${aws_api_gateway_rest_api.%s.id}" % [api],
				resource_id: "${aws_api_gateway_resource.%s.id}" % [thispath],
				http_method: "${aws_api_gateway_method.%s.http_method}" % [std.asciiLower("%s_%s" % [thispath, method])]
			} + 
			if (std.objectHas(object.methods[method], "lambdaIntegration")) then {
				integration_http_method: "POST",
				type: "AWS_PROXY",
				uri: "arn:aws:apigateway:${var.region}:lambda:path/2015-03-31/functions/${aws_lambda_function.%s.arn}/invocations" % [object.methods[method].lambdaIntegration]
			} else {} +
			if (std.objectHas(object.methods[method], "optionsIntegration")) then {
				type: "MOCK",
			    request_templates: {
			    	"application/json": "{\"statusCode\": 200}",
			    }
			} else {}
			for method in std.objectFields(object.methods)
		},
		aws_api_gateway_method_response: std.prune({
			[std.asciiLower("%s_%s" % [thispath, method])]: if (std.objectHas(object.methods[method], "optionsIntegration")) then {
				rest_api_id: "${aws_api_gateway_rest_api.%s.id}" % [api],
				resource_id: "${aws_api_gateway_resource.%s.id}" % [thispath],
				http_method: method,
				status_code: 200,
				response_models: {
					"application/json": "Empty"
				},
				response_parameters: {
			        "method.response.header.Access-Control-Allow-Headers": true,
			        "method.response.header.Access-Control-Allow-Methods": true,
			        "method.response.header.Access-Control-Allow-Origin": true
			    },
			    depends_on: ["aws_api_gateway_method.%s" % [std.asciiLower("%s_%s" % [thispath, method])]]
			} else null
			for method in std.objectFields(object.methods)
		}),
		aws_api_gateway_integration_response: std.prune({
			[std.asciiLower("%s_%s" % [thispath, method])]: if (std.objectHas(object.methods[method], "optionsIntegration")) then {
				rest_api_id: "${aws_api_gateway_rest_api.%s.id}" % [api],
				resource_id: "${aws_api_gateway_resource.%s.id}" % [thispath],
				http_method: "${aws_api_gateway_method_response.%s.http_method}" % [std.asciiLower("%s_%s" % [thispath, method])],
				status_code: 200,
				response_parameters: {
			        "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
			        "method.response.header.Access-Control-Allow-Methods": "'GET,OPTIONS,POST,PUT,DELETE'",
			        "method.response.header.Access-Control-Allow-Origin": "'*'"
			    },

			    depends_on: ["aws_api_gateway_integration.%s" % [std.asciiLower("%s_%s" % [thispath, method])]]
			} else null
			for method in std.objectFields(object.methods)
		}),
		aws_lambda_permission: std.prune({
			[std.asciiLower("%s_%s" % [thispath, method])]: if (std.objectHas(object.methods[method], "lambdaIntegration")) then {
				statement_id: "AllowExecutionFromAPIGateway-%s" % [thispath],
				action: "lambda:InvokeFunction",
				function_name: "${aws_lambda_function.%s.arn}" % [object.methods[method].lambdaIntegration],
				principal: "apigateway.amazonaws.com",
				source_arn: "arn:aws:execute-api:${var.region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.%s.id}/*" % [api]
			} else null
			for method in std.objectFields(object.methods)
		})
	}, if (std.objectHas(object, 'children')) then 
		join_objects([self.foo(api, "${" + std.strReplace(std.strReplace(std.strReplace("aws_api_gateway_resource.%s-%s.id" % [path, object.pathPart], "}", ""), "{", ""), "+", "") + "}", thispath, item) for item in object.children])
	else { }),

	resource: join_objects([self.foo(api, "${aws_api_gateway_rest_api.%s.root_resource_id}" % [api], "root", item) for item in pathParts.root.children]),
};

local rest_api(name, map) = 
	local api_map = rest_api_map(name, map) tailstrict;
	std.mergePatch({
		resource: {
			aws_api_gateway_rest_api: {
				[name]: {
					name: name,
				} + map.parameters
			},
			aws_api_gateway_deployment: {
				[name]: map.deployment + {
					rest_api_id: "${aws_api_gateway_rest_api.%s.id}" % [name],
					depends_on: ["aws_api_gateway_integration.%s" % [integration] for integration in std.objectFields(api_map.resource.aws_api_gateway_integration)],
				}
			}
		}
	}, api_map);

{
	rest_api: rest_api
}