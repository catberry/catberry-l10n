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

module.exports = LocalizationLoader;

var path = require('path'),
	fs = require('./promises/fs'),
	url = require('url'),
	util = require('util'),
	pluralizationRules = require('./pluralizationRules.json');

var LOCALIZATIONS_FOLDER_NAME = 'l10n',
	LOCALIZATION_FILE_FORMAT = 'window.localization = %s;',
	BROWSER_LOCALE_REGEXP = /[a-z]{2}(-[a-z]{2})?/i,
	LOCALE_REGEXP = /^[a-z]{2}(-[a-z]{2})?$/,

	TRACE_REQUEST_WITH_LOCALE = 'Incoming request with locale %s',
	INFO_LOADED_LOCALIZATION_FILE = 'Localization file "%s" was loaded',
	ERROR_LOCALE_NAME = 'Wrong locale name %s (' +
		LOCALE_REGEXP.toString() + ')',
	ERROR_DEFAULT_LOCALE_LOAD = 'Can not load default locale %s',
	ERROR_LOCALIZATION_CONFIG = '"l10n" config section is required',
	WARN_WRONG_LOCALIZATION_FILENAME = 'Wrong localization filename "%s", ' +
		'skipped (' + LOCALE_REGEXP.toString() + ')',
	WARN_DOUBLE_KEY_DEFINITION =
		'Localization key "%s" was defined again and overridden in locale "%s"',

	DEFAULT_LOCALE_COOKIE_MAX_AGE = 3155692600, // 100 years
	LOCALE_COOKIE_PATH = '/',
	DEFAULT_LOCALE_COOKIE_KEY = 'locale',
	LOCALE_COOKIE_REGEXP = new RegExp(DEFAULT_LOCALE_COOKIE_KEY + '=' +
	BROWSER_LOCALE_REGEXP.source, 'i'),
	LOCALE_URL = '/l10n.js';

/**
 * Creates new instance of server-side localization loader.
 * @param {ServiceLocator} $serviceLocator Locator to resolve dependencies.
 * @param {Object} l10n Localization config.
 * @constructor
 */
function LocalizationLoader($serviceLocator, l10n) {
	if (!l10n) {
		throw new Error(ERROR_LOCALIZATION_CONFIG);
	}
	this._localizationsPath = String(l10n.path ||
		path.join(process.cwd(), LOCALIZATIONS_FOLDER_NAME));
	this._componentFinder = $serviceLocator.resolve('componentFinder');
	this._logger = $serviceLocator.resolve('logger');

	this._defaultLocale = l10n.defaultLocale ?
		String(l10n.defaultLocale) : '';
	if (!LOCALE_REGEXP.test(this._defaultLocale)) {
		throw new Error(util.format(ERROR_LOCALE_NAME, this._defaultLocale));
	}

	this._prepareCookieConfig(l10n.cookie || {});
	this._initPluralizationMap();
	this._objectCache = {};
	this._fileCache = {};
	this._loadingCache = {};

	this._eventBus = $serviceLocator.resolve('eventBus');
	var self = this;

	this._eventBus.on('allComponentsLoaded', function () {
		self._init();
	});
	this._watchChanges();
}

/**
 * Current event bus.
 * @type {EventEmitter}
 * @private
 */
LocalizationLoader.prototype._eventBus = null;

/**
 * Current cookie configuration.
 * @type {Object}
 * @private
 */
LocalizationLoader.prototype._cookieConfig = null;

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
 * Current loading files cache.
 * @type {Object}
 */
LocalizationLoader.prototype._loadingCache = null;

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
 * Current component finder.
 * @type {ComponentFinder}
 * @private
 */
LocalizationLoader.prototype._componentFinder = null;

/**
 * Current map of locales to its pluralization rules.
 * @type {Object}
 * @private
 */
LocalizationLoader.prototype._pluralizationMap = null;

/**
 * Loads localization by locale.
 * @param {string} locale Locale to load.
 */
LocalizationLoader.prototype.load = function (locale) {
	locale = locale || this._defaultLocale;
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

	return this._objectCache[this._defaultLocale] || {};
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
			self._setLocaleToResponse(request, response, locale);
		}

		self._logger.trace(util.format(TRACE_REQUEST_WITH_LOCALE, locale));

		var urlInfo = url.parse(request.url);
		if (urlInfo.path === LOCALE_URL) {
			response.writeHead(200, {
				// RFC 4329 section 10
				// (http://tools.ietf.org/html/rfc4329#page-10)
				'Content-Type': 'application/javascript; charset=utf-8'
			});
			response.end(self._getLocalizationFile(locale));
		} else {
			next();
		}
	};
};

/**
 * Watches all localization files for changes.
 * @private
 */
