'use strict';

const path = require('path');
const fs = require('./promises/fs');
const url = require('url');
const pluralizationRules = require('./pluralizationRules.json');

const LOCALIZATIONS_FOLDER_NAME = 'l10n';
const BROWSER_LOCALE_REGEXP = /[a-z]{2}(-[a-z]{2})?/i;
const LOCALE_REGEXP = /^[a-z]{2}(-[a-z]{2})?$/;

const DEFAULT_LOCALE_COOKIE_MAX_AGE = 3155692600; // 100 years
const LOCALE_COOKIE_PATH = '/';
const DEFAULT_LOCALE_COOKIE_KEY = 'locale';
const LOCALE_COOKIE_REGEXP = new RegExp(`${DEFAULT_LOCALE_COOKIE_KEY}=${BROWSER_LOCALE_REGEXP.source}`, 'i');
const LOCALE_URL = '/l10n.js';

/* eslint max-nested-callbacks: [2, 4]*/

class LocalizationLoader {

	/**
	 * Creates new instance of server-side localization loader.
	 * @param {ServiceLocator} locator Locator to resolve dependencies.
	 */
	constructor(locator) {
		const l10n = locator.resolve('config').l10n;
		if (!l10n) {
			throw new Error('"l10n" config section is required');
		}
		this._localizationsPath = String(l10n.path ||
			path.join(process.cwd(), LOCALIZATIONS_FOLDER_NAME));
		this._componentFinder = locator.resolve('componentFinder');

		this._defaultLocale = l10n.defaultLocale ?
			String(l10n.defaultLocale) : '';
		if (!LOCALE_REGEXP.test(this._defaultLocale)) {
			throw new Error(`Wrong locale name ${this._defaultLocale} (${LOCALE_REGEXP.toString()})`);
		}

		this._prepareCookieConfig(l10n.cookie || {});
		this._initPluralizationMap();
		this._objectCache = Object.create(null);
		this._fileCache = Object.create(null);
		this._loadingCache = Object.create(null);
		this._lastModified = (new Date()).toUTCString();

		this._eventBus = locator.resolve('eventBus');
		this._eventBus.on('allComponentsLoaded', () => this._init());
		this._watchChanges();
	}

	/**
	 * Loads localization by locale.
	 * @param {string} locale Locale to load.
	 */
	load(locale) {
		if (!locale) {
			locale = this._defaultLocale;
		}
		locale = locale.toLowerCase();
		if (!LOCALE_REGEXP.test(locale)) {
			throw new Error(`Wrong locale name ${locale} (${LOCALE_REGEXP.toString()})`);
		}

		if (this._objectCache[locale] &&
			typeof (this._objectCache[locale]) === 'object') {
			return this._objectCache[locale];
		}

		const firstLocaleComponent = locale.split('-')[0];
		if (firstLocaleComponent !== locale &&
			this._objectCache[firstLocaleComponent] &&
			typeof (this._objectCache[firstLocaleComponent]) === 'object') {
			return this._objectCache[firstLocaleComponent];
		}

		return this._objectCache[this._defaultLocale] || {};
	}

	/**
	 * Gets connect/express middleware for setting locale to cookie
	 * and response with localization file.
	 * @returns {Function} Express/connect middleware.
	 */
	getMiddleware() {
		return (request, response, next) => {
			// try to get locale from cookies
			let locale = getLocaleFromRequest(request);
			if (!locale) {
				// then try to get browser locale
				locale = getBrowserLocale(request);
				if (!locale) {
					// if so sad and we did not get locale already then use default
					locale = this._defaultLocale;
				}
				this._setLocaleToResponse(request, response, locale);
			}

			this._eventBus.emit('trace', `Incoming request with locale ${locale}`);

			const urlInfo = url.parse(request.url);
			if (urlInfo.path === LOCALE_URL) {
				response.writeHead(200, {
					// RFC 4329 section 10
					// (http://tools.ietf.org/html/rfc4329#page-10)
					'Content-Type': 'application/javascript; charset=utf-8',
					'Cache-Control': 'public, max-age=0',
					'Last-Modified': this._lastModified
				});
				response.end(this._getLocalizationFile(locale));
			} else {
				next();
			}
		};
	}

