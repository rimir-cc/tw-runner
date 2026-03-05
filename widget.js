/*\
title: $:/plugins/rimir/runner/widget.js
type: application/javascript
module-type: widget

Action widget that calls the runner API route.
<$api.run action="calc"/> or <$api.run action="echo" msg="hello"/>

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var ApiRunWidget = function(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
};

ApiRunWidget.prototype = new Widget();

ApiRunWidget.prototype.render = function(parent, nextSibling) {
	this.computeAttributes();
	this.execute();
	this.renderChildren(parent, nextSibling);
};

ApiRunWidget.prototype.execute = function() {
	this.actionName = this.getAttribute("action");
	this.makeChildWidgets();
};

ApiRunWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes["action"]) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

ApiRunWidget.prototype.invokeAction = function(triggeringWidget, event) {
	var url = "/api/run?action=" + encodeURIComponent(this.actionName || "");
	// Collect non-reserved attributes as query parameters
	var attributes = this.attributes;
	for(var key in attributes) {
		if(key !== "action" && key.charAt(0) !== "$") {
			url += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(attributes[key]);
		}
	}
	this.dispatchEvent({
		type: "tm-http-request",
		param: url,
		paramObject: {
			method: "GET",
			url: url
		}
	});
	return true;
};

exports["api.run"] = ApiRunWidget;
