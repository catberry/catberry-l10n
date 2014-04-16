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

module.exports = LocalizationLoader;

var path = require('path'),
	fs = require('fs'),
	url = require('url'),
	util = require('util');

var DEFAULT_MODULES_FOLDER = 'catberry_modules',
	LOCALIZATIONS_FOLDER_NAME = 'localizations',
	LOCALIZATION_FILE_FORMAT = 'window.localization = %s;',
	BROWSER_LOCALE_REGEXP = /[a-z]{2}(-[a-z]{2})?/i,
	LOCALE_REGEXP = /^[a-z]{2}(-[a-z]{2})?$/,

	TRACE_REQUEST_WITH_LOCALE = 'Incoming request with locale %s',
	INFO_LOADED_LOCALIZATION_FILE = 'Localization file "%s" was loaded',
	ERROR_LOCALE_NAME = 'Wrong locale name %s (' +
		LOCALE_REGEXP.toString() + ')',
	ERROR_DEFAULT_LOCALE_LOAD = 'Can not load default locale %s',
	ERROR_LOCALIZATION_CONFIG = '"localization" config section is required',
	WARN_WRONG_LOCALIZATION_FILENAME = 'Wrong localization filename "%s", ' +
		'skipped (' + LOCALE_REGEXP.toString() + ')',
	WARN_DOUBLE_KEY_DEFINITION =
		'Localization key "%s" was defined again and overridden in locale "%s"',

	LOCALE_COOKIE_MAX_AGE = 3155692600, // 100 years
	LOCALE_COOKIE_KEY = 'locale',
	LOCALE_COOKIE_REGEXP = new RegExp(LOCALE_COOKIE_KEY + '=' +
		BROWSER_LOCALE_REGEXP.source, 'i'),
	LOCALE_URL = '/localization.js';

/**
 * Creates new instance of server-side localization loader.
 * @param {Logger} $logger Logger to log messages.
 * @param {Object} localization Localization config.
 * @param {string} modulesFolder Modules folder.
 * @constructor
 */
function LocalizationLoader($logger, localization, modulesFolder) {
	if (!localization) {
		throw new Error(ERROR_LOCALIZATION_CONFIG);
	}
	this._localizationsPath = String(localization.path ||
		path.join(process.cwd(), LOCALIZATIONS_FOLDER_NAME));
	this._modulesPath = String(modulesFolder ||
		path.join(process.cwd(), DEFAULT_MODULES_FOLDER));
	this._logger = $logger;

	this._defaultLocale = localization.defaultLocale ?
		String(localization.defaultLocale) : '';
	if (!LOCALE_REGEXP.test(this._defaultLocale)) {
		throw new Error(util.format(ERROR_LOCALE_NAME, this._defaultLocale));
	}

	this._prepareCache();

	var defaultLocalization = this._objectCache[this._defaultLocale];
	if (!defaultLocalization || typeof(defaultLocalization) !== 'object') {
		throw new Error(
			util.format(ERROR_DEFAULT_LOCALE_LOAD, this._defaultLocale));
	}
}

/**
 * Current default locale.
 * @type {string}
 * @private
 */
LocalizationLoader.prototype._defaultLocale = '';

/**
 * Current logger.
 * @type {Logger}
 * @private
 */
LocalizationLoader.prototype._logger = null;

/**
 * Current files cache.
 * @type {Object}
 */
LocalizationLoader.prototype._fileCache = null;

/**
 * Current object cache.
 * @type {Object}
 */
LocalizationLoader.prototype._objectCache = null;

/**
 * Current localization path.
 * @type {string}
 */
LocalizationLoader.prototype._localizationsPath = '';

/**
 * Current modules path.
 * @type {string}
 * @private
 */
LocalizationLoader.prototype._modulesPath = '';

/**
 * Loads localization by locale.
 * @param {string} locale Locale to load.
 */
