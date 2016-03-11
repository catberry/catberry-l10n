# Localization Plugin for [Catberry Framework](https://github.com/catberry/catberry)

[![Build Status](https://travis-ci.org/catberry/catberry-l10n.svg?branch=master)](https://travis-ci.org/catberry/catberry-l10n)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/catberry/main?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=body_badge)
[![codecov.io](http://codecov.io/github/catberry/catberry-l10n/coverage.svg?branch=master)](http://codecov.io/github/catberry/catberry-l10n?branch=master)

## Description
This plugin adds localization support for [Cat-components](https://github.com/catberry/catberry/blob/4.0.0/docs/index.md#cat-components).

It supports two contexts of localization:
 1. Application-based localization - files like `en.json`, `en-us.json`,
 `en-gb.json` and etc. inside the `l10n` directory at the root of your application
 2. Component-based localization - the same as above but `l10n` directory should
 be placed inside a component's directory

Every localization file is a dictionary of key value pairs.
Keys are called "localization keys" and values are strings in specified
language or arrays with plural forms.

For example, your project tree can look like this:

```
catberry_components
	component1/
		l10n/
			en.json
			en-us.json
			en-gb.json
			ru.json
		...
	component2/
		l10n/
			en.json
			en-us.json
			en-gb.json
			ru.json
		...
l10n/
	en.json
	en-us.json
	en-gb.json
	ru.json
```

Your application-based localization directory should always have a default
localization file and a default locale name should be set in a Catberry
application's config, for example:

```javascript
{
	l10n: {
		// default locale used when value for specified locale not found
		// this parameter is required
		defaultLocale: 'en-us',
		// display keys of not founded localization strings
		placeholder: false,
		cookie: {
			// name of locale cookie (Optional, 'locale' by default)
			name: 'locale',
			// max cookie age (Optional, 100 years by default)
			maxAge: 3155692600,
			// cookie path (Optional, empty by default)
			path: '/',
			// cookie domain (Optional, empty by default)
			domain: 'some.domain.org'
		}
	},
	someOtherParameter: 'someOtherValue'
}
```
It means that `l10n/en-us.json` file is required at the root of your application.

While localization file is being loaded it is merged with the default localization dictionary adding
absent keys. Localization of components is overriding application-based
localization values if they have matching keys. If localization set specified by user
does not have the localization key then value from the default localization set is returned
or empty string if default localization also does not have such key.

## Usage
To use the localization plugin you should register its components into Catberry's
[Service Locator](https://github.com/catberry/catberry-locator) like this:

In `server.js`

```javascript
const l10n = require('catberry-l10n');
const catberry = require('catberry');
const config = require('./config-server');
const app = connect();
const cat = catberry.create(config);

// register localization components as singletons
l10n.register(cat.locator);

// then resolve loader to get middleware
const localizationLoader = cat.locator.resolve('localizationLoader');

// use middleware to setup locale in user's cookie
// and get /l10n.js file for user's locale
app.use(localizationLoader.getMiddleware());

// localization middleware should be before Catberry
app.use(cat.getMiddleware());
...

```

In `browser.js`/`build.js`

```javascript
const l10n = require('catberry-l10n');
const catberry = require('catberry');
const config = require('./config-client');
const cat = catberry.create(config);

// register localization components in locator
l10n.register(cat.locator);

```

As you might notice, `catberry-l10n` has a server-side middleware that
automatically sets a browser's locale to the user's cookie and you can use this
value from `$context.cookie.get` in your stores and components.

Also, you should include `/l10n.js` script into your HEAD element. This URL is
served by `catberry-l10n` middleware.

## Pluralization
Pluralization support was implemented using these [rules](https://github.com/translate/l10n-guide/blob/master/docs/l10n/pluralforms.rst).
For pluralization of localized value, it should be set as an array with all required
plural forms for locale's language.

## How to use
Localization dictionary:

```json
{
	"EAT": "eat",
	"APPLE": ["%d apple", "%d apples"]
}
```

Component code:

```javascript
class Component {
	constructor(locator) {
		this._l10n = locator.resolve('localizationProvider');
	}

	render() {
		// user always has locale in context (thanks to l10n middleware)
		const locale = this._l10n.getCurrentLocale(this.$context);
		const appleCount = Number(this.$context.state.apples);
		return {
			localizedEat: this._l10n.get(locale, 'EAT'),
			localizedApple: util.format(
				this._l10n.pluralize(locale, 'APPLE', appleCount),
				appleCount
			)
		};
	}
}
```

Component's template (using [Dust](https://github.com/catberry/catberry-dust) for example):

```html
{localizedEat} {localizedApple}
```

For 1 apple it will be `eat 1 apple`

For 5 apples it will be `eat 5 apples`

Also, you can change current locale using `changeLocale`
method of `localizationProvider` like this:

```javascript
this._l10n.changeLocale('en-gb', this.$context);
```

it changes the locale value in cookie and reloads the page.

## Contributing

There are a lot of ways to contribute:

* Give it a star
* Join the [Gitter](https://gitter.im/catberry/main) room and leave a feedback or help with answering users' questions
* [Submit a bug or a feature request](https://github.com/catberry/catberry-l10n/issues)
* [Submit a PR](https://github.com/catberry/catberry-l10n/blob/develop/CONTRIBUTING.md)

Denis Rechkunov <denis.rechkunov@gmail.com>
