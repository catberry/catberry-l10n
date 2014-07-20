#Localization plugin for Catberry Framework[![Build Status](https://travis-ci.org/catberry/catberry-l10n.png?branch=master)](https://travis-ci.org/catberry/catberry-l10n)
[![NPM](https://nodei.co/npm/catberry-l10n.png)](https://nodei.co/npm/catberry-l10n/)

##Description
This module adds localization support for all [Catberry](https://github.com/catberry/catberry) modules.

It supports two contexts of localization:
 1. Application-based localization - files like en.json, en-us.json, 
 en-gb.json and etc. inside `l10n` directory in the root of your application
 2. Module-based localization - the same as above but `l10n` directory should 
 be inside every module's directory

Every localization file is a dictionary of key value pairs. 
Keys are called "localization keys" and values are strings in specified 
language or arrays with plural forms.

For example, your project tree can look like this:

```
catberry_modules
	module1/
		l10n/
			en.json
			en-us.json
			en-gb.json
			ru.json
		...
	module2/
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

Your application-based localization directory must always have a default 
localization file and default name of locale must be set in application config, 
for example:

```javascript
{
	l10n: {
		defaultLocale: 'en-us'
	},
	someOtherParameter: 'someOtherValue'
}
```
It means `l10n/en-us.json` file is required at root of your application.

When localization file is loading it is merged with default localization adding 
absent keys. Localization of modules is overriding application-based 
localization if they have matching keys. If localization specified by user 
does not have such localization key then value from default localization will 
be returned or empty string if default localization also does not have such key.

##Usage
To use this module you must register its components into Catberry's 
[Service Locator](https://github.com/catberry/catberry-locator) like this:

In `server.js`

```javascript
var l10n = require('catberry-l10n'),
	catberry = require('catberry'),
	config = require('./config-server'),
	app = connect();
	cat = catberry.create(config);

// register localization components as singletons
l10n.registerOnServer(cat.locator);

// then resolve loader to get middleware
var localizationLoader = cat.locator.resolve('localizationLoader');

// use middleware to setup locale in user's cookie
// and get /l10n.js file for user's locale
app.use(localizationLoader.getMiddleware());

// localization middleware must be before Catberry
app.use(cat.getMiddleware());
...
```

In `client.js`

```javascript
var l10n = require('catberry-l10n'),
	catberry = require('catberry'),
	config = require('./config-client'),
	cat = catberry.create(config);

// register localization components in locator
l10n.registerOnClient(cat.locator);

```

And then you can just inject $localizationProvider into you module and use 
like this:

```javascript
function Module($localizationProvider) {
	this._l10n = $localizationProvider;
}

Module.prototype.render(placeholderName, callback) {
	// user always has locale in cookies
	var locale = this.$context.cookies.get('locale'),
		localizedValue = this._l10n.get(locale, 'LOCALIZATION_KEY');
	...
}
```

Also you must include `/l10n.js` script into your root placeholder.

##Pluralization
Pluralization support was implemented using this [rules](https://github.com/translate/l10n-guide/blob/master/docs/l10n/pluralforms.rst).
To pluralize localized value it must be set as array with all required plural 
forms for locale language.

Example for english
```javascript
{
	"APPLE": ["%d apple", "%d apples"]
}
```

Usage
```javascript
var util = require('util');

function Module($localizationProvider) {
	this._l10n = $localizationProvider;
}

Module.prototype.render(placeholderName, callback) {
	// user always has locale in cookies
	var locale = this.$context.cookies.get('locale'),
	// for example we have parameter "apples" for our module
		appleCount = Number(this.$context.state.apples);
		localizedValue = util.format(
			this._l10n.pluralize(locale, 'APPLE', appleCount),
			appleCount);

	// if appleCount is 1 then localizedValue will be "1 apple"
	// if appleCount is 5 then localizedValue will be "5 apples"
	...
}
```

##Contribution
If you have found a bug, please create pull request with [mocha](https://www.npmjs.org/package/mocha) 
unit-test which reproduces it or describe all details in issue if you can not 
implement test. If you want to propose some improvements just create issue or 
pull request but please do not forget to use `npm test` to be sure that your 
code is awesome.

All changes should satisfy this [Code Style Guide](https://github.com/catberry/catberry/blob/master/docs/code-style-guide.md).

Also your changes should be covered by unit tests using [mocha](https://www.npmjs.org/package/mocha).

Denis Rechkunov <denis.rechkunov@gmail.com>