LocalizationLoader.prototype._watchChanges = function () {
	var self = this;
	this._componentFinder
		.on('change', function (args) {
			var componentDirectory = path.dirname(args.component.path),
				l10nDirectory = path.join(
					componentDirectory, LOCALIZATIONS_FOLDER_NAME
				),
				fileDirectory = path.dirname(args.filename);
			if (fileDirectory !== l10nDirectory) {
				return;
			}
			var isDeleted = delete self._loadingCache[args.filename];
			self._init();
		})
		.on('add', function () {
			self._init();
		})
		.on('unlink', function (component) {
			var componentDirectory = path.dirname(component.path),
				l10nDirectory = path.join(
					componentDirectory, LOCALIZATIONS_FOLDER_NAME
				);
			Object.keys(self._loadingCache)
				.forEach(function (filename) {
					var directory = path.dirname(filename);
					if (directory !== l10nDirectory) {
						return;
					}
					delete self._loadingCache[filename];
				});
			self._init();
		});
};

/**
 * Initializes the locatlization plugin.
 * @returns {Promise} Promise for nothing.
 * @private
 */
LocalizationLoader.prototype._init = function () {
	var self = this;
	return this._prepareCache()
		.then(function () {
			var defaultL10n = self._objectCache[self._defaultLocale];
			if (!defaultL10n || typeof(defaultL10n) !== 'object') {
				throw new Error(util.format(
					ERROR_DEFAULT_LOCALE_LOAD, self._defaultLocale
				));
			}
		})
		.then(function () {
			self._eventBus.emit('l10nLoaded');
		})
		.catch(function (reason) {
			self._eventBus.emit('error', reason);
		});
};

/**
 * Initializes pluralization map.
 * @private
 */
