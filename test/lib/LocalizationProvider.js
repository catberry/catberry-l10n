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

var LocalizationLoaderMock = require('../mocks/LocalizationLoader'),
	Logger = require('../mocks/Logger'),
	LocalizationLoader = require('../../lib/LocalizationLoader'),
	LocalizationProvider = require('../../lib/LocalizationProvider'),
	assert = require('assert'),
	path = require('path'),
	ServiceLocator = require('catberry-locator');

var localizationPath = path.join(__dirname, '..',
	'cases', 'lib', 'LocalizationProvider');

describe('LocalizationProvider', function () {
	describe('#get', function () {
		it('should get value from localization', function () {
			var localizations = {
					en: {
						TEST_VALUE: 'en test'
					},
					ru: {
						TEST_VALUE: 'ru test'
					}
				},
				locator = createLocator({
					localizations: localizations
				}),
				provider = locator.resolveInstance(LocalizationProvider);

			assert.strictEqual(
				provider.get('en', 'TEST_VALUE'), localizations.en.TEST_VALUE,
				'Wrong localized value');
			assert.strictEqual(
				provider.get('ru', 'TEST_VALUE'), localizations.ru.TEST_VALUE,
				'Wrong localized value');
		});

		it('should return empty string if localization value is absent',
			function () {
				var locator = createLocator({
						localizations: {}
					}),
					provider = locator.resolveInstance(LocalizationProvider);

				assert.strictEqual(provider.get('en', 'TEST_VALUE'), '',
					'Wrong localized value');
				assert.strictEqual(provider.get('ru', 'TEST_VALUE'), '',
					'Wrong localized value');
			});

		it('should return first plural form if value is array', function () {
			var config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath
					}
				},
				locator = new ServiceLocator();
			locator.register('localizationLoader', LocalizationLoader, config);
			locator.register('logger', Logger);
			var provider = locator.resolveInstance(
				LocalizationProvider, config);

			assert.strictEqual(provider.get('en', 'TEST_VALUE'),
				'en form1',
				'Wrong localized value');
			assert.strictEqual(provider.get('ru', 'TEST_VALUE'),
				'ru form1',
				'Wrong localized value');

		});
	});

	describe('#pluralize', function () {
		it('should return plural form from locale', function () {
			var config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath
					}
				},
				locator = new ServiceLocator();
			locator.register('localizationLoader', LocalizationLoader, config);
			locator.register('logger', Logger);
			var provider = locator.resolveInstance(
				LocalizationProvider, config);

			assert.strictEqual(provider.pluralize('en', 'TEST_VALUE', 1),
				'en form1',
				'Wrong localized value');
			assert.strictEqual(provider.pluralize('en', 'TEST_VALUE', 2),
				'en form2',
				'Wrong localized value');

			assert.strictEqual(provider.pluralize('ru', 'TEST_VALUE', 1),
				'ru form1',
				'Wrong localized value');
			assert.strictEqual(provider.pluralize('ru', 'TEST_VALUE', 2),
				'ru form2',
				'Wrong localized value');
			assert.strictEqual(provider.pluralize('ru', 'TEST_VALUE', 5),
				'ru form3',
				'Wrong localized value');
		});

		it('should return plural form from default locale if not found',
			function () {
				var config = {
						l10n: {
							defaultLocale: 'ru',
							path: localizationPath
						}
					},
					locator = new ServiceLocator();
				locator.register('localizationLoader', LocalizationLoader,
					config);
				locator.register('logger', Logger);
				var provider = locator.resolveInstance(
					LocalizationProvider, config);

				assert.strictEqual(
					provider.pluralize('en', 'TEST_VALUE_ONLY_RU', 5),
					'ru-only form3',
					'Wrong localized value');
				assert.strictEqual(
					provider.pluralize('ru', 'TEST_VALUE_ONLY_RU', 5),
					'ru-only form3',
					'Wrong localized value');
			});

		it('should return string value if not array specified', function () {
			var config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath
					}
				},
				locator = new ServiceLocator();
			locator.register('localizationLoader', LocalizationLoader, config);
			locator.register('logger', Logger);
			var provider = locator.resolveInstance(
				LocalizationProvider, config);

			assert.strictEqual(
				provider.pluralize('en', 'TEST_VALUE3', 5),
				'en form1',
				'Wrong localized value');
			assert.strictEqual(
				provider.pluralize('ru', 'TEST_VALUE3', 5),
				'ru form1',
				'Wrong localized value');
		});

		it('should return empty string if incorrect count of forms',
			function () {
				var config = {
						l10n: {
							defaultLocale: 'ru',
							path: localizationPath
						}
					},
					locator = new ServiceLocator();
				locator.register('localizationLoader', LocalizationLoader,
					config);
				locator.register('logger', Logger);
				var provider = locator.resolveInstance(
					LocalizationProvider, config);

				assert.strictEqual(
					provider.pluralize('en', 'TEST_VALUE2', 5),
					'',
					'Wrong localized value');

				assert.strictEqual(
					provider.pluralize('ru', 'TEST_VALUE2', 5),
					'',
					'Wrong localized value');
			});
	});
});

function createLocator(config) {
	var locator = new ServiceLocator();
	locator.register('localizationLoader', LocalizationLoaderMock, config);

	return locator;
}