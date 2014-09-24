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

/**
 * Creates new instance of localization provider.
 * @param {LocalizationLoader} $localizationLoader Localization loader
 * to load locales.
 * @constructor
 */
function LocalizationProvider($localizationLoader) {
	this._loader = $localizationLoader;
	this._pluralizationRulesCache = {};
}

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