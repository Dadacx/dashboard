const si = require('systeminformation');
const colors = require('colors');
colors.enable()

const log = require('./log');
log.debugEnabled = false;

function test() {
    log("test")
    log.info("test info")
    log.error("test error")
    log.warning("test warning")
    log.debug("test debug")
}


test()

// while(1){}