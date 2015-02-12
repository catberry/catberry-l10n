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

var assert = require('assert'),
	events = require('events'),
	Promise = require('promise'),
	http = require('http'),
	path = require('path'),
	LocalizationLoader = require('../../lib/LocalizationLoader'),
	Logger = require('../mocks/Logger'),
	ServiceLocator = require('catberry-locator');

global.Promise = Promise;

var caseRoot = path.join(
	__dirname, '..', 'cases', 'lib', 'server', 'LocalizationLoader'
);

var defaultLocale = 'ru',
	components = {
		component1: {
			path: path.join(
				caseRoot, 'components', 'component1', 'test-comp.json'
			)
		},
		component2: {
			path: path.join(
				caseRoot, 'components', 'component2', 'test-comp.json'
			)
		},
		// not exists
		component3: {
			path: path.join(
				caseRoot, 'components', 'component3', 'test-comp.json'
			)
		},
		// not a directory
		component4: {
			path: path.join(
				caseRoot, 'components', 'component4', 'test-comp.json'
			)
		}
	},
	defaultConfig = {
		l10n: {
			defaultLocale: defaultLocale,
			path: caseRoot
		}
	},
	localizations = {
		en: require(path.join(defaultConfig.l10n.path, 'en')),
		ru: require(path.join(defaultConfig.l10n.path, 'ru')),
		'en-us': require(path.join(defaultConfig.l10n.path, 'en-us'))
	},
	defaultLocalization = localizations[defaultLocale];

localizations['en-us'].$pluralization = localizations.en.$pluralization = {
	rule: '(n != 1)',
	defaultRule: '(n%10==1 && n%100!=11 ? 0 : ' +
	'n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)',
	fromDefaultLocale: {}
};

localizations.ru.$pluralization = {
	rule: '(n%10==1 && n%100!=11 ? 0 : ' +
	'n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)'
};

