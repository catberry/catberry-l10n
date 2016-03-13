'use strict';

class LocalizationLoader {
	constructor(localizations) {
		this._localizations = localizations || {};
	}

	load(locale) {
		if (this._localizations[locale] &&
			typeof (this._localizations[locale]) === 'object') {
			return this._localizations[locale];
		}
		return {};

	}
}

module.exports = LocalizationLoader;
