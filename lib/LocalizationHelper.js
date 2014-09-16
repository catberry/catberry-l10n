/* 
 * catberry-localization
 *
 * Copyright (c) 2014 Denis Rechkunov and project contributors.
 *
 * catberry-localization's license follows:
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
 * This license applies to all parts of catberry-localization that are not externally
 * maintained libraries.
 */

'use strict';

module.exports = LocalizationHelper;

/**
 * Creates new instance of localization helper.
 * @param {LocalizationProvider} $localizationProvider Localization provider.
 * @constructor
 */
function LocalizationHelper($localizationProvider) {
	this._localizationProvider = $localizationProvider;
}

/**
 * Current localization provider.
 * @type {LocalizationProvider}
 * @private
 */
LocalizationHelper.prototype._localizationProvider = null;

/**
 * Gets dust helper for localization.
 * @returns {Function} Dust helper function.
 */
LocalizationHelper.prototype.getDustHelper = function () {
	return function (chunk, context, bodies, params) {
		var key = context.tap(params.key, chunk),
			locale = context.tap(params.locale, chunk),
			count = Number(
				context.tap(params.count, chunk)
			);
		if (!key) {
			return chunk.write('');
		}
		if (!locale) {
			locale = context.get('locale');
		}

		var localized = !isNaN(count) ?
			this._localizationProvider.pluralize(locale, key, count) :
			this._localizationProvider.get(locale, key);

		return chunk.write(localized);
	}.bind(this);
};