LocalizationLoader.prototype._initPluralizationMap = function () {
	var pluralizationMap = this._pluralizationMap = {};
	Object.keys(pluralizationRules)
		.forEach(function (rule) {
			pluralizationRules[rule].forEach(function (locale) {
				pluralizationMap[locale] = rule;
			});
		});
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
 * Gets pluralization rule for specified locale.
 * @param {string} locale Locale name.
 * @returns {string} Rule body.
 * @private
 */
LocalizationLoader.prototype._getPluralizationRule = function (locale) {
	if (locale in this._pluralizationMap) {
		return this._pluralizationMap[locale];
	}

	var underscoreIndex = locale.indexOf('-');
	if (underscoreIndex > 0) {
		var firstLocalePart = locale.substring(0, underscoreIndex);
		if (firstLocalePart in this._pluralizationMap) {
			return this._pluralizationMap[firstLocalePart];
		}
	}

	// default rule takes first plural form
	return '0';
};

/**
 * Prepares object and file cache for all localizations.
 * @returns {Promise} Promise for operation is complete.
 * @private
 */
LocalizationLoader.prototype._prepareCache = function () {
	var self = this;
	return this._loadLocalizations()
		.then(function (localizations) {
			self._objectCache = localizations;
			self._fileCache = {};

			var defaultRule = self._getPluralizationRule(self._defaultLocale);

			Object.keys(self._objectCache)
				.forEach(function (locale) {
					if (locale !== self._defaultLocale) {
						var fromDefault = {};
						self._objectCache[locale] = mergeLocalizations(
							self._objectCache[self._defaultLocale],
							self._objectCache[locale], fromDefault);

						self._objectCache[locale].$pluralization = {
							rule: self._getPluralizationRule(locale),
							defaultRule: defaultRule,
							fromDefaultLocale: fromDefault
						};
					} else if (!self._objectCache[locale].$pluralization) {
						self._objectCache[locale].$pluralization = {
							rule: self._getPluralizationRule(locale)
						};
					}

					self._fileCache[locale] = util.format(LOCALIZATION_FILE_FORMAT,
						JSON.stringify(self._objectCache[locale]));
				});
		});
};

/**
 * Loads all localizations from components and application root.
 * @returns {Promise<Object>} Promise for map with localizations by locales.
 * @private
 */
LocalizationLoader.prototype._loadLocalizations = function () {
	var self = this,
		localizations = {};

	return fs.exists(this._localizationsPath)
		.then(function (isExists) {
			if (!isExists) {
				return;
			}
			return fs.stat(self._localizationsPath)
				.then(function (localizationsStat) {
					if (localizationsStat.isDirectory()) {
						// load basic localization
						return self._loadLocalizationsFromPath(
							localizations, self._localizationsPath);
					}
				});
		})
		.then(function () {
			return self._componentFinder.find();
		})
		.then(function (components) {
			var promises = [];

			Object.keys(components)
				.forEach(function (name) {
					var localizationsPath = path.join(
						path.dirname(components[name].path),
						LOCALIZATIONS_FOLDER_NAME
					);

					var promise = fs.exists(localizationsPath)
						.then(function (isExists) {
							if (!isExists) {
								return;
							}
							return fs.stat(localizationsPath)
								.then(function (stat) {
									if (!stat.isDirectory()) {
										return;
									}
									// load localizations of component
									return self._loadLocalizationsFromPath(
										localizations, localizationsPath
									);
								});
						});
					promises.push(promise);
				});

			return Promise.all(promises);
		})
		.then(function () {
			return localizations;
		});
};

/**
 * Loads localizations from specified path.
 * @param {Object} localizations Map of localization by locales where to save
 * loaded localization keys.
 * @param {string} loadPath Path where localization files is there.
 * @returns {Promise} Promise for operations is complete.
 * @private
 */
LocalizationLoader.prototype._loadLocalizationsFromPath =
	function (localizations, loadPath) {
		var self = this;

		// enumerate localization files
		return fs.readdir(loadPath)
			.then(function (filenames) {
				var promises = [];
				filenames.forEach(function (filename) {
					var fullPath = path.join(loadPath, filename),
						relative = path.relative(process.cwd(), fullPath);

					if (path.extname(relative) !== '.json') {
						return;
					}

					var locale = path.basename(relative, '.json');
					if (!LOCALE_REGEXP.test(locale)) {
						self._logger.warn(util.format(
							WARN_WRONG_LOCALIZATION_FILENAME, relative));
						return;
					}

					if (self._loadingCache.hasOwnProperty(relative)) {
						promises.push(Promise.resolve(
							self._loadingCache[relative]
						));
						return;
					}
					var promise = fs.readFile(relative)
						.then(function (file) {
							self._loadingCache[relative] = {
								path: relative,
								locale: locale,
								content: file,
								object: JSON.parse(file)
							};
							return self._loadingCache[relative];
						});
					promises.push(promise);
				});

				return Promise.all(promises);
			})
			.then(function (files) {
				files.forEach(function (file) {
					var localization = file.object;

					if (!localizations[file.locale] ||
						typeof(localizations[file.locale]) !== 'object') {
						localizations[file.locale] = {};
					}

					// enumerate localization keys
					Object.keys(localization)
						.forEach(function (key) {
							if (key in localizations[file.locale]) {
								self._logger.warn(
									util.format(WARN_DOUBLE_KEY_DEFINITION,
										key, file.locale
									));
							}

							localizations[file.locale][key] = localization[key];
						});
					self._logger.info(util.format(
						INFO_LOADED_LOCALIZATION_FILE, file.path));
				});
			})
			.catch(self._logger.error);
	};

/**
 * Prepares cookie configuration.
 * @param {Object} config Cookie configuration.
 * @param {String?} config.name Cookie name ('locale' by default).
 * @param {String?} config.maxAge Cookie max-age
 * (3 155 692 600 secs, 100 years by default).
 * @param {String?} config.domain Cookie domain.
 * @param {String?} config.path Cookie path.
 * @private
 */
LocalizationLoader.prototype._prepareCookieConfig = function (config) {
	this._cookieConfig = Object.create(config);
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
};

/**
 * Sets locale to HTTP response cookie.
 * @param {http.IncomingMessage} request HTTP request.
 * @param {http.ServerResponse} response HTTP response.
 * @param {string} locale Locale name.
 */
LocalizationLoader.prototype._setLocaleToResponse =
	function (request, response, locale) {
		// expire date = current date + max-age in seconds
		var expireDate = new Date((new Date()).getTime() +
			this._cookieConfig.maxAge * 1000),
			localeSetup = this._cookieConfig.name + '=' + locale,
			cookieSetup = localeSetup;

		// http://tools.ietf.org/html/rfc6265#section-4.1.1
		cookieSetup += '; Max-Age=' + this._cookieConfig.maxAge;
		cookieSetup += '; Expires=' + expireDate.toUTCString();

		if (this._cookieConfig.path) {
			cookieSetup += '; Path=' + String(this._cookieConfig.path || '');
		}

		if (this._cookieConfig.domain) {
			cookieSetup +=
				'; Domain=' + String(this._cookieConfig.domain || '');
		}

		// set locale to request as cookie for next middleware
		if (!request.headers) {
			request.headers = {};
		}
		if (!request.headers.cookie) {
			request.headers.cookie = localeSetup;
		} else {
			request.headers.cookie += '; ' + localeSetup;
		}

		response.setHeader('Set-Cookie', cookieSetup);
	};

/**
 * Merges base (default) and extended localization.
 * @param {Object} base Basic or default localization.
 * @param {Object} extend Some other localization.
 * @param {Object} fromDefault Empty object to fill with
 * plural keys were taken from default localization.
 * @returns {Object} Merged localization.
 */
function mergeLocalizations(base, extend, fromDefault) {
	var result = {};

	if (base && typeof(base) === 'object') {
		Object.keys(base)
			.forEach(function (key) {
				result[key] = base[key];
				if (util.isArray(result[key])) {
					fromDefault[key] = true;
				}
			});
	}

	if (extend && typeof(extend) === 'object') {
		Object.keys(extend)
			.forEach(function (key) {
				result[key] = extend[key];
				delete fromDefault[key];
			});
	}

	return result;
}

/**
 * Gets browser locale from "Accept-Language" HTTP header.
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
 * @returns {string|null} Locale name.
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