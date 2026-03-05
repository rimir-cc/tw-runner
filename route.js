/*\
title: $:/plugins/rimir/runner/route.js
type: application/javascript
module-type: route

HTTP route that executes whitelisted commands on the host machine.
GET /run?action=<action_name>

\*/

"use strict";

var child_process = require("child_process");
var fs = require("fs");
var path = require("path");

// Read whitelist from filesystem config at boot — not editable from browser
var configPath = path.resolve($tw.boot.wikiPath, "runner-actions.json");
var actions = JSON.parse(fs.readFileSync(configPath, "utf8"));

exports.method = "GET";
exports.path = /^\/api\/run$/;

exports.handler = function(request, response, state) {
	var action = state.queryParameters.action;
	if(!action) {
		sendJson(response, 400, {error: "Missing 'action' query parameter"});
		return;
	}
	var entry = actions[action];
	if(!entry || !entry.command) {
		sendJson(response, 403, {error: "Unknown action: " + action});
		return;
	}
	// Substitute whitelisted parameters into command template
	var command = entry.command;
	var allowedParams = entry.params || [];
	for(var i = 0; i < allowedParams.length; i++) {
		var paramName = allowedParams[i];
		var paramValue = state.queryParameters[paramName] || "";
		command = command.split("{{" + paramName + "}}").join(paramValue);
	}
	child_process.exec(command, function(err, stdout, stderr) {
		if(err) {
			sendJson(response, 200, {
				action: action,
				status: "error",
				error: err.message,
				output: (stdout || "") + (stderr || "")
			});
		} else {
			sendJson(response, 200, {
				action: action,
				status: "ok",
				output: (stdout || "") + (stderr || "")
			});
		}
	});
};

function sendJson(response, statusCode, data) {
	var body = JSON.stringify(data);
	response.writeHead(statusCode, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*"
	});
	response.end(body);
}
