# runner

> Execute whitelisted commands on the host machine via HTTP route

Execute whitelisted commands on the host machine via an HTTP route and trigger them from the browser with an action widget.

## Key features

* **Whitelist security** -- only commands defined in `runner-actions.json` can be executed
* **Parameterized commands** -- `{{placeholder}}` templates substituted from query params
* **Action widget** -- `<$api.run action="name" param="value"/>` for use inside `<$button>`
* **HTTP route** -- `GET /api/run?action=<name>` for direct invocation

## Prerequisites

* Commands must be configured in `runner-actions.json` (next to `tiddlywiki.info`)

## Quick start

Add an action entry to `runner-actions.json`:

```json
{ "myaction": { "command": "echo hello", "description": "Test" } }
```

Use in any tiddler:

```html
<$button><$api.run action="myaction"/>Run</$button>
```

## Plugin Library

Install from the [rimir plugin library](https://rimir-cc.github.io/tw-plugin-library/) via *Control Panel → Plugins → Get more plugins*.

## License

MIT -- see [LICENSE.md](LICENSE.md)
