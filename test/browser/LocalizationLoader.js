'use strict';

const assert = require('assert');
const LocalizationLoader = require('../../browser/LocalizationLoader');
const ServiceLocator = require('catberry-locator');

/* eslint max-nested-callbacks: [2, 4]*/

describe('client/LocalizationLoader', () => {
	describe('#load', () => {
		it(
            'should return the same object from window on all specified locales',
			() => {
				const locator = new ServiceLocator();
				const localization = {
					TEST_VALUE: 'test'
				};
				locator.registerInstance('window', {
					localization
				});

				const loader = new LocalizationLoader(locator);
				assert.strictEqual(loader.load('en'), localization, 'Wrong localization');
				assert.strictEqual(loader.load('en-US'), localization, 'Wrong localization');
				assert.strictEqual(loader.load('ru'), localization, 'Wrong localization');
			}
        );
	});
});
