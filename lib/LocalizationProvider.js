'use strict';

class LocalizationProvider {

	/**
	 * Creates new instance of localization provider.
	 * @param {ServiceLocator} locator Locator to resolve dependencies.
	 */
	constructor(locator) {
		const DEFAULT_LOCALE_COOKIE_KEY = 'locale';
		const DEFAULT_LOCALE_COOKIE_MAX_AGE = 3155692600; // 100 years
		const LOCALE_COOKIE_PATH = '/';
		const LOCALE_REGEXP = /^[a-z]{2}(-[a-z]{2})?$/;

		const l10n = locator.resolve('config').l10n;

		if (!l10n) {
			throw new Error('"l10n" config section is required');
		}
		this._defaultLocale = l10n.defaultLocale ?
		String(l10n.defaultLocale) : '';
		if (!LOCALE_REGEXP.test(this._defaultLocale)) {
			throw new Error(`Wrong locale name ${this._defaultLocale} (${LOCALE_REGEXP.toString()})`);
		}

		if (l10n.cookie && typeof (l10n.cookie) === 'object') {
			this._cookieConfig = Object.create(l10n.cookie);
		} else {
			this._cookieConfig = {};
		}

		if (typeof (this._cookieConfig.name) !== 'string' ||
		this._cookieConfig.name.length === 0) {
			this._cookieConfig.name = DEFAULT_LOCALE_COOKIE_KEY;
		}

		if (typeof (this._cookieConfig.maxAge) !== 'number') {
			this._cookieConfig.maxAge = DEFAULT_LOCALE_COOKIE_MAX_AGE;
		}

		if (typeof (this._cookieConfig.path) !== 'string' ||
		this._cookieConfig.path.length === 0) {
			this._cookieConfig.path = LOCALE_COOKIE_PATH;
		}

		this._placeholder = l10n.placeholder;
		this._loader = locator.resolve('localizationLoader');
		this._pluralizationRulesCache = Object.create(null);
	}

	/**
	 * Gets current locale value from context.
	 * @param {Object} context Component context.
	 */
	getCurrentLocale(context) {
		return context.cookie.get(this._cookieConfig.name) || this._defaultLocale;
	}

	/**
	 * Changes current locale value.
	 * @param {string} locale Locale name (i.e. en, en-us, ru etc).
	 * @param {Object} context Component context.
	 */
	changeLocale(locale, context) {
		const expireDate = new Date((new Date()).getTime() +
		this._cookieConfig.maxAge * 1000);

		this._cookieConfig.key = this._cookieConfig.name;
		this._cookieConfig.value = locale;
		this._cookieConfig.expires = expireDate;
		context.cookie.set(this._cookieConfig);

		if (context.isBrowser) {
			const window = context.locator.resolve('window');
			window.document.location.reload();
		} else {
			context.redirect(context.location.toString());
		}
	}

	/**
	 * Handles not founded value
	 * @param {string} key Key of absent value.
	 * @returns {string} dummy value.
	 * @private
	 */
	_notFound(key) {
		return this._placeholder ? key : '';
	}

	/**
	 * Gets localized value for specified locale and key name.
	 * @param {string} locale Locale name (i.e. EN, RU etc).
	 * @param {string} key Localization key.
	 * @returns {string} Localized value.
	 */
	get(locale, key) {
		let value = this._loader.load(locale)[key];
		if (Array.isArray(value)) {
			value = value[0];
		}

		return String(value || this._notFound(key));
	}

	/**
	 * Gets JavaScript function for pluralization rule.
	 * @param {string} rule Pluralization rule.
	 * @returns {Function} Pluralization rule as JavaScript function.
	 * @private
	 */
	_getPluralizationRuleFunction(rule) {
		if (!(rule in this._pluralizationRulesCache)) {

			/* eslint no-new-func: 0 */
			this._pluralizationRulesCache[rule] = new Function('n', 'pluralForms',
			`var index = Number(${rule}); return String(pluralForms[index]);`);
		}
		return this._pluralizationRulesCache[rule];
	}

	/**
	 * Pluralizes localization constant forms by specified key.
	 * @param {string} locale Locale name.
	 * @param {string} key Localization key.
	 * @param {number} n Number to determine plural form.
	 * @returns {string} Correct plural form.
	 */
	pluralize(locale, key, n) {
		const localeObject = this._loader.load(locale);
		const forms = localeObject[key];

		if (!forms && this._placeholder) {
			return key;
		}

		if (!(Array.isArray(forms))) {
			return String(forms || this._notFound(key));
		}

		const rule = typeof (localeObject.$pluralization.fromDefaultLocale) ===
			'object' &&
			(key in localeObject.$pluralization.fromDefaultLocale) ?
			localeObject.$pluralization.defaultRule :
			localeObject.$pluralization.rule;
		const ruleFunction = this._getPluralizationRuleFunction(rule || '');

		const form = ruleFunction(n, forms);
		return (form !== 'undefined' ? form : this._notFound(key));
	}
}

module.exports = LocalizationProvider;
