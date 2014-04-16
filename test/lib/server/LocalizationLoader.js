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

var assert = require('assert'),
	http = require('http'),
	path = require('path'),
	LocalizationLoader = require('../../../lib/server/LocalizationLoader'),
	Logger = require('../../mocks/Logger'),
	ServiceLocator = require('catberry-locator');

var defaultLocale = 'ru',
	defaultConfig = {
		localization: {
			defaultLocale: defaultLocale,
			path: path.join(__dirname, '..', '..', 'cases',
				'lib', 'server', 'LocalizationLoader')
		}
	},
	localizations = {
		en: require(path.join(defaultConfig.localization.path, 'en')),
		ru: require(path.join(defaultConfig.localization.path, 'ru')),
		'en-us': require(path.join(defaultConfig.localization.path, 'en-us'))
	},
	defaultLocalization = localizations[defaultLocale];

describe('server/LocalizationLoader', function () {
	describe('#constructor', function () {
		it('should throw exception when default locale is not specified',
			function () {
				assert.throws(function () {
					var locator = createLocator();
					locator.resolveInstance(LocalizationLoader);
				}, 'Error expected');
			});

		it('should throw exception when default localization can not be loaded',
			function () {
				assert.throws(function () {
					var locator = createLocator();
					locator.resolveInstance(LocalizationLoader, {
						localization: {
							defaultLocale: 'ch'
						}
					});
				}, 'Error expected');
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
				loader = locator.resolveInstance(LocalizationLoader,
					defaultConfig);

			assert.throws(function () {
				loader.load('wrong');
			}, 'Error expected');
		});

		it('should return default localization when argument is default locale',
			function () {
				var locator = createLocator(),
					loader = locator.resolveInstance(LocalizationLoader,
						defaultConfig),
					localization = loader.load(defaultLocale);

				assert.deepEqual(localization, localizations[defaultLocale],
					'Localization do not match'
				);
			});

		it('should return non-default localization merged with default',
			function () {
				var locator = createLocator(),
					loader = locator.resolveInstance(LocalizationLoader,
						defaultConfig),
					enLocalization = localizations.en,
					localization = loader.load('en');

				assert.strictEqual(
					localization.FIRST_VALUE, enLocalization.FIRST_VALUE,
					'Localization do not match'
				);
				assert.strictEqual(
					localization.SECOND_VALUE, enLocalization.SECOND_VALUE,
					'Localization do not match'
				);
				assert.strictEqual(
					localization.THIRD_VALUE, defaultLocalization.THIRD_VALUE,
					'Localization do not match'
				);
			});

		it('should return localization merged with default using full name',
			function () {
				var locator = createLocator(),
					loader = locator.resolveInstance(LocalizationLoader,
						defaultConfig),
					enUsLocalization = localizations['en-us'],
					localization = loader.load('en-us');

				assert.strictEqual(
					localization.FIRST_VALUE, enUsLocalization.FIRST_VALUE,
					'Localization do not match'
				);
				assert.strictEqual(
					localization.SECOND_VALUE, enUsLocalization.SECOND_VALUE,
					'Localization do not match'
				);
				assert.strictEqual(
					localization.THIRD_VALUE, defaultLocalization.THIRD_VALUE,
					'Localization do not match'
				);
				assert.strictEqual(
					localization.FOURTH_VALUE, enUsLocalization.FOURTH_VALUE,
					'Localization do not match'
				);
				assert.strictEqual(
					localization.FIFTH_VALUE, enUsLocalization.FIFTH_VALUE,
					'Localization do not match'
				);
			});

		it('should return localization merged with modules localization',
			function () {
				var locator = createLocator(),
					config = Object.create(defaultConfig);
				config.modulesFolder = path.join(__dirname, '..', '..', 'cases',
					'lib', 'server', 'LocalizationLoader', 'modules');
				var loader = locator.resolveInstance(LocalizationLoader,
						config),
					localization = loader.load('en-us');

				var expectedLocalization = {
					FIRST_VALUE: 'en-us locale first by module1',
					SECOND_VALUE: 'en-us locale second',
					THIRD_VALUE: 'ru locale third',
					FOURTH_VALUE: 'en-us locale fourth by module2',
					FIFTH_VALUE: 'en-us locale fifth',
					SIXTH_VALUE: 'en-us locale sixth by module1',
					SEVENTH_VALUE: 'en-us locale seventh by module2',
					EIGHTH_VALUE: 'en-us locale eighth by module2'
				};
				assert.deepEqual(localization, expectedLocalization,
					'Localization do not match'
				);
			}
		);

		it('should return same localization on short or full name',
			function () {
				var locator = createLocator(),
					loader = locator.resolveInstance(LocalizationLoader,
						defaultConfig),
					enLocalization = loader.load('en'),
					enGbLocalization = loader.load('en-gb');

				assert.deepEqual(enLocalization, enGbLocalization,
					'Localization do not match'
				);
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
					loader = locator.resolveInstance(
						LocalizationLoader, defaultConfig),
					server = createServer(loader.getMiddleware());

				server.listen(8084, function () {
					var request = http.request({
							port: 8084,
							agent: false,
							path: '/localization.js',
							headers: {
								Cookie: 'locale=en-us'
							}
						},
						function (response) {
							assert.strictEqual(response.statusCode, 200,
								'Wrong status');

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

							var expected = 'window.localization = ' +
								JSON.stringify(mergedLocalization) + ';';
							var data = '';

							response.setEncoding('utf8');
							response.on('data', function (chunk) {
								data += chunk;
							});
							response.on('end', function () {
								assert.strictEqual(data, expected,
									'Wrong file received');
								server.close(function () {
									done();
								});
							});
						});

					request.end();
				});
			});

	});
});

function createLocator() {
	var locator = new ServiceLocator();
	locator.register('logger', Logger);
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