/*
 * catberry
 *
 * Copyright (c) 2014 Denis Rechkunov and project contributors.
 *
 * catberry's license follows:
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This license applies to all parts of catberry that are not externally
 * maintained libraries.
 */

'use strict';

module.exports = LocalizationProvider;

var util = require('util');

var DEFAULT_LOCALE_COOKIE_KEY = 'locale',
	DEFAULT_LOCALE_COOKIE_MAX_AGE = 3155692600, // 100 years
	LOCALE_COOKIE_PATH = '/',
	LOCALE_REGEXP = /^[a-z]{2}(-[a-z]{2})?$/,
	ERROR_LOCALE_NAME = 'Wrong locale name %s (' +
		LOCALE_REGEXP.toString() + ')',
	ERROR_LOCALIZATION_CONFIG = '"l10n" config section is required';

/**
 * Creates new instance of localization provider.
 * @param {LocalizationLoader} $localizationLoader Localization loader
 * to load locales.
 * @param {Object} l10n Localization config.
 * @constructor
 */
function LocalizationProvider($localizationLoader, l10n) {
	if (!l10n) {
		throw new Error(ERROR_LOCALIZATION_CONFIG);
	}
	this._defaultLocale = l10n.defaultLocale ?
		String(l10n.defaultLocale) : '';
	if (!LOCALE_REGEXP.test(this._defaultLocale)) {
		throw new Error(util.format(ERROR_LOCALE_NAME, this._defaultLocale));
	}

	if (l10n.cookie && typeof(l10n.cookie) === 'object') {
		this._cookieConfig = Object.create(l10n.cookie);
	} else {
		this._cookieConfig = {};
	}

	if (typeof(this._cookieConfig.name) !== 'string' ||
		this._cookieConfig.name.length === 0) {
		this._cookieConfig.name = DEFAULT_LOCALE_COOKIE_KEY;
	}

	if (typeof(this._cookieConfig.maxAge) !== 'number') {
		this._cookieConfig.maxAge = DEFAULT_LOCALE_COOKIE_MAX_AGE;
	}

	if (typeof(this._cookieConfig.path) !== 'string' ||
		this._cookieConfig.path.length === 0) {
		this._cookieConfig.path = LOCALE_COOKIE_PATH;
	}

	this._loader = $localizationLoader;
	this._pluralizationRulesCache = {};
}

/**
 * Current cookie configuration.
 * @type {Object}
 * @private
 */
LocalizationProvider.prototype._cookieConfig = null;

/**
 * Current localization loader.
 * @type {LocalizationLoader}
 * @private
 */
LocalizationProvider.prototype._loader = null;

/**
 * Current cache of pluralization functions.
 * @type {Object}
 * @private
 */
LocalizationProvider.prototype._pluralizationRulesCache = null;

/**
 * Gets current locale value from context.
 * @param {Object} context Component context.
 */
LocalizationProvider.prototype.getCurrentLocale = function (context) {
	return context.cookie.get(this._cookieConfig.name) || this._defaultLocale;
};

/**
 * Changes current locale value.
 * @param {string} locale Locale name (i.e. en, en-us, ru etc).
 * @param {Object} context Component context.
 */
LocalizationProvider.prototype.changeLocale = function (locale, context) {
	var expireDate = new Date((new Date()).getTime() +
			this._cookieConfig.maxAge * 1000);

	this._cookieConfig.key = this._cookieConfig.name;
	this._cookieConfig.value = locale;
	this._cookieConfig.expires = expireDate;
	context.cookie.set(this._cookieConfig);

	if(context.isBrowser) {
		var window = context.locator.resolve('window');
		window.document.location.reload();
	} else {
		context.redirect(context.location.toString());
	}
};

/**
 * Gets localized value for specified locale and key name.
 * @param {string} locale Locale name (i.e. EN, RU etc).
 * @param {string} key Localization key.
 * @returns {string} Localized value.
 */
LocalizationProvider.prototype.get = function (locale, key) {
	var value = this._loader.load(locale)[key];
	if (value instanceof Array) {
		value = value[0];
	}

	return String(value || '');
};

/**
 * Gets JavaScript function for pluralization rule.
 * @param {string} rule Pluralization rule.
 * @returns {Function} Pluralization rule as JavaScript function.
 * @private
 */
LocalizationProvider.prototype._getPluralizationRuleFunction = function (rule) {
	if (!(rule in  this._pluralizationRulesCache)) {
		/*jshint evil:true */
		this._pluralizationRulesCache[rule] = new Function('n', 'pluralForms',
			'var index = Number(' + rule +
			'); return String(pluralForms[index] || \'\');');
	}
	return this._pluralizationRulesCache[rule];
};

/**
 * Pluralizes localization constant forms by specified key.
 * @param {string} locale Locale name.
 * @param {string} key Localization key.
 * @param {number} n Number to determine plural form.
 * @returns {string} Correct plural form.
 */
LocalizationProvider.prototype.pluralize = function (locale, key, n) {
	var localeObject = this._loader.load(locale),
		forms = localeObject[key];

	if (!(forms instanceof Array)) {
		return String(forms || '');
	}

	var rule = typeof(localeObject.$pluralization.fromDefaultLocale) ===
		'object' &&
		(key in localeObject.$pluralization.fromDefaultLocale) ?
			localeObject.$pluralization.defaultRule :
			localeObject.$pluralization.rule,
		ruleFunction = this._getPluralizationRuleFunction(rule || '');
	return ruleFunction(n, forms);
};