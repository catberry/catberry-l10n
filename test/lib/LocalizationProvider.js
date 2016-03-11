'use strict';

const LocalizationLoaderMock = require('../mocks/LocalizationLoader');
const Logger = require('../mocks/Logger');
const LocalizationLoader = require('../../lib/LocalizationLoader');
const LocalizationProvider = require('../../lib/LocalizationProvider');
const assert = require('assert');
const path = require('path');
const events = require('events');
const ServiceLocator = require('catberry-locator');

const localizationPath = path.join(__dirname, '..',
	'cases', 'lib', 'LocalizationProvider');

/* eslint max-nested-callbacks: [2, 4]*/

describe('LocalizationProvider', () => {
	describe('constructor', () => {
		it('should throw error if l10n config is not specified',
			() => {
				const locator = createLocator({});

				assert.throws(() => {
					const provider = new LocalizationProvider(locator);
				});
			});
		it('should throw error if default locale is not specified',
			() => {
				const config = {
					l10n: {}
				};
				const locator = createLocator(config);

				assert.throws(() => {
					const provider = new LocalizationProvider(locator);
				});
			});
	});
	describe('#getCurrentLocale', () => {
		it('should get current locale value from context', () => {
			const config = {
				l10n: {
					defaultLocale: 'en-us',
					cookie: {
						name: 'coolLocale'
					}
				}
			};
			const locator = createLocator(config);
			const provider = new LocalizationProvider(locator);
			const locale = provider.getCurrentLocale({
				cookie: {
					get: name => {
						if (name === config.l10n.cookie.name) {
							return 'some-locale';
						}
						return null;
					}
				}
			});

			assert.strictEqual(
				locale, 'some-locale', 'Wrong localized value'
			);
		});
		it('should get current locale as default locale if cookie is empty',
			() => {
				const config = {
					l10n: {
						defaultLocale: 'en-us',
						cookie: {
							name: 'coolLocale'
						}
					}
				};
				const locator = createLocator(config);
				const provider = new LocalizationProvider(locator);
				const locale = provider.getCurrentLocale({
					cookie: {
						get: () => { }
					}
				});

				assert.strictEqual(
					locale, config.l10n.defaultLocale, 'Wrong localized value'
				);
			});
	});
	describe('#get', () => {
		it('should get value from localization', () => {
			const localizations = {
				en: {
					TEST_VALUE: 'en test'
				},
				ru: {
					TEST_VALUE: 'ru test'
				}
			};
			const locator = createLocator({
				l10n: {
					defaultLocale: 'en'
				},
				localizations
			});

			locator.registerInstance('localizations', localizations);
			const provider = new LocalizationProvider(locator);

			assert.strictEqual(
				provider.get('en', 'TEST_VALUE'), localizations.en.TEST_VALUE,
				'Wrong localized value'
			);
			assert.strictEqual(
				provider.get('ru', 'TEST_VALUE'), localizations.ru.TEST_VALUE,
				'Wrong localized value'
			);
		});

		it('should return empty string if localization value is absent',
			() => {
				const locator = createLocator({
					l10n: {
						defaultLocale: 'en'
					},
					localizations: {}
				});
				const provider = new LocalizationProvider(locator);

				assert.strictEqual(
					provider.get('en', 'TEST_VALUE'), '',
					'Wrong localized value'
				);
				assert.strictEqual(
					provider.get('ru', 'TEST_VALUE'), '',
					'Wrong localized value'
				);
			});

		it('should return key instead of empty string when allowed placeholders',
			() => {
				const locator = createLocator({
					l10n: {
						defaultLocale: 'en',
						placeholder: true
					},
					localizations: {}
				});

				const provider = new LocalizationProvider(locator);

				const key = 'TEST_VALUE';

				assert.strictEqual(
					provider.get('en', key), key,
					'Wrong localized value'
				);
				assert.strictEqual(
					provider.get('ru', key), key,
					'Wrong localized value'
				);
			});

		it('should return first plural form if value is array',
			done => {
				const config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath
					}
				};
				const locator = createLocator(config);
				const eventBus = locator.resolve('eventBus');
				locator.register('localizationLoader', LocalizationLoader);
				const provider = new LocalizationProvider(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						assert.strictEqual(
							provider.get('en', 'TEST_VALUE'),
							'en form1',
							'Wrong localized value'
						);
						assert.strictEqual(
							provider.get('ru', 'TEST_VALUE'),
							'ru form1',
							'Wrong localized value'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});
	});

	describe('#pluralize', () => {
		it('should return plural form from locale', done => {
			const config = {
				l10n: {
					defaultLocale: 'ru',
					path: localizationPath
				}
			};
			const locator = createLocator(config);
			const eventBus = locator.resolve('eventBus');
			locator.register('localizationLoader', LocalizationLoader);
			const provider = new LocalizationProvider(locator);

			eventBus
				.on('error', done)
				.on('l10nLoaded', () => {
					assert.strictEqual(
						provider.pluralize('en', 'TEST_VALUE', 1),
						'en form1',
						'Wrong localized value'
					);
					assert.strictEqual(
						provider.pluralize('en', 'TEST_VALUE', 2),
						'en form2',
						'Wrong localized value'
					);
					assert.strictEqual(
						provider.pluralize('ru', 'TEST_VALUE', 1),
						'ru form1',
						'Wrong localized value'
					);
					assert.strictEqual(
						provider.pluralize('ru', 'TEST_VALUE', 2),
						'ru form2',
						'Wrong localized value'
					);
					assert.strictEqual(
						provider.pluralize('ru', 'TEST_VALUE', 5),
						'ru form3',
						'Wrong localized value'
					);
					done();
				});
			eventBus.emit('allComponentsLoaded');
		});

		it('should return plural form from default locale if not found',
			done => {
				const config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath
					}
				};
				const locator = createLocator(config);
				const eventBus = locator.resolve('eventBus');
				locator.register('localizationLoader', LocalizationLoader);
				const provider = new LocalizationProvider(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						assert.strictEqual(
							provider.pluralize('en', 'TEST_VALUE_ONLY_RU', 5),
							'ru-only form3',
							'Wrong localized value'
						);
						assert.strictEqual(
							provider.pluralize('ru', 'TEST_VALUE_ONLY_RU', 5),
							'ru-only form3',
							'Wrong localized value'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return string value if not array specified',
			done => {
				const config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath
					}
				};
				const locator = createLocator(config);
				const eventBus = locator.resolve('eventBus');
				locator.register('localizationLoader', LocalizationLoader);
				const provider = new LocalizationProvider(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						assert.strictEqual(
							provider.pluralize('en', 'TEST_VALUE3', 5),
							'en form1',
							'Wrong localized value'
						);
						assert.strictEqual(
							provider.pluralize('ru', 'TEST_VALUE3', 5),
							'ru form1',
							'Wrong localized value'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return empty string if incorrect count of forms',
			done => {
				const config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath
					}
				};
				const locator = createLocator(config);
				const eventBus = locator.resolve('eventBus');
				locator.register('localizationLoader', LocalizationLoader);
				const provider = new LocalizationProvider(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						assert.strictEqual(
							provider.pluralize('en', 'TEST_VALUE2', 5),
							'',
							'Wrong localized value'
						);

						assert.strictEqual(
							provider.pluralize('ru', 'TEST_VALUE2', 5),
							'',
							'Wrong localized value'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return key if incorrect count of forms and placeholders allowed',
			done => {
				const config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath,
						placeholder: true
					}
				};
				const locator = createLocator(config);
				const eventBus = locator.resolve('eventBus');
				locator.register('localizationLoader', LocalizationLoader);
				const provider = new LocalizationProvider(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const key = 'TEST_VALUE2';
						assert.strictEqual(
							provider.pluralize('en', key, 5),
							key,
							'Wrong localized value'
						);

						assert.strictEqual(
							provider.pluralize('ru', key, 5),
							key,
							'Wrong localized value'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return key if localization absent and placeholders allowed',
			done => {
				const config = {
					l10n: {
						defaultLocale: 'ru',
						path: localizationPath,
						placeholder: true
					}
				};
				const locator = createLocator(config);
				const eventBus = locator.resolve('eventBus');
				locator.register('localizationLoader', LocalizationLoader);
				const provider = new LocalizationProvider(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const key = 'TEST_VALUE4';
						assert.strictEqual(
							provider.pluralize('en', key, 5),
							key,
							'Wrong localized value'
						);

						assert.strictEqual(
							provider.pluralize('ru', key, 5),
							key,
							'Wrong localized value'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});
	});
});

/**
 * Create ServiceLocator object
 * @param {Object} config
 * @returns {ServiceLocator}
 */
function createLocator(config) {
	const locator = new ServiceLocator();
	locator.registerInstance('config', config);
	locator.registerInstance('eventBus', new events.EventEmitter());
	const componentFinder = new events.EventEmitter();
	componentFinder.find = () => Promise.resolve({});
	locator.registerInstance('componentFinder', componentFinder);
	locator.register('logger', Logger);
	locator.registerInstance('localizationLoader', new LocalizationLoaderMock(config.localizations));
	locator.register('localizationProvider', LocalizationProvider);

	return locator;
}
