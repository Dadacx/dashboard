const log = function (message) {
  console.log(message);
};

log.debugEnabled = false;

log.info = function (message) {
  console.log(`[${new Date().toLocaleTimeString()}]`.grey + ' [INFO]'.blue + ' ' + message);
};

log.error = function (message) {
  console.log(`[${new Date().toLocaleTimeString()}]`.grey + ' [ERROR]'.red + ' ' + message);
};

log.warning = function (message) {
  console.log(`[${new Date().toLocaleTimeString()}]`.grey + ' [WARN]'.yellow + ' ' + message);
};

log.debug = function (message) {
  if (log.debugEnabled) {
    console.log(`[${new Date().toLocaleTimeString()}]`.grey + ' [DEBUG]'.grey + ' ' + message.grey);
  }
};

module.exports = log;