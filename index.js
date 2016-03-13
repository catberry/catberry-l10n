'use strict';

const LocalizationProvider = require('./lib/LocalizationProvider');
const LocalizationLoader = require('./lib/LocalizationLoader');

module.exports = {

	/**
	 * Registers all localization components in service locator.
	 * @param {ServiceLocator} locator Catberry's service locator.
	 */
	register(locator) {
		locator.register('localizationProvider', LocalizationProvider, true);
		locator.register('localizationLoader', LocalizationLoader, true);
	},
	LocalizationProvider,
	LocalizationLoader
};