LocalizationLoader.prototype.load = function (locale) {
	locale = locale.toLowerCase();
	if (!LOCALE_REGEXP.test(locale)) {
		throw new Error(util.format(ERROR_LOCALE_NAME, locale));
	}

	if (this._objectCache[locale] &&
		typeof(this._objectCache[locale]) === 'object') {
		return this._objectCache[locale];
	}

	var firstLocaleComponent = locale.split('-')[0];
	if (firstLocaleComponent !== locale &&
		this._objectCache[firstLocaleComponent] &&
		typeof(this._objectCache[firstLocaleComponent]) === 'object') {
		return this._objectCache[firstLocaleComponent];
	}

	return this._objectCache[this._defaultLocale];
};

/**
 * Gets connect/express middleware for setting locale to cookie
 * and response with localization file.
 * @returns {Function} Express/connect middleware.
 */
LocalizationLoader.prototype.getMiddleware = function () {
	var self = this;
	return function (request, response, next) {
		// try to get locale from cookies
		var locale = getLocaleFromRequest(request);
		if (!locale) {
			// then try to get browser locale
			locale = getBrowserLocale(request);
			if (!locale) {
				// if so sad and we did not get locale already then use default
				locale = self._defaultLocale;
			}
			setLocaleToResponse(request, response, locale);
		}

		self._logger.trace(util.format(TRACE_REQUEST_WITH_LOCALE, locale));

		var urlInfo = url.parse(request.url);
		if (urlInfo.path === LOCALE_URL) {
			response.writeHead(200, {
				'Content-Type': 'text/javascript'
			});
			response.end(self._getLocalizationFile(locale));
		} else {
			next();
		}
	};
};

/**
 * Gets localization file string for locale.
 * @param {string} locale Locale to create file for.
 * @returns {string} String representation of JAvaScript file with localization.
 * @private
 */
LocalizationLoader.prototype._getLocalizationFile = function (locale) {
	if (this._fileCache[locale] &&
		typeof(this._fileCache[locale]) === 'string') {
		return this._fileCache[locale];
	}

	var firstLocaleComponent = locale.split('-')[0];
	if (firstLocaleComponent !== locale &&
		this._fileCache[firstLocaleComponent] &&
		typeof(this._fileCache[firstLocaleComponent]) === 'string') {
		return this._fileCache[firstLocaleComponent];
	}

	return this._fileCache[this._defaultLocale];
};

/**
 * Prepares object and file cache for all localizations.
 * @private
 */
LocalizationLoader.prototype._prepareCache = function () {
	this._objectCache = this._loadLocalizations();
	this._fileCache = {};

	var self = this;

	Object.keys(this._objectCache)
		.forEach(function (locale) {
			if (locale !== self._defaultLocale) {
				self._objectCache[locale] = mergeLocalizations(
					self._objectCache[self._defaultLocale],
					self._objectCache[locale]);
			}

			self._fileCache[locale] = util.format(LOCALIZATION_FILE_FORMAT,
				JSON.stringify(self._objectCache[locale]));
		});
};

/**
 * Loads all localizations from modules and application root.
 * @returns {Object} Map with localizations by locales.
 * @private
 */
LocalizationLoader.prototype._loadLocalizations = function () {
	var self = this,
		localizations = {};

	if (fs.existsSync(this._localizationsPath)) {
		var localizationsStat = fs.statSync(this._localizationsPath);
		if (localizationsStat.isDirectory()) {
			// load basic localization
			this._loadLocalizationsFromPath(
				localizations, this._localizationsPath);
		}
	}

	if (!fs.existsSync(this._modulesPath)) {
		return localizations;
	}
	var modulesStat = fs.statSync(this._modulesPath);
	if (!modulesStat.isDirectory()) {
		return localizations;
	}

	// enumerate modules
	fs.readdirSync(this._modulesPath)
		.forEach(function (moduleName) {
			var fullPath = path.join(self._modulesPath, moduleName),
				localizationsPath =
					path.join(fullPath, LOCALIZATIONS_FOLDER_NAME);

			var moduleStat = fs.statSync(fullPath);
			if (!moduleStat.isDirectory()) {
				return;
			}

			if (!fs.existsSync(localizationsPath)) {
				return;
			}

			var stat = fs.statSync(localizationsPath);
			if (!stat.isDirectory()) {
				return;
			}

			// load localizations of module
			self._loadLocalizationsFromPath(localizations, localizationsPath);
		});

	return localizations;
};