	/**
	 * Watches all localization files for changes.
	 * @private
	 */
	_watchChanges() {
		this._componentFinder
			.on('change', args => {
				const componentDirectory = path.dirname(args.component.path);
				const l10nDirectory = path.join(
					componentDirectory, LOCALIZATIONS_FOLDER_NAME
				);
				const fileDirectory = path.dirname(args.filename);
				if (fileDirectory !== l10nDirectory) {
					return;
				}
				delete this._loadingCache[args.filename];
				this._init();
			})
			.on('add', () => this._init())
			.on('unlink', component => {
				const componentDirectory = path.dirname(component.path);
				const l10nDirectory = path.join(
					componentDirectory, LOCALIZATIONS_FOLDER_NAME
				);
				Object.keys(this._loadingCache)
					.forEach(filename => {
						const directory = path.dirname(filename);
						if (directory !== l10nDirectory) {
							return;
						}
						delete this._loadingCache[filename];
					});
				this._init();
			});
	}

	/**
	 * Initializes the locatlization plugin.
	 * @returns {Promise} Promise for nothing.
	 * @private
	 */
	_init() {
		return this._prepareCache()
			.then(() => {
				const defaultL10n = this._objectCache[this._defaultLocale];
				if (!defaultL10n || typeof (defaultL10n) !== 'object') {
					throw new Error(`Can not load default locale ${this._defaultLocale}`);
				}
			})
			.then(() => this._eventBus.emit('l10nLoaded'))
			.catch(reason => this._eventBus.emit('error', reason));
	}

	/**
	 * Initializes pluralization map.
	 * @private
	 */
	_initPluralizationMap() {
		const pluralizationMap = this._pluralizationMap = {};
		Object.keys(pluralizationRules)
			.forEach(rule => pluralizationRules[rule]
				.forEach(locale => {
					pluralizationMap[locale] = rule;
				})
			);
	}

	/**
	 * Gets localization file string for locale.
	 * @param {string} locale Locale to create file for.
	 * @returns {string} String representation of JavaScript file with localization.
	 * @private
	 */
	_getLocalizationFile(locale) {
		if (this._fileCache[locale] &&
			typeof (this._fileCache[locale]) === 'string') {
			return this._fileCache[locale];
		}

		const firstLocaleComponent = locale.split('-')[0];
		if (firstLocaleComponent !== locale &&
			this._fileCache[firstLocaleComponent] &&
			typeof (this._fileCache[firstLocaleComponent]) === 'string') {
			return this._fileCache[firstLocaleComponent];
		}

		return this._fileCache[this._defaultLocale];
	}

	/**
	 * Gets pluralization rule for specified locale.
	 * @param {string} locale Locale name.
	 * @returns {string} Rule body.
	 * @private
	 */
	_getPluralizationRule(locale) {
		if (locale in this._pluralizationMap) {
			return this._pluralizationMap[locale];
		}

		const underscoreIndex = locale.indexOf('-');
		if (underscoreIndex > 0) {
			const firstLocalePart = locale.substring(0, underscoreIndex);
			if (firstLocalePart in this._pluralizationMap) {
				return this._pluralizationMap[firstLocalePart];
			}
		}

		// default rule takes first plural form
		return '0';
	}