describe('server/LocalizationLoader', function () {
	describe('#constructor', function () {
		it('should throw exception when default locale is not specified',
			function () {
				assert.throws(function () {
					var locator = createLocator();
					locator.resolveInstance(LocalizationLoader);
				}, 'Error expected');
			});

		it('should throw exception when default locale is wrong',
			function () {
				assert.throws(function () {
					var config = {
							l10n: {
								defaultLocale: 'china'
							}
						},
						locator = createLocator(config);
					locator.resolveInstance(LocalizationLoader, config);
				}, 'Error expected');
			});

		it('should throw exception when default localization can not be loaded',
			function (done) {
				var locator = createLocator(),
					eventBus = locator.resolve('eventBus');
				eventBus.on('error', function (error) {
					assert.strictEqual(
						error.message, 'Can not load default locale ch'
					);
					done();
				});
				locator.resolveInstance(LocalizationLoader, {
					l10n: {
						defaultLocale: 'ch'
					}
				});
				eventBus.emit('allComponentsLoaded');
			});

		it('should not throw exception when default locale is specified',
			function () {
				assert.doesNotThrow(function () {
					var locator = createLocator();
					locator.resolveInstance(LocalizationLoader, defaultConfig);
				});
			});
	});

	describe('#load', function () {
		it('should throw exception on wrong locale', function () {
			var locator = createLocator(),
				loader = locator.resolveInstance(
					LocalizationLoader, defaultConfig
				);

			assert.throws(function () {
				loader.load('wrong');
			}, 'Error expected');
		});

		it('should return default localization when argument is default locale',
			function (done) {
				var locator = createLocator(),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					);

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var localization = loader.load(defaultLocale);
						assert.deepEqual(
							localization, localizations[defaultLocale],
							'Localization do not match'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return non-default localization merged with default',
			function (done) {
				var locator = createLocator(),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					);

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var enLocalization = localizations.en,
							localization = loader.load('en');

						assert.strictEqual(
							localization.FIRST_VALUE,
							enLocalization.FIRST_VALUE,
							'Localization do not match'
						);
						assert.strictEqual(
							localization.SECOND_VALUE,
							enLocalization.SECOND_VALUE,
							'Localization do not match'
						);
						assert.strictEqual(
							localization.THIRD_VALUE,
							defaultLocalization.THIRD_VALUE,
							'Localization do not match'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return localization merged with default using full name',
			function (done) {
				var locator = createLocator(),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					);

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var enUsLocalization = localizations['en-us'],
							localization = loader.load('en-us');

						assert.strictEqual(
							localization.FIRST_VALUE,
							enUsLocalization.FIRST_VALUE,
							'Localization do not match'
						);
						assert.strictEqual(
							localization.SECOND_VALUE,
							enUsLocalization.SECOND_VALUE,
							'Localization do not match'
						);
						assert.strictEqual(
							localization.THIRD_VALUE,
							defaultLocalization.THIRD_VALUE,
							'Localization do not match'
						);
						assert.strictEqual(
							localization.FOURTH_VALUE,
							enUsLocalization.FOURTH_VALUE,
							'Localization do not match'
						);
						assert.strictEqual(
							localization.FIFTH_VALUE,
							enUsLocalization.FIFTH_VALUE,
							'Localization do not match'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return localization merged with components localization',
			function (done) {
				var locator = createLocator(components),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					);

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var localization = loader.load('en-us');

						var expectedLocalization = {
							FIRST_VALUE: 'en-us locale first by module1',
							SECOND_VALUE: 'en-us locale second',
							THIRD_VALUE: 'ru locale third',
							FOURTH_VALUE: 'en-us locale fourth by module2',
							FIFTH_VALUE: 'en-us locale fifth',
							SIXTH_VALUE: 'en-us locale sixth by module1',
							SEVENTH_VALUE: 'en-us locale seventh by module2',
							EIGHTH_VALUE: 'en-us locale eighth by module2',
							$pluralization: localizations['en-us'].$pluralization
						};

						assert.deepEqual(localization, expectedLocalization,
							'Localization do not match'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			}
		);

		it('should return same localization on short or full name',
			function (done) {
				var locator = createLocator(components),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					);

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var enLocalization = loader.load('en'),
							enGbLocalization = loader.load('en-gb');

						assert.deepEqual(enLocalization, enGbLocalization,
							'Localization do not match'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});
	});

	describe('#getMiddleware', function () {
		it('should set browser locale if it is absent in cookie',
			function (done) {
				var locator = createLocator(),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig),
					server = createServer(loader.getMiddleware());

				server.listen(8081, function () {
					var request = http.request({
							port: 8081,
							agent: false,
							headers: {
								'Accept-Language': 'en-US,ru;q=0.8,en;q=0.4'
							}
						},
						function (response) {
							assert.strictEqual(response.statusCode, 200,
								'Wrong status');

							assert.strictEqual(
								response.headers['set-cookie'] instanceof
								Array,
								true,
								'Response should have cookies');

							assert.strictEqual(
								response.headers['set-cookie'].length,
								1,
								'Response should have one cookie setup'
							);

							assert.strictEqual(/^locale=en-us/
									.test(response.headers['set-cookie'][0]),
								true,
								'Response cookie should have locale'
							);

							server.close(function () {
								done();
							});
						});

					request.end();
				});
			});

		it('should set browser locale with specified cookie parameters',
			function (done) {
				var locator = createLocator(),
					config = Object.create(defaultConfig.l10n);

				config.cookie = {
					name: 'testName',
					path: '/some/path',
					domain: 'some.domain.org',
					maxAge: 500
				};
				var loader = locator.resolveInstance(
						LocalizationLoader, {l10n: config}
					),
					server = createServer(loader.getMiddleware());

				server.listen(8091, function () {
					var expireDate = '',
						request = http.request({
							port: 8091,
							agent: false,
							headers: {
								'Accept-Language': 'en-US,ru;q=0.8,en;q=0.4'
							}
						},
						function (response) {
							assert.strictEqual(
								response.statusCode, 200, 'Wrong status'
							);

							assert.strictEqual(
								response.headers['set-cookie'] instanceof
								Array,
								true,
								'Response should have cookies');

							assert.strictEqual(
								response.headers['set-cookie'].length,
								1,
								'Response should have one cookie setup'
							);

							assert.strictEqual(
								response.headers['set-cookie'][0],
								'testName=en-us' +
									'; Max-Age=' + config.cookie.maxAge +
									'; Expires=' + expireDate.toUTCString() +
									'; Path=' + config.cookie.path +
									'; Domain=' + config.cookie.domain,
								'Response cookie should have locale'
							);

							server.close(function () {
								done();
							});
						});

					expireDate = new Date((new Date()).getTime() +
					config.cookie.maxAge * 1000);
					request.end();
				});
			});

		it('should set default locale if browser locale is absent',
			function (done) {
				var locator = createLocator(),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig),
					server = createServer(loader.getMiddleware());

				server.listen(8082, function () {
					var request = http.request({
							port: 8082,
							agent: false
						},
						function (response) {
							assert.strictEqual(response.statusCode, 200,
								'Wrong status');

							assert.strictEqual(
								response.headers['set-cookie'] instanceof
								Array,
								true,
								'Response should have cookies');

							assert.strictEqual(
								response.headers['set-cookie'].length,
								1,
								'Response should have one cookie setup'
							);

							assert.strictEqual(/^locale=ru/
									.test(response.headers['set-cookie'][0]),
								true,
								'Response cookie should have locale'
							);

							server.close(function () {
								done();
							});
						});

					request.end();
				});
			});

		it('should set default locale if wrong locale is used in cookies',
			function (done) {
				var locator = createLocator(),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig),
					server = createServer(loader.getMiddleware());

				server.listen(8083, function () {
					var request = http.request({
							port: 8083,
							agent: false,
							headers: {
								Cookie: 'locale=wrong'
							}
						},
						function (response) {
							assert.strictEqual(response.statusCode, 200,
								'Wrong status');

							assert.strictEqual(response.headers['set-cookie'],
								undefined,
								'Response should not have cookies');

							server.close(function () {
								done();
							});
						});

					request.end();
				});
			});

		it('should return localization file using cookie locale',
			function (done) {
				var locator = createLocator(),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					),
					server = createServer(loader.getMiddleware());

				var enUsLocalization = localizations['en-us'],
					mergedLocalization = {};
				mergedLocalization.FIRST_VALUE =
					enUsLocalization.FIRST_VALUE;
				mergedLocalization.SECOND_VALUE =
					enUsLocalization.SECOND_VALUE;
				mergedLocalization.THIRD_VALUE =
					defaultLocalization.THIRD_VALUE;
				mergedLocalization.FOURTH_VALUE =
					enUsLocalization.FOURTH_VALUE;
				mergedLocalization.FIFTH_VALUE =
					enUsLocalization.FIFTH_VALUE;
				mergedLocalization.$pluralization =
					localizations['en-us'].$pluralization;

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var request = http.request({
								port: 8084,
								agent: false,
								path: '/l10n.js',
								headers: {
									Cookie: 'locale=en-us'
								}
							},
							function (response) {
								assert.strictEqual(
									response.statusCode, 200, 'Wrong status'
								);

								var data = '';

								response.setEncoding('utf8');
								response
									.on('data', function (chunk) {
										data += chunk;
									})
									.on('end', function () {
										var window = {};
										/*jshint evil:true */
										eval(data);
										assert.deepEqual(
											window.localization,
											mergedLocalization,
											'Localization do not match'
										);
										server.close(function () {
											done();
										});
									});
							});
						request.end();
					});
				server.listen(8084, function () {
					eventBus.emit('allComponentsLoaded');
				});
			});

		it('should return localization file using cookie short locale',
			function (done) {
				var locator = createLocator(),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					),
					server = createServer(loader.getMiddleware());

				var enLocalization = localizations.en,
					mergedLocalization = {};
				mergedLocalization.FIRST_VALUE =
					enLocalization.FIRST_VALUE;
				mergedLocalization.SECOND_VALUE =
					enLocalization.SECOND_VALUE;
				mergedLocalization.THIRD_VALUE =
					defaultLocalization.THIRD_VALUE;
				mergedLocalization.$pluralization =
					localizations.en.$pluralization;

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var request = http.request({
								port: 8085,
								agent: false,
								path: '/l10n.js',
								headers: {
									Cookie: 'locale=en-au'
								}
							},
							function (response) {
								assert.strictEqual(
									response.statusCode, 200, 'Wrong status'
								);

								var data = '';

								response.setEncoding('utf8');
								response
									.on('data', function (chunk) {
										data += chunk;
									})
									.on('end', function () {
										var window = {};
										/*jshint evil:true */
										eval(data);
										assert.deepEqual(
											window.localization,
											mergedLocalization,
											'Localization do not match'
										);
										server.close(function () {
											done();
										});
									});
							});
						request.end();
					});
				server.listen(8085, function () {
					eventBus.emit('allComponentsLoaded');
				});
			});

		it('should return default localization file using cookie wrong locale',
			function (done) {
				var locator = createLocator(),
					eventBus = locator.resolve('eventBus'),
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig
					),
					server = createServer(loader.getMiddleware());

				eventBus
					.on('error', done)
					.on('l10nLoaded', function () {
						var request = http.request({
								port: 8086,
								agent: false,
								path: '/l10n.js',
								headers: {
									Cookie: 'locale=ch'
								}
							},
							function (response) {
								assert.strictEqual(
									response.statusCode, 200, 'Wrong status'
								);

								var data = '';

								response.setEncoding('utf8');
								response
									.on('data', function (chunk) {
										data += chunk;
									})
									.on('end', function () {
										var window = {};
										/*jshint evil:true */
										eval(data);
										assert.deepEqual(
											window.localization,
											defaultLocalization,
											'Localization do not match'
										);
										server.close(function () {
											done();
										});
									});
							});
						request.end();
					});
				server.listen(8086, function () {
					eventBus.emit('allComponentsLoaded');
				});
			});
	});
});

function createLocator(components) {
	components = components || {};
	var locator = new ServiceLocator();
	locator.register('logger', Logger);
	locator.registerInstance('serviceLocator', locator);
	locator.registerInstance('componentLoader', {
		getComponentsByNames: function () {
			return components;
		}
	});
	locator.registerInstance('eventBus', new events.EventEmitter());
	return locator;
}

function createServer(middleware, endCallback) {
	endCallback = endCallback || function () {};
	return http.createServer(function (request, response) {
		middleware(request, response, function () {
			response.end();
			endCallback(request, response);
		});
	});
}