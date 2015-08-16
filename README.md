# Localization Plugin for [Catberry Framework](https://github.com/catberry/catberry) [![Build Status](https://travis-ci.org/catberry/catberry-l10n.png?branch=master)](https://travis-ci.org/catberry/catberry-l10n) [![codecov.io](http://codecov.io/github/catberry/catberry-l10n/coverage.svg?branch=master)](http://codecov.io/github/catberry/catberry-l10n?branch=master)
[![NPM](https://nodei.co/npm/catberry-l10n.png)](https://nodei.co/npm/catberry-l10n/)

## Description
This plugin adds localization support for [Cat-components](https://github.com/catberry/catberry/blob/4.0.0/docs/index.md#cat-components).

It supports two contexts of localization:
 1. Application-based localization - files like en.json, en-us.json, 
 en-gb.json and etc. inside `l10n` directory at the root of your application
 2. Component-based localization - the same as above but `l10n` directory should
 be inside every component's directory

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
localization file and a default name of locale should be set in Catberry
application config, for example:

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
It means `l10n/en-us.json` file is required at root of your application.

While localization file is loaded it is merged with default localization adding
absent keys. Localization of components is overriding application-based
localization if they have matching keys. If localization specified by user 
does not have such localization key then value from default localization will 
be returned or empty string if default localization also does not have such key.

## Usage
To use localization plugin you should register its components into Catberry's
[Service Locator](https://github.com/catberry/catberry-locator) like this:

In `server.js`

```javascript
var l10n = require('catberry-l10n'),
	catberry = require('catberry'),
	config = require('./config-server'),
	app = connect();
	cat = catberry.create(config);

// register localization components as singletons
l10n.register(cat.locator);

// then resolve loader to get middleware
var localizationLoader = cat.locator.resolve('localizationLoader');

// use middleware to setup locale in user's cookie
// and get /l10n.js file for user's locale
app.use(localizationLoader.getMiddleware());

// localization middleware should be before Catberry
app.use(cat.getMiddleware());
...
```

In `browser.js`

```javascript
var l10n = require('catberry-l10n'),
	catberry = require('catberry'),
	config = require('./config-client'),
	cat = catberry.create(config);

// register localization components in locator
l10n.register(cat.locator);

```

As you may notice, `catberry-l10n` has server-side middleware that
automatically sets browser locale to the user's cookie and you can use this
value from `$context.cookie.get` in your stores and components.

Also you should include `/l10n.js` script into your HEAD element. This URL is
served by `catberry-l10n` middleware too.

## Pluralization
Pluralization support was implemented using these [rules](https://github.com/translate/l10n-guide/blob/master/docs/l10n/pluralforms.rst).
For pluralization of localized value it should be set to array with all required
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
function Component($localizationProvider) {
	this._l10n = $localizationProvider;
}

Component.prototype.render = function () {
	// user always has locale in context (thanks to l10n middleware)
	var locale = this._l10n.getCurrentLocale(this.$context),
		appleCount = Number(this.$context.state.apples);
	return {
		localizedEat: this._l10n.get(locale, 'EAT'),
		localizedApple: util.format(
			this._l10n.pluralize(locale, 'APPLE', appleCount),
			appleCount
		)
	};
}
```

Component's template (using [Dust](https://github.com/catberry/catberry-dust) for example):

```html
{localizedEat} {localizedApple}
```

For 1 apple it will be `eat 1 apple`

For 5 apples it will be `eat 5 apples`

Also, you can change current locale using `changeLocale`
method of `$localizationProvider` like this:
```
this._l10n.changeLocale('en-gb', this.$context);
```
it changes the locale cookie and reloads the page.

## Contributing

There are a lot of ways to contribute:

* Give it a star
* Join the [Gitter](https://gitter.im/catberry/catberry) room and leave a feedback or help with answering users' questions
* [Submit a bug or a feature request](https://github.com/catberry/catberry-l10n/issues)
* [Submit a PR](https://github.com/catberry/catberry-l10n/blob/develop/CONTRIBUTING.md)

Denis Rechkunov <denis.rechkunov@gmail.com>
