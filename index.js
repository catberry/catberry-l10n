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

var LocalizationProvider = require('./lib/LocalizationProvider'),
	ServerLocalizationLoader = require('./lib/server/LocalizationLoader'),
	ClientLocalizationLoader = require('./lib/client/LocalizationLoader');

module.exports = {
	/**
	 * Constructor of localization provider.
	 */
	LocalizationProvider: LocalizationProvider,
	/**
	 * Constructor of server-side localization loader.
	 */
	ServerLocalizationLoader: ServerLocalizationLoader,
	/**
	 * Constructor of client-side localization loader.
	 */
	ClientLocalizationLoader: ClientLocalizationLoader,
	/**
	 * Registers all localization components in server-side service locator.
	 * @param {ServiceLocator} locator Catberry's service locator.
	 */
	registerOnServer: function (locator) {
		var config = locator.resolve('config');
		locator.register('localizationProvider',
			LocalizationProvider, config, true);
		locator.register('localizationLoader',
			ServerLocalizationLoader, config, true);
	},
	/**
	 * Registers all localization components in client-side service locator.
	 * @param {ServiceLocator} locator Catberry's service locator.
	 */
	registerOnClient: function (locator) {
		var config = locator.resolve('config');
		locator.register('localizationProvider',
			LocalizationProvider, config, true);
		locator.register('localizationLoader',
			ClientLocalizationLoader, config, true);
	}
};