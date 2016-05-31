#!/usr/bin/env node

var assert = require('assert')
var fs = require('fs')
var path = require('path')

var debug = require('debug')('exandria')
var hypercore = require('hypercore')
var minimatch = require('minimatch')
var argv = require('minimist')(process.argv.slice(2))
var sprintf = require('sprintf-js').sprintf

var NestLevels = require('../lib/nest-levels')
var set = require('../lib/set')
var utils = require('../lib/utils')

var nest = NestLevels(utils.getDbPath(argv.db))
var core = hypercore(nest.db('hypercore'))

var filesPath = path.join(utils.getDbPath(argv.db), 'files')

var match = argv._[0] || '*'

var setStream = set.SetStream(nest)
setStream.once('synced', function () {
  var toGet = {}
  setStream.files.forEach(function (fullName, fileInfo) {
    if (minimatch(fullName, match, {nocase: true})) {
      toGet[fullName] = fileInfo
    }
  })

  assert(Object.keys(toGet).length > 0, sprintf('No files matched "%s"', match))

  toGet.forEach(function (fullName, fileInfo) {
    var keyHex = fileInfo.hash.toString('hex')
    var fileFeed = utils.getFileFeed(core, filesPath, keyHex)
    utils.joinFeedSwarm(fileFeed)
    fileFeed.get(0, function (err, block) {
      assert.ifError(err)
      assert(block)
      debug('got file', fullName)

      if (!fs.existsSync('./files')) {
        fs.mkdirSync('./files')
      }
      var linkPath = path.join('./files', fullName)
      if (fs.existsSync(linkPath)) {
        debug('replacing existing file', linkPath)
        fs.unlinkSync(linkPath)
      }
      fs.symlinkSync(path.join('..', filesPath, keyHex), linkPath)
      process.exit(0)
    })
  })
})

setStream.start()
