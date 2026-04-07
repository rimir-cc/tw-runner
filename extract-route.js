/*\
title: $:/plugins/rimir/runner/extract-route.js
type: application/javascript
module-type: route

Server-side document extraction route.
GET /api/extract?uri=<canonical_uri>
Resolves the URI to a filesystem path, runs pandoc/python, returns extracted text.

Supports:
- /files/* — TiddlyWiki's built-in file serving (maps to <wikiPath>/files/*)
- Scattered-binaries routes — resolved via $:/config/rimir/scattered-binaries/profiles

\*/

"use strict";

var child_process = require("child_process");
var fs = require("fs");
var path = require("path");

var EXTRACTORS = {
	".pdf":  "pdftotext -layout \"{input}\" -",
	".docx": "pandoc \"{input}\" -t markdown --wrap=none",
	".xlsx": "python3 scripts/xlsx-to-md.py \"{input}\""
};

// Try to use file-upload's uri-resolver if available (shared location registry)
var uriResolver = null;
try {
	uriResolver = require("$:/plugins/rimir/file-upload/uri-resolver");
} catch(e) { /* file-upload not installed */ }

// Fallback: load scattered-binaries profiles directly (only if uri-resolver unavailable)
var scatteredProfiles = [];
if(!uriResolver) {
	try {
		var profilesText = $tw.wiki.getTiddlerText("$:/config/rimir/scattered-binaries/profiles") || "[]";
		scatteredProfiles = JSON.parse(profilesText);
	} catch(e) { /* no profiles */ }
}

exports.method = "GET";
exports.path = /^\/api\/extract$/;

exports.handler = function(request, response, state) {
	var uri = state.queryParameters.uri;
	if(!uri) {
		sendJson(response, 400, {status: "error", error: "Missing 'uri' parameter"});
		return;
	}

	var ext = path.extname(uri).toLowerCase();
	var commandTemplate = EXTRACTORS[ext];
	if(!commandTemplate) {
		sendJson(response, 400, {status: "error", error: "Unsupported file type: " + ext});
		return;
	}

	// Resolve URI to filesystem path (prefer uri-resolver if available)
	var filePath = uriResolver ? uriResolver.resolve(uri) : resolveUri(uri);
	if(!filePath) {
		sendJson(response, 400, {status: "error", error: "Cannot resolve URI to filesystem path: " + uri});
		return;
	}

	// Security: verify file exists and path doesn't escape wiki root
	var absPath = path.resolve(filePath);
	var wikiRoot = path.resolve($tw.boot.wikiPath);
	if(absPath.indexOf(wikiRoot) !== 0) {
		sendJson(response, 403, {status: "error", error: "Path traversal denied"});
		return;
	}

	if(!fs.existsSync(absPath)) {
		sendJson(response, 404, {status: "error", error: "File not found: " + absPath});
		return;
	}

	// Check if image extraction is requested (PDF only)
	var extractImages = ext === ".pdf" && isImageExtractionEnabled();

	// Run text extraction
	var command = commandTemplate.replace("{input}", absPath);
	child_process.exec(command, {cwd: $tw.boot.wikiPath, maxBuffer: 10 * 1024 * 1024, timeout: 30000}, function(err, stdout, stderr) {
		if(err) {
			sendJson(response, 200, {
				status: "error",
				error: err.message,
				output: (stdout || "") + (stderr || "")
			});
			return;
		}

		var result = {
			status: "ok",
			output: (stdout || "") + (stderr || "")
		};

		if(!extractImages) {
			sendJson(response, 200, result);
			return;
		}

		// Run image extraction: pdfimages extracts embedded images from PDF
		extractPdfImages(absPath, uri, function(imageResult) {
			if(imageResult && imageResult.images.length > 0) {
				result.images = imageResult.images;
				result.derivedDir = imageResult.derivedDir;
			}
			sendJson(response, 200, result);
		});
	});
};

/*
Resolve a _canonical_uri to a filesystem path.
Handles:
- /files/* -> <wikiPath>/files/*
- Scattered-binaries routes -> profile basePath + dirName + subFolder + filePath
*/
function resolveUri(uri) {
	var decoded = decodeURIComponent(uri);

	// Simple case: /files/* maps directly to <wikiPath>/files/*
	if(decoded.indexOf("/files/") === 0) {
		return path.resolve($tw.boot.wikiPath, decoded.substring(1));
	}

	// Try scattered-binaries profiles
	for(var i = 0; i < scatteredProfiles.length; i++) {
		var profile = scatteredProfiles[i];
		var prefix = profile.routePrefix;
		if(!prefix || decoded.indexOf(prefix + "/") !== 0) continue;

		// URI format: /<routePrefix>/<dirName>/<filePath>
		var remainder = decoded.substring(prefix.length + 1);
		var slashIdx = remainder.indexOf("/");
		if(slashIdx === -1) continue;

		var dirName = remainder.substring(0, slashIdx);
		var filePath = remainder.substring(slashIdx + 1);

		// Filesystem: <basePath>/<dirName>/<subFolder>/<filePath>
		return path.resolve($tw.boot.wikiPath, profile.basePath, dirName, profile.subFolder, filePath);
	}

	// Fallback: treat as relative to wiki path (strip leading slash)
	if(decoded.charAt(0) === "/") decoded = decoded.substring(1);
	return path.resolve($tw.boot.wikiPath, decoded);
}

function isImageExtractionEnabled() {
	var tiddler = $tw.wiki.getTiddler("$:/config/rimir/llm-connect/extract-images");
	return tiddler && (tiddler.fields.text || "").trim() === "yes";
}

/*
Extract images from a PDF using pdfimages (poppler-utils).
Stores images in files/_derived/<sanitized-filename>/
Returns: { images: [{filename, uri}], derivedDir: string } via callback
*/
function extractPdfImages(pdfPath, pdfUri, callback) {
	var filesBase = path.resolve($tw.boot.wikiPath, "files");
	var pdfBasename = path.basename(pdfPath);
	var derivedDir = path.join(filesBase, "_derived", pdfBasename);

	// Create derived directory
	try {
		if(!fs.existsSync(derivedDir)) {
			fs.mkdirSync(derivedDir, {recursive: true});
		}
	} catch(e) {
		callback(null);
		return;
	}

	// pdfimages -png extracts all images as PNG files
	// Output prefix: derivedDir/img
	var outputPrefix = path.join(derivedDir, "img");
	var command = 'pdfimages -png "' + pdfPath + '" "' + outputPrefix + '"';

	child_process.exec(command, {cwd: $tw.boot.wikiPath, timeout: 60000}, function(err) {
		if(err) {
			// pdfimages not available or failed — not fatal
			callback(null);
			return;
		}

		// List extracted images
		var images = [];
		try {
			var files = fs.readdirSync(derivedDir);
			for(var i = 0; i < files.length; i++) {
				var ext = path.extname(files[i]).toLowerCase();
				if(ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
					var relPath = "_derived/" + pdfBasename + "/" + files[i];
					images.push({
						filename: files[i],
						uri: "/files/" + relPath.replace(/\\/g, "/")
					});
				}
			}
		} catch(e) {
			callback(null);
			return;
		}

		// Clean up if no images extracted
		if(images.length === 0) {
			try { fs.rmdirSync(derivedDir); } catch(e) { /* ignore */ }
			callback(null);
			return;
		}

		callback({
			images: images,
			derivedDir: "/files/_derived/" + pdfBasename
		});
	});
}

function sendJson(response, statusCode, data) {
	var body = JSON.stringify(data);
	response.writeHead(statusCode, {
		"Content-Type": "application/json"
	});
	response.end(body);
}
