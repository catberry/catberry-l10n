'use strict';

const fs = require('fs');
const helper = require('./promiseHelper');

module.exports = {
	exists: toCheck => new Promise(fulfill => fs.exists(toCheck, isExists => fulfill(isExists))),
	stat: helper.callbackToPromise(fs.stat),
	readdir: helper.callbackToPromise(fs.readdir),
	readFile: helper.callbackToPromise(fs.readFile)
};
