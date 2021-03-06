const response = require("response");

const update = function() {
  var keys = Object.keys(this.table);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    this.table[key].expiry -= this.params.checkinterval;
    if (this.table[key].expiry <= 0) delete this.table[key];
  }
};
exports.update = update;

const stop = function() {
  if (this.timer) {
    clearInterval(this.timer);
  }
  this.params.stop = true;
};

exports.stop = stop;

const _handle = function(options, table, req, res, next) {
  if (options.stop) {
    return next();
  }
  if (options.testmode) {
    console.log("ddos: handle: beginning:", table);
  }
  var address = options.trustProxy
    ? req.headers["x-forwarded-for"] || req.connection.remoteAddress
    : req.connection.remoteAddress;
  if (options.testmode) {
    console.log("Address:", address);
  }
  if (options.whitelist.indexOf(address) != -1) {
    return next();
  }
  var host = address;

  if (options.includeUserAgent)
    host = host.concat("#" + req.headers["user-agent"]);
  if (!table[host]) table[host] = { count: 1, expiry: 1 };
  else {
    table[host].count++;
    if (table[host].count > options.maxcount)
      table[host].count = options.maxcount;
    if (table[host].count > options.burst) {
      if (table[host].expiry < options.maxexpiry)
        table[host].expiry = Math.min(
          options.maxexpiry,
          table[host].expiry * 2
        );
    } else {
      table[host].expiry = 1;
    }
  }
  if (table[host].count > options.limit) {
    if (!options.silent) console.log("ddos: denied: entry:", host, table[host]);
    if (options.testmode) {
      response
        .json(table[host])
        .status(options.responseStatus)
        .pipe(res);
    } else {
      if (res.writeHead) {
        res.writeHead(options.responseStatus);
        res.end(options.errormessage);
      } else {
        // hapi
        res(options.errormessage).code(429);
      }
    }
  } else {
    next();
  }
  if (options.testmode) {
    console.log("ddos: handle: end:", table);
  }
};
exports._handle = _handle;

exports.handle = function (req, res, next) {
  return _handle(this.params, this.table, req, res, next);
};
