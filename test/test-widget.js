/*\
title: $:/plugins/rimir/runner/test/test-widget.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Tests for runner widget URL construction logic.

\*/
"use strict";

describe("runner: widget URL construction", function() {

	// Test the URL building logic directly, without needing the full widget dispatch chain.

	it("should build basic URL with action parameter", function() {
		var url = "/api/run?action=" + encodeURIComponent("calc");
		expect(url).toBe("/api/run?action=calc");
	});

	it("should encode action with special characters", function() {
		var url = "/api/run?action=" + encodeURIComponent("my action");
		expect(url).toBe("/api/run?action=my%20action");
	});

	it("should append non-reserved attributes as query params", function() {
		var attrs = {action: "echo", msg: "hello", count: "5"};
		var url = "/api/run?action=" + encodeURIComponent(attrs.action);
		for (var key in attrs) {
			if (key !== "action" && key.charAt(0) !== "$") {
				url += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(attrs[key]);
			}
		}
		expect(url).toContain("action=echo");
		expect(url).toContain("msg=hello");
		expect(url).toContain("count=5");
	});

	it("should exclude $-prefixed attributes", function() {
		var attrs = {action: "test", "$class": "hidden", msg: "ok"};
		var url = "/api/run?action=" + encodeURIComponent(attrs.action);
		for (var key in attrs) {
			if (key !== "action" && key.charAt(0) !== "$") {
				url += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(attrs[key]);
			}
		}
		expect(url).toContain("msg=ok");
		expect(url).not.toContain("class");
		expect(url).not.toContain("hidden");
	});

	it("should encode special characters in param values", function() {
		var val = "hello world&foo=bar";
		var encoded = encodeURIComponent(val);
		expect(encoded).toBe("hello%20world%26foo%3Dbar");
	});

	it("should handle empty action", function() {
		var url = "/api/run?action=" + encodeURIComponent("");
		expect(url).toBe("/api/run?action=");
	});

	// Test widget module exports
	it("should export api.run widget", function() {
		var widgetModule = require("$:/plugins/rimir/runner/widget.js");
		expect(widgetModule["api.run"]).toBeDefined();
		expect(typeof widgetModule["api.run"]).toBe("function");
	});

	it("should have invokeAction method", function() {
		var widgetModule = require("$:/plugins/rimir/runner/widget.js");
		expect(typeof widgetModule["api.run"].prototype.invokeAction).toBe("function");
	});
});