	/**
	 * Prepares object and file cache for all localizations.
	 * @returns {Promise} Promise for operation is complete.
	 * @private
	 */
	_prepareCache() {
		return this._loadLocalizations()
			.then(localizations => {
				this._objectCache = localizations;
				this._fileCache = Object.create(null);

				const defaultRule = this._getPluralizationRule(this._defaultLocale);

				Object.keys(this._objectCache)
					.forEach(locale => {
						if (locale !== this._defaultLocale) {
							const fromDefault = {};
							this._objectCache[locale] = mergeLocalizations(
								this._objectCache[this._defaultLocale],
								this._objectCache[locale], fromDefault);

							this._objectCache[locale].$pluralization = {
								rule: this._getPluralizationRule(locale),
								defaultRule,
								fromDefaultLocale: fromDefault
							};
						} else if (!this._objectCache[locale].$pluralization) {
							this._objectCache[locale].$pluralization = {
								rule: this._getPluralizationRule(locale)
							};
						}

						this._fileCache[locale] = `window.localization = ${JSON.stringify(this._objectCache[locale])}`;
					});
			});
	}

	/**
	 * Loads all localizations from components and application root.
	 * @returns {Promise<Object>} Promise for map with localizations by locales.
	 * @private
	 */
	_loadLocalizations() {
		const localizations = {};

		return fs.exists(this._localizationsPath)
			.then(isExists => {
				if (!isExists) {
					return null;
				}
				return fs.stat(this._localizationsPath)
					.then(localizationsStat => {
						if (localizationsStat.isDirectory()) {
							// load basic localization
							return this._loadLocalizationsFromPath(
								localizations, this._localizationsPath);
						}
						return null;
					});
			})
			.then(() => this._componentFinder.find())
			.then(components => {
				const promises = [];

				Object.keys(components)
					.forEach(name => {
						const localizationsPath = path.join(
							path.dirname(components[name].path),
							LOCALIZATIONS_FOLDER_NAME
						);

						const promise = fs.exists(localizationsPath)
							.then(isExists => {
								if (!isExists) {
									return null;
								}
								return fs.stat(localizationsPath)
									.then(stat => {
										if (!stat.isDirectory()) {
											return null;
										}
										// load localizations of component
										return this._loadLocalizationsFromPath(
											localizations, localizationsPath
										);
									});
							});
						promises.push(promise);
					});

				return Promise.all(promises);
			})
			.then(() => localizations);
	}

	/**
	 * Loads localizations from specified path.
	 * @param {Object} localizations Map of localization by locales where to save
	 * loaded localization keys.
	 * @param {string} loadPath Path where localization files is there.
	 * @returns {Promise} Promise for operations is complete.
	 * @private
	 */
	_loadLocalizationsFromPath(localizations, loadPath) {
		// enumerate localization files
		return fs.readdir(loadPath)
			.then(filenames => {
				const promises = [];
				filenames.forEach(filename => {
					const fullPath = path.join(loadPath, filename);
					const relative = path.relative(process.cwd(), fullPath);

					if (path.extname(relative) !== '.json') {
						return;
					}

					const locale = path.basename(relative, '.json');
					if (!LOCALE_REGEXP.test(locale)) {
						this._eventBus.emit('warn',
							`Wrong localization filename "${relative}", skipped (${LOCALE_REGEXP.toString()})`
						);
						return;
					}

					if (relative in this._loadingCache) {
						promises.push(Promise.resolve(
							this._loadingCache[relative]
						));
						return;
					}
					const promise = fs.readFile(relative)
						.then(file => {
							this._loadingCache[relative] = {
								path: relative,
								locale,
								content: file,
								object: JSON.parse(file)
							};
							return this._loadingCache[relative];
						});
					promises.push(promise);
				});

				return Promise.all(promises);
			})
			.then(files => files.forEach(file => {
				const localization = file.object;

				if (!localizations[file.locale] ||
					typeof (localizations[file.locale]) !== 'object') {
					localizations[file.locale] = {};
				}

				// enumerate localization keys
				Object.keys(localization)
					.forEach(key => {
						if (key in localizations[file.locale]) {
							this._eventBus.emit('warn',
								`Localization key "${key}" was defined again and overridden in locale "${file.locale}"`
							);
						}

						localizations[file.locale][key] = localization[key];
					});
				this._eventBus.emit('info', `Localization file "${file.path}" was loaded`);
			}))
			.catch(reason => this._eventBus.emit('error', reason));
	}

