/*\
title: $:/plugins/rimir/runner/test/test-route-http.js
type: application/javascript
tags: [[$:/tags/test-spec]]

HTTP-level tests for runner's /api/run route. Uses the http-test-helper
that's only present in the tw-tests umbrella test-edition — when this
spec runs via per-plugin `npm test` (which doesn't load tw-tests), the
helper is absent and the suite is skipped.

\*/

"use strict";

var helperAvailable = !!$tw.wiki.getTiddler("$:/test-helpers/http-server");

if(!helperAvailable) {
    describe("runner: /api/run (HTTP)", function() {
        // Pending so per-plugin `npm test` skips cleanly; the umbrella suite
        // (tw-tests) ships the helper and exercises the full describe.
        it("requires the tw-tests umbrella suite (http-test-helper)", function() {
            pending("Run under tw-tests umbrella; helper not in plugin test-edition");
        });
    });
} else {

describe("runner: /api/run (HTTP)", function() {
    var http = require("$:/test-helpers/http-server");
    var ctx;

    beforeAll(function(done) {
        // Use the umbrella's $tw.wiki — runner/route.js was loaded against
        // this wiki at boot, so its actions table (read once at module load)
        // points at the test-edition's runner-actions.json.
        http.start({wiki: $tw.wiki}).then(function(c) { ctx = c; done(); });
    });

    afterAll(function(done) { ctx.stop().then(done); });

    it("returns 400 when the action query parameter is missing", function(done) {
        http.request(ctx, "/api/run").then(function(res) {
            expect(res.status).toBe(400);
            var body = res.json();
            expect(body && body.error).toMatch(/action/i);
            done();
        }).catch(done.fail);
    });

    it("returns 403 for an action not in the whitelist", function(done) {
        // tw-tests/test-edition/runner-actions.json is `{}` — every action
        // is unknown, which is the contract this test pins: invalid actions
        // never reach the shell, they bounce with a 403.
        http.request(ctx, "/api/run?action=rm-rf-slash").then(function(res) {
            expect(res.status).toBe(403);
            var body = res.json();
            expect(body && body.error).toContain("rm-rf-slash");
            done();
        }).catch(done.fail);
    });

    it("returns 404 for a path the route doesn't match", function(done) {
        http.request(ctx, "/api/run/unexpected").then(function(res) {
            expect(res.status).toBe(404);
            done();
        }).catch(done.fail);
    });

    it("sets Content-Type application/json on the error response", function(done) {
        // sendJson() must wire the right Content-Type so browser-side fetch()
        // can call .json() without manual parsing.
        http.request(ctx, "/api/run?action=missing").then(function(res) {
            expect(res.status).toBe(403);
            expect(res.headers["content-type"]).toMatch(/application\/json/);
            // CORS open by default for tooling — runner's response writes
            // Access-Control-Allow-Origin: *
            expect(res.headers["access-control-allow-origin"]).toBe("*");
            done();
        }).catch(done.fail);
    });
});

describe("runner: /api/extract (HTTP)", function() {
    if(!helperAvailable) {
        it("requires the tw-tests umbrella suite (http-test-helper)", function() {
            pending("Run under tw-tests umbrella");
        });
        return;
    }
    var http = require("$:/test-helpers/http-server");
    var ctx;

    beforeAll(function(done) {
        http.start({wiki: $tw.wiki}).then(function(c) { ctx = c; done(); });
    });
    afterAll(function(done) { ctx.stop().then(done); });

    it("returns 400 when the uri query parameter is missing", function(done) {
        http.request(ctx, "/api/extract").then(function(res) {
            expect(res.status).toBe(400);
            var body = res.json();
            expect(body && body.status).toBe("error");
            expect(body.error).toMatch(/uri/i);
            done();
        }).catch(done.fail);
    });
});

}