/**
 * Loads localizations from specified path.
 * @param {Object} localizations Map of localization by locales where to save
 * loaded localization keys.
 * @param {string} loadPath Path where localization files is there.
 * @private
 */
LocalizationLoader.prototype._loadLocalizationsFromPath =
	function (localizations, loadPath) {
		var self = this;

		// enumerate localization files
		fs.readdirSync(loadPath)
			.forEach(function (localizationFile) {
				var fullPath = path.join(loadPath, localizationFile);

				if (path.extname(localizationFile) !== '.json') {
					return;
				}

				var locale = path.basename(localizationFile, '.json');
				if (!LOCALE_REGEXP.test(locale)) {
					self._logger.warn(util.format(
						WARN_WRONG_LOCALIZATION_FILENAME, fullPath));
					return;
				}

				try {
					var localization = require(fullPath);
					if (!localizations[locale] ||
						typeof(localizations[locale]) !== 'object') {
						localizations[locale] = {};
					}

					// enumerate localization keys
					Object.keys(localization)
						.forEach(function (key) {
							if (key in localizations[locale]) {
								self._logger.warn(
									util.format(WARN_DOUBLE_KEY_DEFINITION,
										key, locale));
							}

							localizations[locale][key] = localization[key];
						});
					self._logger.info(util.format(
						INFO_LOADED_LOCALIZATION_FILE, fullPath));
				} catch (e) {
					self._logger.error(e);
				}
			});
	};

/**
 * Merges base (default) and extended localization.
 * @param {Object} base Basic or default localization.
 * @param {Object} extend Some other localization.
 * @returns {Object} Merged localization.
 */
function mergeLocalizations(base, extend) {
	var result = {};

	if (base && typeof(base) === 'object') {
		Object.keys(base)
			.forEach(function (key) {
				result[key] = base[key];
			});
	}

	if (extend && typeof(extend) === 'object') {
		Object.keys(extend)
			.forEach(function (key) {
				result[key] = extend[key];
			});
	}

	return result;
}

/**
 * Gets browser locale from Accept-Language HTTP header.
 * @param {http.IncomingMessage} request HTTP request.
 * @returns {string|null} Locale name.
 */
function getBrowserLocale(request) {
	if (!request.headers || !request.headers['accept-language']) {
		return null;
	}

	var browserLocales = request.headers['accept-language']
		.match(BROWSER_LOCALE_REGEXP);
	if (!browserLocales || browserLocales.length === 0) {
		return null;
	}

	return browserLocales[0].toLowerCase();
}

/**
 * Gets locale from HTTP request cookie.
 * @param {http.IncomingMessage} request HTTP request.
 * @returns {string|null} Locale name
 */
function getLocaleFromRequest(request) {
	if (!request.headers || !request.headers.cookie) {
		return null;
	}

	var tokenPairs = request.headers.cookie.match(LOCALE_COOKIE_REGEXP);
	if (!tokenPairs || tokenPairs.length === 0) {
		return null;
	}

	var pair = tokenPairs[0].split('=');
	if (pair.length === 0) {
		return null;
	}

	return pair[1].toLowerCase();
}

/**
 * Sets locale to HTTP response cookie.
 * @param {http.IncomingMessage} request HTTP request.
 * @param {http.ServerResponse} response HTTP response.
 * @param {string} locale Locale name.
 */
function setLocaleToResponse(request, response, locale) {
	// expire date = current date + max-age in seconds
	var expireDate = new Date((new Date()).getTime() +
			LOCALE_COOKIE_MAX_AGE * 1000),
		localeSetup = LOCALE_COOKIE_KEY + '=' + locale,
		cookieSetup = localeSetup +
			'; max-age=' + LOCALE_COOKIE_MAX_AGE +
			'; expires=' + expireDate.toUTCString();

	// set locale to request as cookie for next middleware
	if (!request.headers) {
		request.headers = {};
	}
	if (!request.headers.cookie) {
		request.headers.cookie = localeSetup;
	} else {
		request.headers.cookie += '; ' + localeSetup;
	}

	response.setHeader('set-cookie', cookieSetup);
}