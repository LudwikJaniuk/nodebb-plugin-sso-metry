# NodeBB Metry SSO

NodeBB Plugin that allows users to login/register via [Metry](https://metry.io) OAuth service.

## Install

```bash
$ npm install nodebb-plugin-sso-metry
```

Add your Metry credentials to the NodeBB config.json file:

```json
"oauth": {
  "id": "someoauthid",
  "secret": "youroauthsecret"
}
```

Or use environment variables instead:

```bash
$ oauth__id=someoauthid oauth__secret=youroauthsecret ./nodebb start
```

Log in to the NodeBB admin panel, go to plugins and activate this plugin.

## Licence

MIT
