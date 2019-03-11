/**
 * AWS Signature v4 Implementation for Web Browsers
 *
 * Copyright (c) 2016-2018 Daniel Joos
 *
 * Distributed under MIT license. (See file LICENSE)
 */

;(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        /* global define */
        define(['crypto-js/core', 'crypto-js/sha256', 'crypto-js/hmac-sha256'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('crypto-js/core'),
                                 require('crypto-js/sha256'),
                                 require('crypto-js/hmac-sha256'));
    } else {
        /* global CryptoJS */
        root.awsSignWeb = factory(CryptoJS, CryptoJS.SHA256, CryptoJS.HmacSHA256);
    }
}(this, function (CryptoJS) {
    'use strict';

    var defaultConfig = {
        region: 'eu-west-1',
        service: 'execute-api',
        defaultContentType: 'application/json',
        defaultAcceptType: 'application/json',
        payloadSerializerFactory: JsonPayloadSerializer,
        uriParserFactory: SimpleUriParser,
        hasherFactory: CryptoJSHasher
    };

    /**
     * Create a new signer object with the given configuration.
     * Configuration must specify the AWS credentials used for the signing operation.
     * It must contain the following properties:
     * `accessKeyId`: The AWS IAM access key ID.
     * `secretAccessKey`: The AWS IAM secret key.
     * `sessionToken`: Optional session token, required for temporary credentials.
     * @param {object} config The configuration object.
     * @constructor
     */
    var AwsSigner = function (config) {
        this.config = extend({}, defaultConfig, config);
        this.payloadSerializer = this.config.payloadSerializer ||
            this.config.payloadSerializerFactory();
        this.uriParser = this.config.uriParserFactory();
        this.hasher = this.config.hasherFactory();
        assertRequired(this.config.accessKeyId, 'AwsSigner requires AWS AccessKeyID');
        assertRequired(this.config.secretAccessKey, 'AwsSigner requires AWS SecretAccessKey');
    };

    /**
     * Create signature headers for the given request.
     * Request must be in the format, known from the `$http` service of Angular:
     * ```
     * request = {
     *      headers: { ... },
     *      method: 'GET',
     *      url: 'http://...',
     *      params: { ... },
     *      data: ...           // alternative: body
     * };
     * ```
     * The resulting object contains the signature headers. For example, it can be merged into an
     * existing `$http` config when dealing with Angular JS.
     * @param {object} request The request to create the signature for. Will not be modified!
     * @param {Date=} signDate Optional signature date to use. Current date-time is used if not specified.
     * @returns Signed request headers.
     */
    AwsSigner.prototype.sign = function (request, signDate) {
        var workingSet = {
            request: extend({}, request),
            signDate: signDate || new Date(),
            uri: this.uriParser(request.url)
        };
        prepare(this, workingSet);
        buildCanonicalRequest(this, workingSet);    // Step1: build the canonical request
        buildStringToSign(this, workingSet);        // Step2: build the string to sign
        calculateSignature(this, workingSet);       // Step3: calculate the signature hash
        buildSignatureHeader(this, workingSet);     // Step4: build the authorization header
        return {
            'Accept': workingSet.request.headers['accept'],
            'Authorization': workingSet.authorization,
            'Content-Type': workingSet.request.headers['content-type'],
            'x-amz-date': workingSet.request.headers['x-amz-date'],
            'x-amz-security-token': this.config.sessionToken || undefined
        };
    };

    // Some preparations
    function prepare(self, ws) {
        var headers = {
            'host': ws.uri.host,
            'content-type': self.config.defaultContentType,
            'accept': self.config.defaultAcceptType,
            'x-amz-date': amzDate(ws.signDate)
        };
        // Remove accept/content-type headers if no default was configured.
        if (!self.config.defaultAcceptType) {
            delete headers['accept'];
        }
        if (!self.config.defaultContentType) {
            delete headers['content-type'];
        }
        // Payload or not?
        ws.request.method = ws.request.method.toUpperCase();
        if (ws.request.body) {
            ws.payload = ws.request.body;
        } else if (ws.request.data && self.payloadSerializer) {
            ws.payload = self.payloadSerializer(ws.request.data);
        } else {
            delete headers['content-type'];
        }
        // Headers
        ws.request.headers = extend(
            headers,
            Object.keys(ws.request.headers || {}).reduce(function (normalized, key) {
                normalized[key.toLowerCase()] = ws.request.headers[key];
                return normalized;
            }, {})
        );
        ws.sortedHeaderKeys = Object.keys(ws.request.headers).sort();
        // Remove content-type parameters as some browser might change them on send
        if (ws.request.headers['content-type']) {
            ws.request.headers['content-type'] = ws.request.headers['content-type'].split(';')[0];
        }
        // Merge params to query params
        if (typeof(ws.request.params) === 'object') {
            extend(ws.uri.queryParams, ws.request.params);
        }
    }

    // Convert the request to a canonical format.
    function buildCanonicalRequest(self, ws) {
        ws.signedHeaders = ws.sortedHeaderKeys.map(function (key) {
            return key.toLowerCase();
        }).join(';');
        ws.canonicalRequest = String(ws.request.method).toUpperCase() + '\n' +
                // Canonical URI:
            ws.uri.path.split('/').map(function(seg) {
                return uriEncode(seg);
            }).join('/') + '\n' +
                // Canonical Query String:
            Object.keys(ws.uri.queryParams).sort().map(function (key) {
                return uriEncode(key) + '=' +
                    uriEncode(ws.uri.queryParams[key]);
            }).join('&') + '\n' +
                // Canonical Headers:
            ws.sortedHeaderKeys.map(function (key) {
                return key.toLocaleLowerCase() + ':' + ws.request.headers[key];
            }).join('\n') + '\n\n' +
                // Signed Headers:
            ws.signedHeaders + '\n' +
                // Hashed Payload
            self.hasher.hash((ws.payload) ? ws.payload : '');
    }

    // Construct the string that will be signed.
    function buildStringToSign(self, ws) {
        ws.credentialScope = [amzDate(ws.signDate, true), self.config.region, self.config.service,
            'aws4_request'].join('/');
        ws.stringToSign = 'AWS4-HMAC-SHA256' + '\n' +
            amzDate(ws.signDate) + '\n' +
            ws.credentialScope + '\n' +
            self.hasher.hash(ws.canonicalRequest);
    }

    // Calculate the signature
    function calculateSignature(self, ws) {
        var hmac = self.hasher.hmac;
        var signKey = hmac(
            hmac(
                hmac(
                    hmac(
                        'AWS4' + self.config.secretAccessKey,
                        amzDate(ws.signDate, true),
                        {hexOutput: false}
                    ),
                    self.config.region,
                    {hexOutput: false, textInput: false}
                ),
                self.config.service,
                {hexOutput: false, textInput: false}
            ),
            'aws4_request',
            {hexOutput: false, textInput: false}
        );
        ws.signature = hmac(signKey, ws.stringToSign, {textInput: false});
    }

    // Build the signature HTTP header using the data in the working set.
    function buildSignatureHeader(self, ws) {
        ws.authorization = 'AWS4-HMAC-SHA256 ' +
            'Credential=' + self.config.accessKeyId + '/' + ws.credentialScope + ', ' +
            'SignedHeaders=' + ws.signedHeaders + ', ' +
            'Signature=' + ws.signature;
    }

    // Format the given `Date` as AWS compliant date string.
    // Time part gets omitted if second argument is set to `true`.
    function amzDate(date, short) {
        var result = date.toISOString().replace(/[:\-]|\.\d{3}/g, '').substr(0, 17);
        if (short) {
            return result.substr(0, 8);
        }
        return result;
    }

    /**
     * Payload serializer factory implementation that converts the data to a JSON string.
     */
    function JsonPayloadSerializer() {
        return function(data) {
            return JSON.stringify(data);
        };
    }

    /**
     * Simple URI parser factory.
     * Uses an `a` document element for parsing given URIs.
     * Therefore it most likely will only work in a web browser.
     */
    function SimpleUriParser() {
        var parser = document ? document.createElement('a') : {};

        /**
         * Parse the given URI.
         * @param {string} uri The URI to parse.
         * @returns JavaScript object with the parse results:
         * `protocol`: The URI protocol part.
         * `host`: Host part of the URI.
         * `path`: Path part of the URI, always starting with a `/`
         * `queryParams`: Query parameters as JavaScript object.
         */
        return function (uri) {
            parser.href = uri;
            return {
                protocol: parser.protocol,
                host: parser.host.replace(/^(.*):((80)|(443))$/, '$1'),
                path: ((parser.pathname.charAt(0) !== '/') ? '/' : '') +
                    decodeURI(parser.pathname),
                queryParams: extractQueryParams(parser.search)
            };
        };

        function extractQueryParams(search) {
            return /^\??(.*)$/.exec(search)[1].split('&').reduce(function (result, arg) {
                arg = /^(.+)=(.*)$/.exec(arg);
                if (arg) {
                    result[decodeURI(arg[1])] = decodeURI(arg[2]);
                }
                return result;
            }, {});
        }
    }

    /**
     * URI encode according to S3 requirements.
     * See: http://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
     * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
     */
    function uriEncode(input) {
        return encodeURIComponent(input).replace(/[!'()*]/g, function(c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        });
    }

    /**
     * Hash factory implementation using the SHA-256 hash algorithm of CryptoJS.
     * Requires at least the CryptoJS rollups: `sha256.js` and `hmac-sha256.js`.
     */
    function CryptoJSHasher() {
        return {
            /**
             * Hash the given input using SHA-256 algorithm.
             * The options can be used to control the in-/output of the hash operation.
             * @param {*} input Input data.
             * @param {object} options Options object:
             * `hexOutput` -- Output the hash with hex encoding (default: `true`).
             * `textInput` -- Interpret the input data as text (default: `true`).
             * @returns The generated hash
             */
            hash: function (input, options) {
                options = extend({hexOutput: true, textInput: true}, options);
                var hash = CryptoJS.SHA256(input);
                if (options.hexOutput) {
                    return hash.toString(CryptoJS.enc.Hex);
                }
                return hash;
            },

            /**
             * Create the HMAC of the given input data with the given key using the SHA-256
             * hash algorithm.
             * The options can be used to control the in-/output of the hash operation.
             * @param {string} key Secret key.
             * @param {*} input Input data.
             * @param {object} options Options object:
             * `hexOutput` -- Output the hash with hex encoding (default: `true`).
             * `textInput` -- Interpret the input data as text (default: `true`).
             * @returns The generated HMAC.
             */
            hmac: function (key, input, options) {
                options = extend({hexOutput: true, textInput: true}, options);
                var hmac = CryptoJS.HmacSHA256(input, key, {asBytes: true});
                if (options.hexOutput) {
                    return hmac.toString(CryptoJS.enc.Hex);
                }
                return hmac;
            }
        };
    }

    // Simple version of the `extend` function, known from Angular and Backbone.
    // It merges the second (and all succeeding) argument(s) into the object, given as first
    // argument. This is done recursively for all child objects, as well.
    function extend(dest) {
        var objs = [].slice.call(arguments, 1);
        objs.forEach(function (obj) {
            if (!obj || typeof(obj) !== 'object') {
                return;
            }
            Object.keys(obj).forEach(function (key) {
                var src = obj[key];
                if (typeof(src) === 'undefined') {
                    return;
                }
                if (src !== null && typeof(src) === 'object') {
                    dest[key] = (Array.isArray(src) ? [] : {});
                    extend(dest[key], src);
                } else {
                    dest[key] = src;
                }
            });
        });
        return dest;
    }

    // Throw an error if the given object is undefined.
    function assertRequired(obj, msg) {
        if (typeof(obj) === 'undefined' || !obj) {
            throw new Error(msg);
        }
    }

    return {
        AwsSigner: AwsSigner
    };
}));