	/**
	 * Prepares cookie configuration.
	 * @param {Object} config Cookie configuration.
	 * @param {string?} config.name Cookie name ('locale' by default).
	 * @param {string?} config.maxAge Cookie max-age
	 * (3 155 692 600 secs, 100 years by default).
	 * @param {string?} config.domain Cookie domain.
	 * @param {string?} config.path Cookie path.
	 * @private
	 */
	_prepareCookieConfig(config) {
		this._cookieConfig = Object.create(config);
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
	}

	/**
	 * Sets locale to HTTP response cookie.
	 * @param {http.IncomingMessage} request HTTP request.
	 * @param {http.ServerResponse} response HTTP response.
	 * @param {string} locale Locale name.
	 */
	_setLocaleToResponse(request, response, locale) {

		/* eslint complexity: [2, 12]*/
		// expire date = current date + max-age in seconds
		const localeSetup = `${this._cookieConfig.name}=${locale}`;
		let cookieSetup = localeSetup;

		// http://tools.ietf.org/html/rfc6265#section-4.1.1
		if (typeof (this._cookieConfig.maxAge) === 'number') {
			cookieSetup += `; Max-Age=${this._cookieConfig.maxAge.toFixed()}`;
			if (!this._cookieConfig.expires) {
				// by default expire date = current date + max-age in seconds
				const expireDate = new Date(Date.now() + this._cookieConfig.maxAge * 1000).toUTCString();
				cookieSetup += `; Expires=${expireDate}`;
			}
		}
		if (this._cookieConfig.expires instanceof Date) {
			cookieSetup += `; Expires=${this._cookieConfig.expires.toUTCString()}`;
		}

		if (typeof (this._cookieConfig.path) === 'string') {
			cookieSetup += `; Path=${String(this._cookieConfig.path || '')}`;
		}

		if (typeof (this._cookieConfig.domain) === 'string') {
			cookieSetup += `; Domain=${String(this._cookieConfig.domain || '')}`;
		}

		if (typeof (this._cookieConfig.secure) === 'boolean' &&
			this._cookieConfig.secure) {
			cookieSetup += '; Secure';
		}
		if (typeof (this._cookieConfig.httpOnly) === 'boolean' &&
			this._cookieConfig.httpOnly) {
			cookieSetup += '; HttpOnly';
		}

		// set locale to request as cookie for next middleware
		if (!request.headers) {
			request.headers = {};
		}
		if (!request.headers.cookie) {
			request.headers.cookie = localeSetup;
		} else {
			request.headers.cookie += `; ${localeSetup}`;
		}

		response.setHeader('Set-Cookie', cookieSetup);
	}
}

/**
 * Merges base (default) and extended localization.
 * @param {Object} base Basic or default localization.
 * @param {Object} extend Some other localization.
 * @param {Object} fromDefault Empty object to fill with
 * plural keys were taken from default localization.
 * @returns {Object} Merged localization.
 */
function mergeLocalizations(base, extend, fromDefault) {
	const result = Object.create(null);

	if (base && typeof (base) === 'object') {
		Object.keys(base)
			.forEach(key => {
				result[key] = base[key];
				if (Array.isArray(result[key])) {
					fromDefault[key] = true;
				}
			});
	}

	if (extend && typeof (extend) === 'object') {
		Object.keys(extend)
			.forEach(key => {
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

	const browserLocales = request.headers['accept-language']
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

	const tokenPairs = request.headers.cookie.match(LOCALE_COOKIE_REGEXP);
	if (!tokenPairs || tokenPairs.length === 0) {
		return null;
	}

	const pair = tokenPairs[0].split('=');
	if (pair.length === 0) {
		return null;
	}

	return pair[1].toLowerCase();
}

module.exports = LocalizationLoader;
