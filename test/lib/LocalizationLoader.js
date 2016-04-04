'use strict';

const assert = require('assert');
const events = require('events');
const http = require('http');
const path = require('path');
const LocalizationLoader = require('../../lib/LocalizationLoader');
const ServiceLocator = require('catberry-locator');

const caseRoot = path.join(
	__dirname, '..', 'cases', 'lib', 'server', 'LocalizationLoader'
);

const defaultLocale = 'ru';
const components = {
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
};
const defaultConfig = {
	l10n: {
		defaultLocale,
		path: caseRoot
	}
};
const localizations = {
	en: require(path.join(defaultConfig.l10n.path, 'en')),
	ru: require(path.join(defaultConfig.l10n.path, 'ru')),
	'en-us': require(path.join(defaultConfig.l10n.path, 'en-us'))
};
const defaultLocalization = localizations[defaultLocale];

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

/* eslint max-nested-callbacks: [2, 7]*/

describe('server/LocalizationLoader', () => {
	describe('#constructor', () => {
		it('should throw exception when default locale is not specified',
			() => {
				assert.throws(() => {
					const locator = createLocator();
					const localizationLoader = new LocalizationLoader(locator);
				}, 'Error expected');
			});

		it('should throw exception when default locale is wrong',
			() => {
				assert.throws(() => {
					const config = {
						l10n: {
							defaultLocale: 'china'
						}
					};
					const locator = createLocator();
					locator.registerInstance('config', config);
					const localizationLoader = new LocalizationLoader(locator);
				}, 'Error expected');
			});

		it('should throw exception when default localization can not be loaded',
			done => {
				const locator = createLocator(components);
				const eventBus = locator.resolve('eventBus');
				const config = {
					l10n: {
						defaultLocale: 'ch'
					}
				};

				locator.registerInstance('config', config);
				const localizationLoader = new LocalizationLoader(locator);

				eventBus
					.on('error', error => {
						assert.strictEqual(
							error.message, 'Can not load default locale ch'
						);
						done();
					});

				eventBus.emit('allComponentsLoaded');
			});

		it('should not throw exception when default locale is specified',
			() => {
				assert.doesNotThrow(() => {
					const locator = createLocator();
					locator.registerInstance('config', defaultConfig);
					const localizationLoader = new LocalizationLoader(locator);
				});
			});
	});

	describe('#load', () => {
		it('should throw exception on wrong locale', () => {
			const locator = createLocator();
			locator.registerInstance('config', defaultConfig);
			const localizationLoader = new LocalizationLoader(locator);

			assert.throws(() => loader.load('wrong'), 'Error expected');
		});

		it('should return default localization when argument is default locale',
			done => {
				const locator = createLocator();
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const localization = loader.load(defaultLocale);
						assert.deepEqual(
							localization, localizations[defaultLocale],
							'Localization do not match'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});

		it('should return non-default localization merged with default',
			done => {
				const locator = createLocator();
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const enLocalization = localizations.en;
						const localization = loader.load('en');

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
			done => {
				const locator = createLocator();
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const enUsLocalization = localizations['en-us'];
						const localization = loader.load('en-us');

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
			done => {
				const locator = createLocator(components);
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const localization = loader.load('en-us');

						const expectedLocalization = {
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
			done => {
				const locator = createLocator(components);
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const enLocalization = loader.load('en');
						const enGbLocalization = loader.load('en-gb');

						assert.deepEqual(enLocalization, enGbLocalization,
							'Localization do not match'
						);
						done();
					});
				eventBus.emit('allComponentsLoaded');
			});
	});

	describe('#getMiddleware', () => {
		it('should set browser locale if it is absent in cookie',
			done => {
				const locator = createLocator();
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);
				const server = createServer(loader.getMiddleware());

				server.listen(8081, () => {
					const request = http.request({
						port: 8081,
						agent: false,
						headers: {
							'Accept-Language': 'en-US,ru;q=0.8,en;q=0.4'
						}
					},
						response => {
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

							server.close(() => done());
						});

					request.end();
				});
			});

		it('should set browser locale with specified cookie parameters',
			done => {
				const locator = createLocator();
				const config = Object.create(defaultConfig);

				config.l10n.cookie = {
					name: 'testName',
					path: '/some/path',
					domain: 'some.domain.org',
					secure: true,
					httpOnly: true,
					maxAge: 500
				};
				locator.registerInstance('config', config);
				const loader = new LocalizationLoader(locator);
				const server = createServer(loader.getMiddleware());

				server.listen(8091, () => {
					let expireDate = '';
					const request = http.request({
						port: 8091,
						agent: false,
						headers: {
							'Accept-Language': 'en-US,ru;q=0.8,en;q=0.4'
						}
					},
						response => {
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
								`testName=en-us\
; Max-Age=${config.l10n.cookie.maxAge}\
; Expires=${expireDate.toUTCString()}\
; Path=${config.l10n.cookie.path}\
; Domain=${config.l10n.cookie.domain}\
; Secure; HttpOnly`,
								'Response cookie should have locale'
							);

							server.close(() => done());
						});

					expireDate = new Date((new Date()).getTime() +
					config.l10n.cookie.maxAge * 1000);
					request.end();
				});
			});

		it('should set default locale if browser locale is absent',
			done => {
				const locator = createLocator();
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);
				const server = createServer(loader.getMiddleware());

				server.listen(8082, () => {
					const request = http.request({
						port: 8082,
						agent: false
					},
						response => {
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

							// TODO: refactoring, old value 'locale'
							assert.strictEqual(/^testName=ru/
									.test(response.headers['set-cookie'][0]),
								true,
								'Response cookie should have locale'
							);

							server.close(() => done());
						});

					request.end();
				});
			});

		it('should set default locale if wrong locale is used in cookies',
			done => {
				const locator = createLocator();
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);
				const server = createServer(loader.getMiddleware());

				server.listen(8083, () => {
					const request = http.request({
						port: 8083,
						agent: false,
						headers: {
							Cookie: 'locale=wrong'
						}
					},
						response => {
							assert.strictEqual(response.statusCode, 200,
								'Wrong status');

							assert.strictEqual(response.headers['set-cookie'],
								undefined,
								'Response should not have cookies');

							server.close(() => done());
						});

					request.end();
				});
			});

		it('should return localization file using cookie locale',
			done => {
				const locator = createLocator();
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);
				const server = createServer(loader.getMiddleware());

				const enUsLocalization = localizations['en-us'];
				const mergedLocalization = {};
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
					.on('l10nLoaded', () => {
						const request = http.request({
							port: 8084,
							agent: false,
							path: '/l10n.js',
							headers: {
								Cookie: 'locale=en-us'
							}
						},
							response => {
								assert.strictEqual(
									response.statusCode, 200, 'Wrong status'
								);

								let data = '';

								response.setEncoding('utf8');
								response
									.on('data', chunk => {
										data += chunk;
									})
									.on('end', () => {

										/* eslint no-eval: 0*/
										const window = {};
										eval(data);
										assert.deepEqual(
											window.localization,
											mergedLocalization,
											'Localization do not match'
										);
										server.close(() => done());
									});
							});
						request.end();
					});
				server.listen(8084, () => eventBus.emit('allComponentsLoaded'));
			});

		it('should return localization file using cookie short locale',
			done => {
				const locator = createLocator();
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);
				const server = createServer(loader.getMiddleware());

				const enLocalization = localizations.en;
				const mergedLocalization = {};
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
					.on('l10nLoaded', () => {
						const request = http.request({
							port: 8085,
							agent: false,
							path: '/l10n.js',
							headers: {
								Cookie: 'locale=en-au'
							}
						},
							response => {
								assert.strictEqual(
									response.statusCode, 200, 'Wrong status'
								);

								let data = '';

								response.setEncoding('utf8');
								response
									.on('data', chunk => {
										data += chunk;
									})
									.on('end', () => {

										/* eslint no-eval: 0*/
										const window = {};
										eval(data);
										assert.deepEqual(
											window.localization,
											mergedLocalization,
											'Localization do not match'
										);
										server.close(() => done());
									});
							});
						request.end();
					});
				server.listen(8085, () => eventBus.emit('allComponentsLoaded'));
			});

		it('should return default localization file using cookie wrong locale',
			done => {
				const locator = createLocator();
				const eventBus = locator.resolve('eventBus');
				locator.registerInstance('config', defaultConfig);
				const loader = new LocalizationLoader(locator);
				const server = createServer(loader.getMiddleware());

				eventBus
					.on('error', done)
					.on('l10nLoaded', () => {
						const request = http.request({
							port: 8086,
							agent: false,
							path: '/l10n.js',
							headers: {
								Cookie: 'locale=ch'
							}
						},
							response => {
								assert.strictEqual(
									response.statusCode, 200, 'Wrong status'
								);

								let data = '';

								response.setEncoding('utf8');
								response
									.on('data', chunk => {
										data += chunk;
									})
									.on('end', () => {

										/* eslint no-eval: 0*/
										const window = {};
										eval(data);
										assert.deepEqual(
											window.localization,
											defaultLocalization,
											'Localization do not match'
										);
										server.close(() => done());
									});
							});
						request.end();
					});
				server.listen(8086, () => eventBus.emit('allComponentsLoaded'));
			});
	});
});

/**
 * Create ServiceLocator object
 * @param components
 * @returns {ServiceLocator}
 */
function createLocator(components) {
	components = components || {};
	const locator = new ServiceLocator();
	locator.registerInstance('serviceLocator', locator);
	const componentFinder = new events.EventEmitter();
	componentFinder.find = () => Promise.resolve(components);
	locator.registerInstance('componentFinder', componentFinder);
	locator.registerInstance('eventBus', new events.EventEmitter());
	return locator;
}

/**
 * Create server
 * @param middleware
 * @param endCallback
 * @returns {*}
 */
function createServer(middleware, endCallback) {
	endCallback = endCallback || function() {};
	return http.createServer(
		(request, response) => middleware(request, response, () => {
			response.end();
			endCallback(request, response);
		})
	);
}
