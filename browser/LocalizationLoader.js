'use strict';

class LocalizationLoader {

	/**
	 * Creates new instance of localization loader.
	 * @param {ServiceLocator} locator Locator to resolve dependencies.
	 */
	constructor(locator) {
		const window = locator.resolve('window');
		this._localization = window.localization &&
			typeof (window.localization) === 'object' ? window.localization : {};
	}

	/**
	 * Loads localization by locale.
	 * @returns {Object} Object with localization.
	 */
	load() {
		return this._localization;
	}
}

module.exports = LocalizationLoader;
