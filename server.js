/**
 * Module Dependencies
 */

var EventEmitter = require('events');
var Util         = require('util');

/**
 * Client
 */
function Client(client) {
    this._client = client;
    this._ee = new EventEmitter();
    this._ee.setMaxListeners(Infinity);
    this.on = this._ee.on.bind(this._ee);
}

Client.prototype.emit = function(type, data) {
    var _data = {type: type, data: data};
    this._client.write(JSON.stringify(_data));
}

/**
 * @constructor
 */

function Connection() {
    /**
     *  Define if the connection needs to be authenticated by the client
     *  If this is not the case, the connection ID will be used instead
     *
     * @type {boolean}
     */
    this.bundling = false;
    this.logging = function(){};

    this._connections = [];
    this._sockjs = null;
    this._ee = new EventEmitter();
    this._ee.setMaxListeners(Infinity);
    this.on = this._ee.on.bind(this._ee);

    this.on('close', this.onClose.bind(this));
}

/**
 * Start the connection
 *
 * @param {SockJS} sockjs
 * @param {object} options
 */

Connection.prototype.start = function (sockjs, options) {

    this._sockjs = sockjs;
    var self = this;

    // Parse options
    options                     =  options || {};
    this.logging                = (options.hasOwnProperty('logging'))        ? options.logging        : this.logging;
    this.bundling               = (options.hasOwnProperty('bundling'))       ? options.bundling       : this.bundling;

    this.logging.call(null, 'Connection :: Starting socket listeners');

    // Sockjs Events
    sockjs.on('connection', function (client) {
        var wrappedClient = new Client(client);

        // Add to connections
        self._ee.emit('connect', wrappedClient);
        self._connections.push(client);

        // Handle connection close event
        client.on('close', function () {
            self._ee.emit('close', client);
        });

        // Handle incoming data events
        client.on('data', function (data) {
            // Parse message
            try {
                var message = JSON.parse(data);
            } catch (e) {
                self.logging.call(null, "Connection :: Error :: Failed to parse JSON :: ", e);
                return;
            }

            // Check for type
            if (!message.hasOwnProperty('type')) {
                self.logging.call(null, "Connection :: Error :: No message type specified");
                return;
            }

            wrappedClient._ee.emit(message.type, message.data);
        });

        return true;
    });

};

/**
 * If the client disconnects, remove it from the connection list
 *
 * @param {object} client
 */

Connection.prototype.onClose = function(client) {
    this._connections.splice(this._connections.indexOf(client));
};


/**
 * Allow for bundled messages with multiple callback_ids
 *
 * Bundle: [{callback_id: <id>, type: <type>, data: <data>}]
 * Type is optional if you supply a callback_id,
 * callback_id is optional if you supply a type
 *
 * @param {Array} bundle
 * @param {int} id
 */
Connection.prototype.bundle = function(bundle, id) {
    this.emit('bundle', bundle, id);
};

/**
 * Send data to an array of clients using its .emit function
 *
 * @param {string} type
 * @param {object} data
 * @param {array} list
 */

Connection.prototype.broadcastTo = function (type, data, list) {
    list.forEach(function(client) {
        client.emit(type, data, id);
    });
};

/**
 * Send data to all clients using their .emit function
 *
 * @param {string} type
 * @param {object} data
 */

Connection.prototype.broadcast = function (type, data) {
    this._connections.forEach(function(client){
        client.emit(type, data, id);
    });
};

/**
 * Module Exports
 *
 * @type {Connection}
 */

module.exports = exports = Connection;
